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
      const event = new CompetitionEvent(
        new EventId(1),
        new Date(),
        new CompetitionId('test-comp-1'),
        RoundId.fromNumber(1),
        ParticipantId.fromString('claude-code'),
        EventType.COMPETITION_STARTED,
        Phase.SYSTEM,
        { message: 'Test competition started' },
        true,
        Duration.fromSeconds(5)
      );

      const result = await eventStore.insertEvent(event);
      if (result.isErr()) {
        console.error('Insert error:', result.error);
      }
      expect(result.isOk()).toBe(true);
    });

    it('should handle system events with explicit values', async () => {
      const event = new CompetitionEvent(
        new EventId(2),
        new Date(),
        new CompetitionId('test-comp-2'),
        RoundId.notApplicable(),
        ParticipantId.system(),
        EventType.COMPETITION_STARTED,
        Phase.SYSTEM,
        { message: 'Test event' },
        true,
        Duration.notMeasured()
      );

      const result = await eventStore.insertEvent(event);
      if (result.isErr()) {
        console.error('Insert error:', result.error);
      }
      expect(result.isOk()).toBe(true);
    });
  });

  describe('getEvents', () => {
    beforeEach(async () => {
      const events = [
        new CompetitionEvent(
          new EventId(1),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.notApplicable(),
          ParticipantId.system(),
          EventType.COMPETITION_STARTED,
          Phase.SYSTEM,
          { message: 'Competition 1 started' },
          true,
          Duration.notMeasured()
        ),
        new CompetitionEvent(
          new EventId(2),
          new Date(),
          new CompetitionId('comp-2'),
          RoundId.fromNumber(1),
          ParticipantId.system(),
          EventType.ROUND_STARTED,
          Phase.SYSTEM,
          { round: 1 },
          true,
          Duration.notMeasured()
        )
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve all events', async () => {
      const result = await eventStore.getEvents();
      if (result.isErr()) {
        console.error('Get events error:', result.error);
      }
      expect(result.isOk()).toBe(true);
      
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.getCompetitionId().getValue()).toBe('comp-1');
        expect(result.value[1]?.getCompetitionId().getValue()).toBe('comp-2');
      }
    });
  });

  describe('getEventsByCompetition', () => {
    beforeEach(async () => {
      const events = [
        new CompetitionEvent(
          new EventId(1),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.notApplicable(),
          ParticipantId.system(),
          EventType.COMPETITION_STARTED,
          Phase.SYSTEM,
          { message: 'Competition 1 started' },
          true,
          Duration.notMeasured()
        ),
        new CompetitionEvent(
          new EventId(2),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('claude-code'),
          EventType.ROUND_STARTED,
          Phase.BASELINE,
          { round: 1 },
          true,
          Duration.fromSeconds(10)
        ),
        new CompetitionEvent(
          new EventId(3),
          new Date(),
          new CompetitionId('comp-2'),
          RoundId.fromNumber(1),
          ParticipantId.system(),
          EventType.COMPETITION_STARTED,
          Phase.SYSTEM,
          { message: 'Different competition' },
          true,
          Duration.notMeasured()
        )
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve events for specific competition', async () => {
      const competitionId = new CompetitionId('comp-1');
      const result = await eventStore.getEventsByCompetition(competitionId);
      
      expect(result.isOk()).toBe(true);
      
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        result.value.forEach((event: CompetitionEvent) => {
          expect(event.getCompetitionId().getValue()).toBe('comp-1');
        });
      }
    });
  });

  describe('getEventsByParticipant', () => {
    beforeEach(async () => {
      const events = [
        new CompetitionEvent(
          new EventId(1),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('claude-code'),
          EventType.BASELINE_CREATION_STARTED,
          Phase.BASELINE,
          { message: 'Claude baseline started' },
          true,
          Duration.fromSeconds(5)
        ),
        new CompetitionEvent(
          new EventId(2),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('gemini-cli'),
          EventType.BUG_INJECTION_STARTED,
          Phase.BUG_INJECTION,
          { message: 'Gemini bug injection' },
          true,
          Duration.fromSeconds(8)
        ),
        new CompetitionEvent(
          new EventId(3),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('claude-code'),
          EventType.FIX_ATTEMPT_STARTED,
          Phase.FIX_ATTEMPT,
          { message: 'Claude fix attempt' },
          false,
          Duration.fromSeconds(15)
        )
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve events for specific participant', async () => {
      const participantId = ParticipantId.fromString('claude-code');
      const result = await eventStore.getEventsByParticipant(participantId);
      
      expect(result.isOk()).toBe(true);
      
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        result.value.forEach((event: CompetitionEvent) => {
          expect(event.getParticipantId().getValue()).toBe('claude-code');
        });
      }
    });
  });

  describe('getEventsByType', () => {
    beforeEach(async () => {
      const events = [
        new CompetitionEvent(
          new EventId(1),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('claude-code'),
          EventType.BASELINE_CREATION_STARTED,
          Phase.BASELINE,
          { message: 'Baseline started' },
          true,
          Duration.fromSeconds(5)
        ),
        new CompetitionEvent(
          new EventId(2),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('gemini-cli'),
          EventType.BASELINE_CREATION_STARTED,
          Phase.BASELINE,
          { message: 'Another baseline' },
          true,
          Duration.fromSeconds(8)
        ),
        new CompetitionEvent(
          new EventId(3),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('claude-code'),
          EventType.BUG_INJECTION_STARTED,
          Phase.BUG_INJECTION,
          { message: 'Bug injection' },
          false,
          Duration.fromSeconds(12)
        )
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should retrieve events for specific event type', async () => {
      const result = await eventStore.getEventsByType(EventType.BASELINE_CREATION_STARTED);
      
      expect(result.isOk()).toBe(true);
      
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        result.value.forEach((event: CompetitionEvent) => {
          expect(event.getEventType()).toBe(EventType.BASELINE_CREATION_STARTED);
        });
      }
    });
  });

  describe('getEventCount', () => {
    beforeEach(async () => {
      const events = [
        new CompetitionEvent(
          new EventId(1),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('claude-code'),
          EventType.BASELINE_CREATION_STARTED,
          Phase.BASELINE,
          { message: 'Event 1' },
          true,
          Duration.fromSeconds(5)
        ),
        new CompetitionEvent(
          new EventId(2),
          new Date(),
          new CompetitionId('comp-1'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('gemini-cli'),
          EventType.BUG_INJECTION_STARTED,
          Phase.BUG_INJECTION,
          { message: 'Event 2' },
          true,
          Duration.fromSeconds(8)
        ),
        new CompetitionEvent(
          new EventId(3),
          new Date(),
          new CompetitionId('comp-2'),
          RoundId.fromNumber(1),
          ParticipantId.fromString('claude-code'),
          EventType.BASELINE_CREATION_STARTED,
          Phase.BASELINE,
          { message: 'Event 3' },
          false,
          Duration.fromSeconds(12)
        )
      ];

      for (const event of events) {
        await eventStore.insertEvent(event);
      }
    });

    it('should count all events', async () => {
      const result = await eventStore.getEventCount();
      
      expect(result.isOk()).toBe(true);
      
      if (result.isOk()) {
        expect(result.value).toBe(3);
      }
    });
  });
});