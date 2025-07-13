// ABOUTME: Test file for EventStore class functionality
// Tests event storage, retrieval, and basic operations with DuckDB

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventStore } from '../storage/event-store';
import { CompetitionEvent } from '../types/events';
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
      const event: CompetitionEvent = {
        id: 1,
        timestamp: new Date(),
        competition_id: 'test-comp-1',
        round_id: 1,
        participant_id: 'claude-code',
        event_type: 'competition_started',
        phase: 'system',
        data: { message: 'Test competition started' },
        success: true,
        duration_seconds: 5
      };

      const result = await eventStore.insertEvent(event);
      if (result.isErr()) {
        console.error('Insert error:', result.error);
      }
      expect(result.isOk()).toBe(true);
    });

    it('should handle system events with explicit values', async () => {
      const event: CompetitionEvent = {
        id: 2,
        timestamp: new Date(),
        competition_id: 'test-comp-2',
        round_id: 'NOT_APPLICABLE',
        participant_id: 'SYSTEM',
        event_type: 'competition_started',
        phase: 'system',
        data: { message: 'Test event' },
        success: true,
        duration_seconds: 'NOT_MEASURED'
      };

      const result = await eventStore.insertEvent(event);
      if (result.isErr()) {
        console.error('Insert error:', result.error);
      }
      expect(result.isOk()).toBe(true);
    });
  });

  describe('getEvents', () => {
    beforeEach(async () => {
      const events: CompetitionEvent[] = [
        {
          id: 1,
          timestamp: new Date(),
          competition_id: 'comp-1',
          round_id: 'NOT_APPLICABLE',
          participant_id: 'SYSTEM',
          event_type: 'competition_started',
          phase: 'system',
          data: { message: 'Competition 1 started' },
          success: true,
          duration_seconds: 'NOT_MEASURED'
        },
        {
          id: 2,
          timestamp: new Date(),
          competition_id: 'comp-2',
          round_id: 1,
          participant_id: 'SYSTEM',
          event_type: 'round_started',
          phase: 'system',
          data: { round: 1 },
          success: true,
          duration_seconds: 'NOT_MEASURED'
        }
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
        expect(result.value[0]?.competition_id).toBe('comp-1');
        expect(result.value[1]?.competition_id).toBe('comp-2');
      }
    });
  });
});