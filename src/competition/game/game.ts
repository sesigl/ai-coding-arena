// ABOUTME: Main Game orchestrator class coordinating state, validation, and scoring
// Provides clean API for competition phases while enforcing business rules

import { ParticipantId } from 'domain/competition-event/participant-id';
import { GameStateManager } from './game-state-manager';
import { ParticipantValidator } from './participant-validator';
import { ScoreKeeper } from './score-keeper';
import { GameSummary } from './game-summary';
import { NextStep } from './next-step';

export class Game {
  private readonly stateManager = new GameStateManager();
  private readonly scoreKeeper = new ScoreKeeper();
  private completedRounds = 0;

  registerParticipant(participant: ParticipantId): void {
    this.scoreKeeper.registerParticipant(participant);
  }

  startRound(roundNumber: number, baselineAuthor: ParticipantId): void {
    this.stateManager.startRound(roundNumber, baselineAuthor);
  }

  recordBaselineSuccess(participant: ParticipantId): void {
    const state = this.stateManager.getCurrentState();
    ParticipantValidator.validateBaselineAuthor(participant, state);
    this.stateManager.recordBaselineSuccess();
  }

  recordBaselineFailure(participant: ParticipantId): void {
    const state = this.stateManager.getCurrentState();
    ParticipantValidator.validateBaselineAuthor(participant, state);

    this.scoreKeeper.adjustScore(participant, -1);
    this.scoreKeeper.incrementStat(participant, 'baselineFailures');
    this.stateManager.recordBaselineFailure();
  }

  recordBugInjectionSuccess(participant: ParticipantId): void {
    const state = this.stateManager.getCurrentState();
    ParticipantValidator.validateNotBaselineAuthor(participant, state);
    this.stateManager.recordBugInjectionSuccess(participant);
  }

  recordBugInjectionFailure(participant: ParticipantId): void {
    const state = this.stateManager.getCurrentState();
    ParticipantValidator.validateNotBaselineAuthor(participant, state);

    this.scoreKeeper.adjustScore(participant, -1);
    this.scoreKeeper.incrementStat(participant, 'bugInjectionFailures');
    this.stateManager.recordBugInjectionFailure();
  }

  recordFixSuccess(participant: ParticipantId): void {
    const state = this.stateManager.getCurrentState();
    ParticipantValidator.validateNotBaselineAuthor(participant, state);
    ParticipantValidator.validateNotBugAuthor(participant, state);

    // Only first successful fixer gets the point
    const hasExistingSuccess = Array.from(state.fixAttempts.values()).some(success => success);
    if (!hasExistingSuccess) {
      this.scoreKeeper.adjustScore(participant, 1);
      this.scoreKeeper.incrementStat(participant, 'fixes');
    }

    this.stateManager.recordFixAttempt(participant, true);
  }

  recordFixFailure(participant: ParticipantId): void {
    const state = this.stateManager.getCurrentState();
    ParticipantValidator.validateNotBaselineAuthor(participant, state);
    ParticipantValidator.validateNotBugAuthor(participant, state);

    this.stateManager.recordFixAttempt(participant, false);
  }

  finishRound(): void {
    const state = this.stateManager.getCurrentState();

    // Award bug author points for failed fix attempts
    if (state.bugInjectionSuccess && state.bugAuthor) {
      const failedAttempts = Array.from(state.fixAttempts.values()).filter(
        success => !success
      ).length;

      if (failedAttempts > 0) {
        this.scoreKeeper.adjustScore(state.bugAuthor, failedAttempts);
        this.scoreKeeper.incrementStat(state.bugAuthor, 'bugsSolved', failedAttempts);
      }
    }

    this.stateManager.finishRound();
    this.completedRounds++;
    this.stateManager.reset();
  }

  getScore(participant: ParticipantId): number {
    return this.scoreKeeper.getScore(participant);
  }

  getFinalSummary(): GameSummary {
    const participantScores = this.scoreKeeper.getAllParticipants().map(participantId => ({
      participantId,
      score: this.scoreKeeper.getScore(ParticipantId.fromString(participantId)),
      details: this.scoreKeeper.getScoreCard(ParticipantId.fromString(participantId)),
    }));

    // Sort by score descending
    participantScores.sort((a, b) => b.score - a.score);

    return {
      participantScores,
      totalRounds: this.completedRounds,
    };
  }

  getCurrentRound(): number {
    const state = this.stateManager.getCurrentState();
    return state.roundNumber || 0;
  }

  getNextExpectedStep(): NextStep {
    return this.stateManager.getNextExpectedStep();
  }
}
