// ABOUTME: Tests for SimpleCompetitionRunner baseline creation workflow
// TDD approach with behavior-driven tests using real EventStore and MockProvider

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleCompetitionRunner } from './simple-runner';
import { EventStore } from 'infrastructure/event-store/event-store';
import { MockProvider } from 'providers/mock-provider/mock-provider';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SimpleCompetitionRunner', () => {
  let runner: SimpleCompetitionRunner;
  let eventStore: EventStore;
  let mockProvider: MockProvider;
  let competitionId: CompetitionId;
  let dbPath: string;

  beforeEach(async () => {
    // Create temporary database for each test
    dbPath = join(tmpdir(), `test-competition-${Date.now()}.db`);
    eventStore = new EventStore(dbPath);
    await eventStore.initialize();

    competitionId = new CompetitionId('test-competition');
    runner = new SimpleCompetitionRunner(eventStore, competitionId);
    mockProvider = new MockProvider();
  });

  afterEach(async () => {
    await eventStore.close();
  });

  describe('when running baseline creation', () => {
    it('should successfully create baseline with mock provider', async () => {
      const result = await runner.runBaseline(mockProvider);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const competitionResult = result.value;
        expect(competitionResult.success).toBe(true);
        expect(competitionResult.participantId).toBe('mock-provider');
        expect(competitionResult.message).toContain('baseline created');
      }
    });

    it('should log events during baseline creation', async () => {
      await runner.runBaseline(mockProvider);

      const eventsResult = await eventStore.getEventsByCompetition(competitionId);
      expect(eventsResult.isOk()).toBe(true);

      if (eventsResult.isOk()) {
        const events = eventsResult.value;
        expect(events.length).toBeGreaterThanOrEqual(2); // Start and completion events

        // Check for baseline creation started event
        const startEvent = events.find(e => e.getEventType() === 'baseline_creation_started');
        expect(startEvent).toBeDefined();
        expect(startEvent?.isSuccess()).toBe(true);

        // Check for baseline completed event
        const completedEvent = events.find(e => e.getEventType() === 'baseline_completed');
        expect(completedEvent).toBeDefined();
        expect(completedEvent?.isSuccess()).toBe(true);
      }
    });

    it('should clean up workspace after completion', async () => {
      const result = await runner.runBaseline(mockProvider);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const competitionResult = result.value;

        // Workspace should not exist after cleanup
        if (competitionResult.workspaceDir) {
          expect(existsSync(competitionResult.workspaceDir)).toBe(false);
        }
      }
    });
  });
});
