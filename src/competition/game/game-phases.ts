// ABOUTME: Individual game phase classes implementing state pattern with next step logic
// Each phase knows its own next expected step and valid transitions

import { ParticipantId } from 'domain/competition-event/participant-id';
import { NextStep, NextStepType } from './next-step';

export abstract class GamePhase {
  abstract getNextExpectedStep(): NextStep;
}

export class IdlePhase extends GamePhase {
  getNextExpectedStep(): NextStep {
    return {
      type: NextStepType.WAITING_FOR_ROUND_START,
      description: 'Game is ready to start a new round',
    };
  }
}

export class BaselinePhase extends GamePhase {
  constructor(private readonly baselineAuthor: ParticipantId) {
    super();
  }

  getNextExpectedStep(): NextStep {
    return {
      type: NextStepType.WAITING_FOR_BASELINE,
      description: 'Waiting for baseline author to create baseline',
      expectedParticipant: this.baselineAuthor.getValue(),
    };
  }
}

export class BugInjectionPhase extends GamePhase {
  constructor(private readonly baselineAuthor: ParticipantId) {
    super();
  }

  getNextExpectedStep(): NextStep {
    return {
      type: NextStepType.WAITING_FOR_BUG_INJECTION,
      description: 'Waiting for participants to inject bugs',
      excludedParticipant: this.baselineAuthor.getValue(),
    };
  }
}

export class FixAttemptsPhase extends GamePhase {
  constructor(
    private readonly baselineAuthor: ParticipantId,
    private readonly bugAuthor: ParticipantId,
    private readonly fixAttempts: ReadonlyMap<string, boolean>
  ) {
    super();
  }

  getNextExpectedStep(): NextStep {
    if (this.fixAttempts.size > 0) {
      return {
        type: NextStepType.READY_TO_FINISH_ROUND,
        description: 'Round can be finished - bug injection completed and fix attempts made',
      };
    }

    return {
      type: NextStepType.WAITING_FOR_FIX_ATTEMPTS,
      description: 'Waiting for participants to attempt bug fixes',
      excludedParticipants: [this.baselineAuthor.getValue(), this.bugAuthor.getValue()],
    };
  }
}

export class RoundCompletePhase extends GamePhase {
  constructor(
    private readonly baselineSuccess: boolean,
    private readonly bugInjectionSuccess: boolean
  ) {
    super();
  }

  getNextExpectedStep(): NextStep {
    let description: string;

    if (!this.baselineSuccess) {
      description = 'Round can be finished - baseline failed';
    } else if (!this.bugInjectionSuccess) {
      description = 'Round can be finished - bug injection failed';
    } else {
      description = 'Round can be finished - bug injection completed and fix attempts made';
    }

    return {
      type: NextStepType.READY_TO_FINISH_ROUND,
      description,
    };
  }
}
