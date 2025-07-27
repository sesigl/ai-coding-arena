// ABOUTME: Game state interface and types for competition phase management
// Defines immutable state structure for baseline, bug injection, and fix phases

import { ParticipantId } from 'domain/competition-event/participant-id';
import { GamePhase } from './game-phases';

export interface GameState {
  readonly phase: 'IDLE' | 'BASELINE' | 'BUG_INJECTION' | 'FIX_ATTEMPTS' | 'ROUND_COMPLETE';
  readonly phaseHandler: GamePhase;
  readonly roundNumber?: number;
  readonly baselineAuthor?: ParticipantId;
  readonly bugAuthor?: ParticipantId;
  readonly baselineSuccess: boolean;
  readonly bugInjectionSuccess: boolean;
  readonly fixAttempts: ReadonlyMap<string, boolean>;
}
