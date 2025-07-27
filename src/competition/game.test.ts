// ABOUTME: Unit tests for Game class implementing strict 3-round competition state machine
// Tests cover valid state transitions and fail-fast behavior for invalid operations

import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './game/game';
import { GameError } from './game/game-error';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { NextStepType } from './game/next-step';

describe('Game', () => {
  let game: Game;
  let participantA: ParticipantId;
  let participantB: ParticipantId;
  let participantC: ParticipantId;

  beforeEach(() => {
    game = new Game();
    participantA = ParticipantId.fromString('agent-a');
    participantB = ParticipantId.fromString('agent-b');
    participantC = ParticipantId.fromString('agent-c');
  });

  describe('Game State Machine - Valid Transitions', () => {
    it('should allow baseline creation after starting round', () => {
      game.startRound(1, participantA);

      expect(() => game.recordBaselineSuccess(participantA)).not.toThrow();
      expect(game.getScore(participantA)).toBe(0);
    });

    it('should allow bug injection only after successful baseline', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);

      expect(() => game.recordBugInjectionSuccess(participantB)).not.toThrow();
      expect(game.getScore(participantB)).toBe(0);
    });

    it('should allow fix attempts only after successful bug injection', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);

      expect(() => game.recordFixSuccess(participantC)).not.toThrow();
      expect(game.getScore(participantC)).toBe(1);
    });

    it('should allow round finish only after all phases completed', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixSuccess(participantC);

      expect(() => game.finishRound()).not.toThrow();
    });
  });

  describe('Game State Machine - Invalid Early Operations', () => {
    it('should fail when recording baseline before starting round', () => {
      expect(() => game.recordBaselineSuccess(participantA)).toThrow(GameError);
    });

    it('should fail when recording bug injection before baseline completion', () => {
      game.startRound(1, participantA);

      expect(() => game.recordBugInjectionSuccess(participantB)).toThrow(GameError);
    });

    it('should fail when recording bug injection before baseline success', () => {
      game.startRound(1, participantA);
      game.recordBaselineFailure(participantA);

      expect(() => game.recordBugInjectionSuccess(participantB)).toThrow(GameError);
    });

    it('should fail when recording fix attempt before bug injection', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);

      expect(() => game.recordFixSuccess(participantC)).toThrow(GameError);
    });

    it('should fail when recording fix attempt after failed bug injection', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionFailure(participantB);

      expect(() => game.recordFixSuccess(participantC)).toThrow(GameError);
    });

    it('should fail when finishing round before all phases completed', () => {
      game.startRound(1, participantA);

      expect(() => game.finishRound()).toThrow(GameError);
    });

    it('should allow finishing round after baseline failure', () => {
      game.startRound(1, participantA);
      game.recordBaselineFailure(participantA);

      expect(() => game.finishRound()).not.toThrow();
    });
  });

  describe('Game State Machine - Invalid Participant Rules', () => {
    it('should fail when baseline author tries to inject bug', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);

      expect(() => game.recordBugInjectionSuccess(participantA)).toThrow(GameError);
    });

    it('should fail when baseline author tries to fix bug', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);

      expect(() => game.recordFixSuccess(participantA)).toThrow(GameError);
    });

    it('should fail when bug author tries to fix their own bug', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);

      expect(() => game.recordFixSuccess(participantB)).toThrow(GameError);
    });

    it('should fail when non-author tries to create baseline', () => {
      game.startRound(1, participantA);

      expect(() => game.recordBaselineSuccess(participantB)).toThrow(GameError);
    });
  });

  describe('Game State Machine - Invalid Late Operations', () => {
    it('should fail when trying to record baseline after bug injection started', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);

      expect(() => game.recordBaselineSuccess(participantA)).toThrow(GameError);
    });

    it('should fail when trying to inject bug after fix attempts started', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixFailure(participantC);

      expect(() => game.recordBugInjectionSuccess(participantC)).toThrow(GameError);
    });

    it('should fail when trying to fix after round finished', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixSuccess(participantC);
      game.finishRound();

      expect(() => game.recordFixSuccess(participantA)).toThrow(GameError);
    });

    it('should fail when starting new round without finishing previous', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);

      expect(() => game.startRound(2, participantB)).toThrow(GameError);
    });
  });

  describe('Scoring Logic', () => {
    it('should award 1 point to bug author for each participant that fails to fix', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixFailure(participantC);
      // participantA cannot fix because they are baseline author
      game.finishRound();

      expect(game.getScore(participantB)).toBe(1); // 1 point for participantC's failure
      expect(game.getScore(participantA)).toBe(0);
      expect(game.getScore(participantC)).toBe(0);
    });

    it('should award bug author points only for failed fixers when some succeed', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixSuccess(participantC);
      // participantA cannot fix because they are baseline author
      game.finishRound();

      expect(game.getScore(participantB)).toBe(0); // No points because participantC succeeded
      expect(game.getScore(participantC)).toBe(1); // 1 point for successful fix
      expect(game.getScore(participantA)).toBe(0);
    });

    it('should deduct points for failures', () => {
      game.startRound(1, participantA);
      game.recordBaselineFailure(participantA);
      game.finishRound();

      game.startRound(2, participantB);
      game.recordBaselineSuccess(participantB);
      game.recordBugInjectionFailure(participantC);
      game.finishRound();

      expect(game.getScore(participantA)).toBe(-1);
      expect(game.getScore(participantB)).toBe(0);
      expect(game.getScore(participantC)).toBe(-1);
    });
  });

  describe('Multi-Round Game', () => {
    it('should handle complete 3-round game correctly', () => {
      // Round 1: A baseline, B bug, C fixes
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixSuccess(participantC);
      game.finishRound();

      // Round 2: B baseline, C bug, A fails to fix
      game.startRound(2, participantB);
      game.recordBaselineSuccess(participantB);
      game.recordBugInjectionSuccess(participantC);
      game.recordFixFailure(participantA);
      game.finishRound();

      // Round 3: C baseline, A bug, B fixes
      game.startRound(3, participantC);
      game.recordBaselineSuccess(participantC);
      game.recordBugInjectionSuccess(participantA);
      game.recordFixSuccess(participantB);
      game.finishRound();

      const summary = game.getFinalSummary();

      expect(summary.participantScores).toEqual([
        {
          participantId: participantC.getValue(),
          score: 2,
          details: { fixes: 1, bugsSolved: 1, baselineFailures: 0, bugInjectionFailures: 0 },
        },
        {
          participantId: participantB.getValue(),
          score: 1,
          details: { fixes: 1, bugsSolved: 0, baselineFailures: 0, bugInjectionFailures: 0 },
        },
      ]);
      expect(summary.totalRounds).toBe(3);
    });
  });

  describe('Next Expected Step', () => {
    it('should indicate waiting for round start when game is fresh', () => {
      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.WAITING_FOR_ROUND_START,
        description: 'Game is ready to start a new round',
      });
    });

    it('should indicate baseline creation needed after round start', () => {
      game.startRound(1, participantA);
      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.WAITING_FOR_BASELINE,
        description: 'Waiting for baseline author to create baseline',
        expectedParticipant: participantA.getValue(),
      });
    });

    it('should indicate bug injection needed after baseline success', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.WAITING_FOR_BUG_INJECTION,
        description: 'Waiting for participants to inject bugs',
        excludedParticipant: participantA.getValue(),
      });
    });

    it('should indicate fix attempts needed after bug injection success', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.WAITING_FOR_FIX_ATTEMPTS,
        description: 'Waiting for participants to attempt bug fixes',
        excludedParticipants: [participantA.getValue(), participantB.getValue()],
      });
    });

    it('should indicate round can be finished after bug injection and some fix attempts', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixFailure(participantC);
      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.READY_TO_FINISH_ROUND,
        description: 'Round can be finished - bug injection completed and fix attempts made',
      });
    });

    it('should indicate round can be finished after baseline failure', () => {
      game.startRound(1, participantA);
      game.recordBaselineFailure(participantA);
      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.READY_TO_FINISH_ROUND,
        description: 'Round can be finished - baseline failed',
      });
    });

    it('should indicate round can be finished after bug injection failure', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionFailure(participantB);
      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.READY_TO_FINISH_ROUND,
        description: 'Round can be finished - bug injection failed',
      });
    });

    it('should return to waiting for round start after round is finished', () => {
      game.startRound(1, participantA);
      game.recordBaselineSuccess(participantA);
      game.recordBugInjectionSuccess(participantB);
      game.recordFixSuccess(participantC);
      game.finishRound();

      const nextStep = game.getNextExpectedStep();

      expect(nextStep).toEqual({
        type: NextStepType.WAITING_FOR_ROUND_START,
        description: 'Game is ready to start a new round',
      });
    });
  });
});
