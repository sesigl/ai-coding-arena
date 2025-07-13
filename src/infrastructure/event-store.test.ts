// ABOUTME: Test file for EventStore class functionality
// Tests event storage, retrieval, and basic operations with DuckDB

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventStore } from './event-store';
import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { EventId } from 'domain/competition-event/event-id';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { RoundId } from 'domain/competition-event/round-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';
import { Duration } from 'domain/competition-event/duration';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { Result } from 'neverthrow';

// Test helpers to reduce duplication and improve readability
const TestEventFactory = {
  createBasicEvent(overrides: Partial<{
    id: number;
    competitionId: string;
    roundId: number | 'NOT_APPLICABLE';
    participantId: string;
    eventType: EventType;
    phase: Phase;
    success: boolean;
    durationSeconds: number | 'NOT_MEASURED';
  }> = {}): CompetitionEvent {
    return new CompetitionEvent(
      new EventId(overrides.id ?? 1),
      new Date(),
      new CompetitionId(overrides.competitionId ?? 'test-comp'),
      overrides.roundId === 'NOT_APPLICABLE' ? RoundId.notApplicable() : RoundId.fromNumber(overrides.roundId ?? 1),
      overrides.participantId === 'SYSTEM' ? ParticipantId.system() : ParticipantId.fromString(overrides.participantId ?? 'test-participant'),
      overrides.eventType ?? EventType.COMPETITION_STARTED,
      overrides.phase ?? Phase.SYSTEM,
      { message: 'Test event' },
      overrides.success ?? true,
      overrides.durationSeconds === 'NOT_MEASURED' ? Duration.notMeasured() : Duration.fromSeconds(overrides.durationSeconds ?? 5)
    );
  }
};

const TestAssertions = {
  expectResultOk<T>(result: Result<T, Error>): void {
    if (result.isErr()) {
      console.error('Unexpected error:', result.error);
    }
    expect(result.isOk()).toBe(true);
  },

  expectEventArrayLength<T extends CompetitionEvent[]>(
    result: Result<T, Error>, 
    expectedLength: number
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      expect(result.value).toHaveLength(expectedLength);
    }
  },

  expectAllEventsHaveCompetition(
    result: Result<CompetitionEvent[], Error>,
    expectedCompetitionId: string
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      result.value.forEach((event: CompetitionEvent) => {
        expect(event.getCompetitionId().getValue()).toBe(expectedCompetitionId);
      });
    }
  },

  expectAllEventsHaveParticipant(
    result: Result<CompetitionEvent[], Error>,
    expectedParticipantId: string
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      result.value.forEach((event: CompetitionEvent) => {
        expect(event.getParticipantId().getValue()).toBe(expectedParticipantId);
      });
    }
  },

  expectAllEventsHaveType(
    result: Result<CompetitionEvent[], Error>,
    expectedEventType: EventType
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      result.value.forEach((event: CompetitionEvent) => {
        expect(event.getEventType()).toBe(expectedEventType);
      });
    }
  }
};

