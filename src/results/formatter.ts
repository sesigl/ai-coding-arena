// ABOUTME: Results formatter for competition statistics and reporting
// Simple JSON output showing competition summary and phase results

import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { Phase } from 'domain/competition-event/phase';
import { EventType } from 'domain/competition-event/event-type';
import { EventStore } from 'infrastructure/event-store/event-store';
import { Result, ok, err } from 'neverthrow';

export interface CompetitionSummary {
  competitionId: string;
  startTime: Date | null;
  endTime: Date | null;
  participants: string[];
  phases: PhaseResult[];
  statistics: CompetitionStatistics;
}

export interface PhaseResult {
  phase: Phase;
  participant: string;
  success: boolean;
  duration: number | 'NOT_MEASURED';
  message?: string;
}

export interface CompetitionStatistics {
  totalPhases: number;
  successfulPhases: number;
  failedPhases: number;
  successRate: number;
  participantStats: Record<string, ParticipantStatistics>;
}

export interface ParticipantStatistics {
  totalPhases: number;
  successfulPhases: number;
  successRate: number;
  phases: {
    baseline: boolean | null;
    bugInjection: boolean | null;
    fixAttempt: boolean | null;
  };
}

export class ResultsFormatter {
  constructor(private readonly eventStore: EventStore) {}

  async formatCompetitionResults(
    competitionId: CompetitionId
  ): Promise<Result<CompetitionSummary, Error>> {
    const eventsResult = await this.eventStore.getEventsByCompetition(competitionId);
    if (eventsResult.isErr()) {
      return err(eventsResult.error);
    }

    const events = eventsResult.value;
    const summary = this.createCompetitionSummary(competitionId, events);
    return ok(summary);
  }

  private createCompetitionSummary(
    competitionId: CompetitionId,
    events: CompetitionEvent[]
  ): CompetitionSummary {
    const startEvent = events.find(e => e.getEventType() === EventType.COMPETITION_STARTED);
    const endEvent = events.find(e => e.getEventType() === EventType.COMPETITION_COMPLETED);

    const participants = this.extractParticipants(events);
    const phases = this.extractPhaseResults(events);
    const statistics = this.calculateStatistics(phases, participants);

    return {
      competitionId: competitionId.getValue(),
      startTime: startEvent?.getTimestamp() || null,
      endTime: endEvent?.getTimestamp() || null,
      participants,
      phases,
      statistics,
    };
  }

  private extractParticipants(events: CompetitionEvent[]): string[] {
    const participantSet = new Set<string>();

    for (const event of events) {
      if (!event.isSystemEvent()) {
        participantSet.add(event.getParticipantId().getValue());
      }
    }

    return Array.from(participantSet).sort();
  }

  private extractPhaseResults(events: CompetitionEvent[]): PhaseResult[] {
    const phaseResults: PhaseResult[] = [];

    const completionEvents = events.filter(
      event =>
        event.getEventType() === EventType.BASELINE_COMPLETED ||
        event.getEventType() === EventType.BUG_INJECTION_COMPLETED ||
        event.getEventType() === EventType.FIX_ATTEMPT_COMPLETED
    );

    for (const event of completionEvents) {
      if (event.isSystemEvent()) continue;

      const phase = event.getPhase();
      const participant = event.getParticipantId().getValue();
      const success = event.isSuccess();
      const duration = event.getDuration().getValue();
      const message = event.getData().message as string | undefined;

      phaseResults.push({
        phase,
        participant,
        success,
        duration,
        ...(message && { message }),
      });
    }

    return phaseResults.sort((a, b) => a.participant.localeCompare(b.participant));
  }

  private calculateStatistics(
    phases: PhaseResult[],
    participants: string[]
  ): CompetitionStatistics {
    const totalPhases = phases.length;
    const successfulPhases = phases.filter(p => p.success).length;
    const failedPhases = totalPhases - successfulPhases;
    const successRate = totalPhases > 0 ? successfulPhases / totalPhases : 0;

    const participantStats: Record<string, ParticipantStatistics> = {};

    for (const participant of participants) {
      const participantPhases = phases.filter(p => p.participant === participant);
      const participantSuccessful = participantPhases.filter(p => p.success).length;
      const participantTotal = participantPhases.length;
      const participantSuccessRate =
        participantTotal > 0 ? participantSuccessful / participantTotal : 0;

      const baselinePhase = participantPhases.find(p => p.phase === Phase.BASELINE);
      const bugInjectionPhase = participantPhases.find(p => p.phase === Phase.BUG_INJECTION);
      const fixAttemptPhase = participantPhases.find(p => p.phase === Phase.FIX_ATTEMPT);

      participantStats[participant] = {
        totalPhases: participantTotal,
        successfulPhases: participantSuccessful,
        successRate: participantSuccessRate,
        phases: {
          baseline: baselinePhase?.success ?? null,
          bugInjection: bugInjectionPhase?.success ?? null,
          fixAttempt: fixAttemptPhase?.success ?? null,
        },
      };
    }

    return {
      totalPhases,
      successfulPhases,
      failedPhases,
      successRate,
      participantStats,
    };
  }

  formatAsJson(summary: CompetitionSummary): string {
    return JSON.stringify(summary, null, 2);
  }
}
