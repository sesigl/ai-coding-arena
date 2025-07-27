// ABOUTME: Score tracking and management for competition participants
// Maintains point totals and detailed statistics across multiple rounds

import { ParticipantId } from 'domain/competition-event/participant-id';
import { ScoreCard } from './score-card';

export class ScoreKeeper {
  private readonly scores = new Map<string, number>();
  private readonly scorecards = new Map<string, ScoreCard>();

  adjustScore(participant: ParticipantId, delta: number): void {
    const current = this.scores.get(participant.getValue()) ?? 0;
    this.scores.set(participant.getValue(), current + delta);
  }

  incrementStat(participant: ParticipantId, stat: keyof ScoreCard, amount = 1): void {
    const current = this.scorecards.get(participant.getValue()) ?? this.createEmptyScoreCard();
    const updated = { ...current, [stat]: current[stat] + amount };
    this.scorecards.set(participant.getValue(), updated);
  }

  getScore(participant: ParticipantId): number {
    return this.scores.get(participant.getValue()) ?? 0;
  }

  getScoreCard(participant: ParticipantId): ScoreCard {
    return this.scorecards.get(participant.getValue()) ?? this.createEmptyScoreCard();
  }

  getAllParticipants(): string[] {
    const participants = new Set([...this.scores.keys(), ...this.scorecards.keys()]);
    return Array.from(participants);
  }

  private createEmptyScoreCard(): ScoreCard {
    return { fixes: 0, bugsSolved: 0, baselineFailures: 0, bugInjectionFailures: 0 };
  }
}
