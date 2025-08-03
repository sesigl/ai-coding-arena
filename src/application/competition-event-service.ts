// ABOUTME: Competition event logging service with standardized event creation and storage
// Centralizes event logging patterns and provides consistent error handling

import { EventStore } from 'infrastructure/event-store/event-store';
import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { EventId } from 'domain/competition-event/event-id';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { RoundId } from 'domain/competition-event/round-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';
import { Duration } from 'domain/competition-event/duration';
import { Result, ok, err } from 'neverthrow';

export class CompetitionEventService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly competitionId: CompetitionId
  ) {}

  async logParticipantEvent(
    eventType: EventType,
    phase: Phase,
    participantId: ParticipantId,
    data: Record<string, unknown>,
    success: boolean,
    duration: Duration = Duration.notMeasured()
  ): Promise<Result<void, Error>> {
    const event = new CompetitionEvent(
      this.generateEventId(),
      new Date(),
      this.competitionId,
      RoundId.notApplicable(),
      participantId,
      eventType,
      phase,
      data,
      success,
      duration
    );

    const result = await this.eventStore.insertEvent(event);
    if (result.isErr()) {
      return err(new Error(`Failed to log participant event: ${result.error.message}`));
    }

    return ok(undefined);
  }

  async logSystemEvent(
    eventType: EventType,
    phase: Phase,
    data: Record<string, unknown>
  ): Promise<Result<void, Error>> {
    const event = new CompetitionEvent(
      this.generateEventId(),
      new Date(),
      this.competitionId,
      RoundId.notApplicable(),
      ParticipantId.system(),
      eventType,
      phase,
      data,
      true, // System events are always "successful"
      Duration.notMeasured()
    );

    const result = await this.eventStore.insertEvent(event);
    if (result.isErr()) {
      return err(new Error(`Failed to log system event: ${result.error.message}`));
    }

    return ok(undefined);
  }

  async logPhaseStart(
    eventType: EventType,
    phase: Phase,
    participantId: ParticipantId,
    data: Record<string, unknown>
  ): Promise<Result<void, Error>> {
    return this.logParticipantEvent(eventType, phase, participantId, data, true);
  }

  async logPhaseComplete(
    eventType: EventType,
    phase: Phase,
    participantId: ParticipantId,
    data: Record<string, unknown>,
    success: boolean,
    duration: Duration
  ): Promise<Result<void, Error>> {
    return this.logParticipantEvent(eventType, phase, participantId, data, success, duration);
  }

  async logError(
    eventType: EventType,
    phase: Phase,
    participantId: ParticipantId,
    error: Error
  ): Promise<Result<void, Error>> {
    const data = {
      error: error.message,
      stack: error.stack,
    };

    return this.logParticipantEvent(eventType, phase, participantId, data, false);
  }

  private generateEventId(): EventId {
    return EventId.generate();
  }
}
