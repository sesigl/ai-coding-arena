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
});