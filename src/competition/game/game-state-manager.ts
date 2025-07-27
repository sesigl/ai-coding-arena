// ABOUTME: State machine manager enforcing valid phase transitions in competition rounds
// Handles state mutations while maintaining immutability and validation

import { ParticipantId } from 'domain/competition-event/participant-id';
import { GameState } from './game-state';
import { GameError } from './game-error';
import {
  IdlePhase,
  BaselinePhase,
  BugInjectionPhase,
  FixAttemptsPhase,
  RoundCompletePhase,
} from './game-phases';
import { NextStep } from './next-step';

export class GameStateManager {
  private state: GameState = {
    phase: 'IDLE',
    phaseHandler: new IdlePhase(),
    baselineSuccess: false,
    bugInjectionSuccess: false,
    fixAttempts: new Map(),
  };

  getCurrentState(): GameState {
    return this.state;
  }

  startRound(roundNumber: number, author: ParticipantId): void {
    if (this.state.phase !== 'IDLE') {
      throw new GameError('Cannot start round while another is active');
    }

    this.state = {
      phase: 'BASELINE',
      phaseHandler: new BaselinePhase(author),
      roundNumber,
      baselineAuthor: author,
      baselineSuccess: false,
      bugInjectionSuccess: false,
      fixAttempts: new Map(),
    };
  }

  recordBaselineSuccess(): void {
    if (this.state.phase !== 'BASELINE') {
      throw new GameError('Not in baseline phase');
    }
    if (!this.state.baselineAuthor) {
      throw new GameError('Invalid state: baseline author not set');
    }

    this.state = {
      ...this.state,
      phase: 'BUG_INJECTION',
      phaseHandler: new BugInjectionPhase(this.state.baselineAuthor),
      baselineSuccess: true,
    };
  }

  recordBaselineFailure(): void {
    if (this.state.phase !== 'BASELINE') {
      throw new GameError('Not in baseline phase');
    }

    this.state = {
      ...this.state,
      phase: 'ROUND_COMPLETE',
      phaseHandler: new RoundCompletePhase(false, false),
      baselineSuccess: false,
    };
  }

  recordBugInjectionSuccess(author: ParticipantId): void {
    if (this.state.phase !== 'BUG_INJECTION') {
      throw new GameError('Not in bug injection phase');
    }
    if (!this.state.baselineAuthor) {
      throw new GameError('Invalid state: baseline author not set');
    }

    this.state = {
      ...this.state,
      phase: 'FIX_ATTEMPTS',
      phaseHandler: new FixAttemptsPhase(this.state.baselineAuthor, author, this.state.fixAttempts),
      bugAuthor: author,
      bugInjectionSuccess: true,
    };
  }

  recordBugInjectionFailure(): void {
    if (this.state.phase !== 'BUG_INJECTION') {
      throw new GameError('Not in bug injection phase');
    }

    this.state = {
      ...this.state,
      phase: 'ROUND_COMPLETE',
      phaseHandler: new RoundCompletePhase(true, false),
      bugInjectionSuccess: false,
    };
  }

  recordFixAttempt(participant: ParticipantId, success: boolean): void {
    if (this.state.phase !== 'FIX_ATTEMPTS') {
      throw new GameError('Not in fix attempts phase');
    }
    if (!this.state.baselineAuthor || !this.state.bugAuthor) {
      throw new GameError('Invalid state: baseline or bug author not set');
    }

    const newFixAttempts = new Map(this.state.fixAttempts);
    newFixAttempts.set(participant.getValue(), success);

    this.state = {
      ...this.state,
      phaseHandler: new FixAttemptsPhase(
        this.state.baselineAuthor,
        this.state.bugAuthor,
        newFixAttempts
      ),
      fixAttempts: newFixAttempts,
    };
  }

  finishRound(): void {
    if (this.state.phase !== 'FIX_ATTEMPTS' && this.state.phase !== 'ROUND_COMPLETE') {
      throw new GameError('Cannot finish incomplete round');
    }

    this.state = {
      ...this.state,
      phase: 'ROUND_COMPLETE',
      phaseHandler: new RoundCompletePhase(
        this.state.baselineSuccess,
        this.state.bugInjectionSuccess
      ),
    };
  }

  reset(): void {
    this.state = {
      phase: 'IDLE',
      phaseHandler: new IdlePhase(),
      baselineSuccess: false,
      bugInjectionSuccess: false,
      fixAttempts: new Map(),
    };
  }

  getNextExpectedStep(): NextStep {
    return this.state.phaseHandler.getNextExpectedStep();
  }
}
