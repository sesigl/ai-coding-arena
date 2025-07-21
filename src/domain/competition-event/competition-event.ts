// ABOUTME: CompetitionEvent domain entity representing events in the system
// Rich domain object with behavior and factory methods for data conversion

import { EventId } from 'domain/competition-event/event-id';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { RoundId } from 'domain/competition-event/round-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { Duration } from 'domain/competition-event/duration';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';

export class CompetitionEvent {
  constructor(
    private readonly id: EventId,
    private readonly timestamp: Date,
    private readonly competitionId: CompetitionId,
    private readonly roundId: RoundId,
    private readonly participantId: ParticipantId,
    private readonly eventType: EventType,
    private readonly phase: Phase,
    private readonly data: Record<string, unknown>,
    private readonly success: boolean,
    private readonly duration: Duration
  ) {}

  getId(): EventId {
    return this.id;
  }

  getTimestamp(): Date {
    return new Date(this.timestamp.getTime());
  }

  getCompetitionId(): CompetitionId {
    return this.competitionId;
  }

  getRoundId(): RoundId {
    return this.roundId;
  }

  getParticipantId(): ParticipantId {
    return this.participantId;
  }

  getEventType(): EventType {
    return this.eventType;
  }

  getPhase(): Phase {
    return this.phase;
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  isSuccess(): boolean {
    return this.success;
  }

  getDuration(): Duration {
    return this.duration;
  }

  isSystemEvent(): boolean {
    return this.participantId.isSystem();
  }

  isRoundEvent(): boolean {
    return this.roundId.isNumeric();
  }

  static fromRawData(data: {
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
  }): CompetitionEvent {
    return new CompetitionEvent(
      new EventId(String(data.id)),
      data.timestamp,
      new CompetitionId(data.competition_id),
      typeof data.round_id === 'number'
        ? RoundId.fromNumber(data.round_id)
        : RoundId.notApplicable(),
      data.participant_id === 'SYSTEM'
        ? ParticipantId.system()
        : ParticipantId.fromString(data.participant_id),
      data.event_type as EventType,
      data.phase as Phase,
      data.data,
      data.success,
      typeof data.duration_seconds === 'number'
        ? Duration.fromSeconds(data.duration_seconds)
        : Duration.notMeasured()
    );
  }

  toRawData(): {
    id: number;
    timestamp: Date;
    competition_id: string;
    round_id: number | 'NOT_APPLICABLE';
    participant_id: string;
    event_type: string;
    phase: string;
    data: Record<string, unknown>;
    success: boolean;
    duration_seconds: number | 'NOT_MEASURED';
  } {
    return {
      id: this.id.getValue(),
      timestamp: this.timestamp,
      competition_id: this.competitionId.getValue(),
      round_id: this.roundId.getValue(),
      participant_id: this.participantId.getValue(),
      event_type: this.eventType,
      phase: this.phase,
      data: this.data,
      success: this.success,
      duration_seconds: this.duration.getValue(),
    };
  }
}
