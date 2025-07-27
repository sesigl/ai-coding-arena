// ABOUTME: Type-safe definitions for game next step states and responses
// Provides exhaustive union types for game runner orchestration

export enum NextStepType {
  WAITING_FOR_ROUND_START = 'waiting_for_round_start',
  WAITING_FOR_BASELINE = 'waiting_for_baseline',
  WAITING_FOR_BUG_INJECTION = 'waiting_for_bug_injection',
  WAITING_FOR_FIX_ATTEMPTS = 'waiting_for_fix_attempts',
  READY_TO_FINISH_ROUND = 'ready_to_finish_round',
}

export type NextStep =
  | {
      type: NextStepType.WAITING_FOR_ROUND_START;
      description: string;
    }
  | {
      type: NextStepType.WAITING_FOR_BASELINE;
      description: string;
      expectedParticipant: string;
    }
  | {
      type: NextStepType.WAITING_FOR_BUG_INJECTION;
      description: string;
      excludedParticipant: string;
    }
  | {
      type: NextStepType.WAITING_FOR_FIX_ATTEMPTS;
      description: string;
      excludedParticipants: readonly string[];
    }
  | {
      type: NextStepType.READY_TO_FINISH_ROUND;
      description: string;
    };
