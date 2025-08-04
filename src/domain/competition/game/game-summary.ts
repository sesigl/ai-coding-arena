// ABOUTME: Game summary interfaces for final results reporting
// Defines structure for participant scores and overall game statistics

import { ScoreCard } from './score-card';

export interface ParticipantScore {
  readonly participantId: string;
  readonly score: number;
  readonly details: ScoreCard;
}

export interface GameSummary {
  readonly participantScores: ParticipantScore[];
  readonly totalRounds: number;
}
