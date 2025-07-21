// ABOUTME: Test factory for CompetitionEvent creation and assertions
// Provides clean factory methods to reduce test boilerplate

import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { EventId } from 'domain/competition-event/event-id';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { RoundId } from 'domain/competition-event/round-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { Duration } from 'domain/competition-event/duration';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';

export class CompetitionEventFactory {
  static create(
    overrides: Partial<{
      id: string;
      timestamp: Date;
      competitionId: string;
      roundId: number;
      participantId: string;
      eventType: EventType;
      phase: Phase;
      data: Record<string, unknown>;
      success: boolean;
      durationSeconds: number;
    }> = {}
  ): CompetitionEvent {
    const defaults = {
      id: 'test-id-1',
      timestamp: new Date('2024-01-01'),
      competitionId: 'comp-1',
      roundId: 1,
      participantId: 'participant-1',
      eventType: EventType.BASELINE_CREATION_STARTED,
      phase: Phase.BASELINE,
      data: { key: 'value' },
      success: true,
      durationSeconds: 10,
    };

    const config = { ...defaults, ...overrides };

    return new CompetitionEvent(
      new EventId(config.id),
      config.timestamp,
      new CompetitionId(config.competitionId),
      RoundId.fromNumber(config.roundId),
      ParticipantId.fromString(config.participantId),
      config.eventType,
      config.phase,
      config.data,
      config.success,
      Duration.fromSeconds(config.durationSeconds)
    );
  }

  static createSystemEvent(): CompetitionEvent {
    return new CompetitionEvent(
      new EventId('system-event-1'),
      new Date(),
      new CompetitionId('comp-1'),
      RoundId.notApplicable(),
      ParticipantId.system(),
      EventType.COMPETITION_STARTED,
      Phase.SYSTEM,
      {},
      true,
      Duration.notMeasured()
    );
  }

  static createRawData(
    overrides: Partial<{
      id: number | string;
      timestamp: Date;
      competition_id: string;
      round_id: number | 'NOT_APPLICABLE';
      participant_id: string | 'SYSTEM';
      event_type: string;
      phase: string;
      data: Record<string, unknown>;
      success: boolean;
      duration_seconds: number | 'NOT_MEASURED';
    }> = {}
  ) {
    const defaults = {
      id: 'raw-event-1',
      timestamp: new Date('2024-01-01'),
      competition_id: 'comp-1',
      round_id: 1,
      participant_id: 'participant-1',
      event_type: 'baseline_creation_started',
      phase: 'baseline',
      data: { key: 'value' },
      success: true,
      duration_seconds: 10,
    };

    return { ...defaults, ...overrides };
  }
}
