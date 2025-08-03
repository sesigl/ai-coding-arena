// ABOUTME: Unified test factory for CompetitionEvent creation and raw data generation
// Provides clean factory methods with overrides pattern to reduce test boilerplate

import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { EventId } from 'domain/competition-event/event-id';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { RoundId } from 'domain/competition-event/round-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { Duration } from 'domain/competition-event/duration';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';

type EventOverrides = Partial<{
  id: string;
  timestamp: Date;
  competitionId: string;
  roundId: number | 'NOT_APPLICABLE';
  participantId: string | 'SYSTEM';
  eventType: EventType;
  phase: Phase;
  data: Record<string, unknown>;
  success: boolean;
  durationSeconds: number | 'NOT_MEASURED';
}>;

type RawDataOverrides = Partial<{
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
}>;

export class CompetitionEventFactory {
  static create(overrides: EventOverrides = {}): CompetitionEvent {
    const timestamp = overrides.timestamp ?? new Date('2024-01-01');
    const competitionId = overrides.competitionId ?? 'test-comp';
    const eventType = overrides.eventType ?? EventType.BASELINE_CREATION_STARTED;
    const phase = overrides.phase ?? Phase.BASELINE;
    const data = overrides.data ?? { message: 'Test event' };
    const success = overrides.success ?? true;

    return new CompetitionEvent(
      overrides.id ? new EventId(overrides.id) : EventId.generate(),
      timestamp,
      new CompetitionId(competitionId),
      this.createRoundId(overrides.roundId),
      this.createParticipantId(overrides.participantId),
      eventType,
      phase,
      data,
      success,
      this.createDuration(overrides.durationSeconds)
    );
  }

  static createSystemEvent(overrides: Partial<EventOverrides> = {}): CompetitionEvent {
    return this.create({
      eventType: EventType.COMPETITION_STARTED,
      phase: Phase.SYSTEM,
      participantId: 'SYSTEM',
      roundId: 'NOT_APPLICABLE',
      durationSeconds: 'NOT_MEASURED',
      data: {},
      ...overrides,
    });
  }

  static createRawData(overrides: RawDataOverrides = {}) {
    const defaults = {
      id: 'raw-event-1',
      timestamp: new Date('2024-01-01'),
      competition_id: 'test-comp',
      round_id: 1,
      participant_id: 'test-participant',
      event_type: 'baseline_creation_started',
      phase: 'baseline',
      data: { message: 'Test event' },
      success: true,
      duration_seconds: 10,
    };

    return { ...defaults, ...overrides };
  }

  private static createRoundId(roundId?: number | 'NOT_APPLICABLE'): RoundId {
    if (roundId === 'NOT_APPLICABLE') {
      return RoundId.notApplicable();
    }
    return RoundId.fromNumber(roundId ?? 1);
  }

  private static createParticipantId(participantId?: string | 'SYSTEM'): ParticipantId {
    if (participantId === 'SYSTEM') {
      return ParticipantId.system();
    }
    return ParticipantId.fromString(participantId ?? 'test-participant');
  }

  private static createDuration(seconds?: number | 'NOT_MEASURED'): Duration {
    if (seconds === 'NOT_MEASURED') {
      return Duration.notMeasured();
    }
    return Duration.fromSeconds(seconds ?? 10);
  }
}
