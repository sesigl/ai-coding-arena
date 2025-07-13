// ABOUTME: Test file for EventStore class functionality
// Tests event storage, retrieval, and basic operations with DuckDB

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventStore } from './event-store';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { TestEventFactory } from '../../test-utils/test-event-factory';
import { TestAssertions } from '../../test-utils/test-assertions';


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
        TestEventFactory.createBasicEvent({ id: 1, competitionId: 'comp-1' }),
        TestEventFactory.createBasicEvent({ id: 2, competitionId: 'comp-2' })
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
        TestEventFactory.createBasicEvent({ id: 1, competitionId: 'comp-1' }),
        TestEventFactory.createBasicEvent({ id: 2, competitionId: 'comp-1' }),
        TestEventFactory.createBasicEvent({ id: 3, competitionId: 'comp-2' })
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
        TestEventFactory.createBasicEvent({ id: 1, participantId: 'claude-code' }),
        TestEventFactory.createBasicEvent({ id: 2, participantId: 'gemini-cli' }),
        TestEventFactory.createBasicEvent({ id: 3, participantId: 'claude-code' })
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
        TestEventFactory.createBasicEvent({ id: 1, eventType: EventType.BASELINE_CREATION_STARTED }),
        TestEventFactory.createBasicEvent({ id: 2, eventType: EventType.BASELINE_CREATION_STARTED }),
        TestEventFactory.createBasicEvent({ id: 3, eventType: EventType.BUG_INJECTION_STARTED })
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
      // For count test, no specific field values matter - just need 3 events
      const events = [
        TestEventFactory.createBasicEvent({ id: 1 }),
        TestEventFactory.createBasicEvent({ id: 2 }),
        TestEventFactory.createBasicEvent({ id: 3 })
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