describe('EventStore', () => {
  let eventStore: EventStore;
  const testDbPath = './testdata/test-events.duckdb';

  beforeEach(async () => {
    // Ensure testdata directory exists
    if (!existsSync('./testdata')) {
      await mkdir('./testdata', { recursive: true });
    }
    
    eventStore = new EventStore(testDbPath);
    await eventStore.initialize();
  });

  afterEach(async () => {
    await eventStore.close();
    try {
      await unlink(testDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('initialization', () => {
    it('should create database and tables successfully', async () => {
      // Test that initialization doesn't throw
      expect(eventStore).toBeDefined();
    });
  });

  describe('insertEvent', () => {
    it('should insert a basic event successfully', async () => {
      const event = TestEventFactory.createBasicEvent({
        id: 1,
        competitionId: 'test-comp-1',
        participantId: 'claude-code'
      });

      const result = await eventStore.insertEvent(event);
      TestAssertions.expectResultOk(result);
    });

    it('should handle system events with explicit values', async () => {
      const event = TestEventFactory.createBasicEvent({
        id: 2,
        competitionId: 'test-comp-2',
        roundId: 'NOT_APPLICABLE',
        participantId: 'SYSTEM',
        durationSeconds: 'NOT_MEASURED'
      });

      const result = await eventStore.insertEvent(event);
      TestAssertions.expectResultOk(result);
    });
  });

  describe('getEvents', () => {
    beforeEach(async () => {
      const events = [
        TestEventFactory.createBasicEvent({
          id: 1,
          competitionId: 'comp-1',
          roundId: 'NOT_APPLICABLE',
          participantId: 'SYSTEM',
          eventType: EventType.COMPETITION_STARTED,
          durationSeconds: 'NOT_MEASURED'
        }),
        TestEventFactory.createBasicEvent({
          id: 2,
          competitionId: 'comp-2',
          roundId: 1,
          participantId: 'SYSTEM',
          eventType: EventType.ROUND_STARTED,
          durationSeconds: 'NOT_MEASURED'
        })
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve all events', async () => {
      const result = await eventStore.getEvents();
      TestAssertions.expectEventArrayLength(result, 2);
      
      if (result.isOk()) {
        expect(result.value[0]?.getCompetitionId().getValue()).toBe('comp-1');
        expect(result.value[1]?.getCompetitionId().getValue()).toBe('comp-2');
      }
    });
  });

  describe('getEventsByCompetition', () => {
    beforeEach(async () => {
      const events = [
        TestEventFactory.createBasicEvent({
          id: 1,
          competitionId: 'comp-1',
          roundId: 'NOT_APPLICABLE',
          participantId: 'SYSTEM',
          eventType: EventType.COMPETITION_STARTED,
          durationSeconds: 'NOT_MEASURED'
        }),
        TestEventFactory.createBasicEvent({
          id: 2,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'claude-code',
          eventType: EventType.ROUND_STARTED,
          phase: Phase.BASELINE,
          durationSeconds: 10
        }),
        TestEventFactory.createBasicEvent({
          id: 3,
          competitionId: 'comp-2',
          roundId: 1,
          participantId: 'SYSTEM',
          eventType: EventType.COMPETITION_STARTED,
          durationSeconds: 'NOT_MEASURED'
        })
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve events for specific competition', async () => {
      const competitionId = new CompetitionId('comp-1');
      const result = await eventStore.getEventsByCompetition(competitionId);
      
      TestAssertions.expectEventArrayLength(result, 2);
      TestAssertions.expectAllEventsHaveCompetition(result, 'comp-1');
    });
  });

  describe('getEventsByParticipant', () => {
    beforeEach(async () => {
      const events = [
        TestEventFactory.createBasicEvent({
          id: 1,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'claude-code',
          eventType: EventType.BASELINE_CREATION_STARTED,
          phase: Phase.BASELINE,
          durationSeconds: 5
        }),
        TestEventFactory.createBasicEvent({
          id: 2,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'gemini-cli',
          eventType: EventType.BUG_INJECTION_STARTED,
          phase: Phase.BUG_INJECTION,
          durationSeconds: 8
        }),
        TestEventFactory.createBasicEvent({
          id: 3,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'claude-code',
          eventType: EventType.FIX_ATTEMPT_STARTED,
          phase: Phase.FIX_ATTEMPT,
          success: false,
          durationSeconds: 15
        })
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve events for specific participant', async () => {
      const participantId = ParticipantId.fromString('claude-code');
      const result = await eventStore.getEventsByParticipant(participantId);
      
      TestAssertions.expectEventArrayLength(result, 2);
      TestAssertions.expectAllEventsHaveParticipant(result, 'claude-code');
    });
  });

  describe('getEventsByType', () => {
    beforeEach(async () => {
      const events = [
        TestEventFactory.createBasicEvent({
          id: 1,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'claude-code',
          eventType: EventType.BASELINE_CREATION_STARTED,
          phase: Phase.BASELINE,
          durationSeconds: 5
        }),
        TestEventFactory.createBasicEvent({
          id: 2,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'gemini-cli',
          eventType: EventType.BASELINE_CREATION_STARTED,
          phase: Phase.BASELINE,
          durationSeconds: 8
        }),
        TestEventFactory.createBasicEvent({
          id: 3,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'claude-code',
          eventType: EventType.BUG_INJECTION_STARTED,
          phase: Phase.BUG_INJECTION,
          success: false,
          durationSeconds: 12
        })
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve events for specific event type', async () => {
      const result = await eventStore.getEventsByType(EventType.BASELINE_CREATION_STARTED);
      
      TestAssertions.expectEventArrayLength(result, 2);
      TestAssertions.expectAllEventsHaveType(result, EventType.BASELINE_CREATION_STARTED);
    });
  });

  describe('getEventCount', () => {
    beforeEach(async () => {
      const events = [
        TestEventFactory.createBasicEvent({
          id: 1,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'claude-code',
          eventType: EventType.BASELINE_CREATION_STARTED,
          phase: Phase.BASELINE,
          durationSeconds: 5
        }),
        TestEventFactory.createBasicEvent({
          id: 2,
          competitionId: 'comp-1',
          roundId: 1,
          participantId: 'gemini-cli',
          eventType: EventType.BUG_INJECTION_STARTED,
          phase: Phase.BUG_INJECTION,
          durationSeconds: 8
        }),
        TestEventFactory.createBasicEvent({
          id: 3,
          competitionId: 'comp-2',
          roundId: 1,
          participantId: 'claude-code',
          eventType: EventType.BASELINE_CREATION_STARTED,
          phase: Phase.BASELINE,
          success: false,
          durationSeconds: 12
        })
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should count all events', async () => {
      const result = await eventStore.getEventCount();
      
      TestAssertions.expectResultOk(result);
      if (result.isOk()) {
        expect(result.value).toBe(3);
      }
    });
  });
});