// ABOUTME: Test factory for creating CompetitionEvent instances with minimal required data
// Provides reusable event creation with overrides pattern to improve test readability

import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { EventId } from 'domain/competition-event/event-id';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { RoundId } from 'domain/competition-event/round-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';
import { Duration } from 'domain/competition-event/duration';

export const TestEventFactory = {
  createBasicEvent(
    overrides: Partial<{
      id: string;
      competitionId: string;
      roundId: number | 'NOT_APPLICABLE';
      participantId: string;
      eventType: EventType;
      phase: Phase;
      success: boolean;
      durationSeconds: number | 'NOT_MEASURED';
    }> = {}
  ): CompetitionEvent {
    return new CompetitionEvent(
      overrides.id ? new EventId(overrides.id) : EventId.generate(),
      new Date(),
      new CompetitionId(overrides.competitionId ?? 'test-comp'),
      overrides.roundId === 'NOT_APPLICABLE'
        ? RoundId.notApplicable()
        : RoundId.fromNumber(overrides.roundId ?? 1),
      overrides.participantId === 'SYSTEM'
        ? ParticipantId.system()
        : ParticipantId.fromString(overrides.participantId ?? 'test-participant'),
      overrides.eventType ?? EventType.COMPETITION_STARTED,
      overrides.phase ?? Phase.SYSTEM,
      { message: 'Test event' },
      overrides.success ?? true,
      overrides.durationSeconds === 'NOT_MEASURED'
        ? Duration.notMeasured()
        : Duration.fromSeconds(overrides.durationSeconds ?? 5)
    );
  },
};
