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

  describe('when running a competition', () => {
    it('should run complete workflow: baseline creation, bug injection, and fix attempt', async () => {
      const result = await runner.runCompetition(mockProvider);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const competitionResult = result.value;
        expect(competitionResult.success).toBe(true);
        expect(competitionResult.participantId).toBe('mock-provider');
        expect(competitionResult.message).toContain('Three-phase workflow completed');
      }
    });

    it('should log events for all three phases', async () => {
      await runner.runCompetition(mockProvider);

      const eventsResult = await eventStore.getEventsByCompetition(competitionId);
      expect(eventsResult.isOk()).toBe(true);

      if (eventsResult.isOk()) {
        const events = eventsResult.value;
        expect(events.length).toBeGreaterThanOrEqual(6);

        const baselineStartEvent = events.find(
          e => e.getEventType() === 'baseline_creation_started'
        );
        expect(baselineStartEvent).toBeDefined();

        const baselineCompletedEvent = events.find(e => e.getEventType() === 'baseline_completed');
        expect(baselineCompletedEvent).toBeDefined();

        const bugInjectionStartEvent = events.find(
          e => e.getEventType() === 'bug_injection_started'
        );
        expect(bugInjectionStartEvent).toBeDefined();

        const bugInjectionCompletedEvent = events.find(
          e => e.getEventType() === 'bug_injection_completed'
        );
        expect(bugInjectionCompletedEvent).toBeDefined();

        const fixAttemptStartEvent = events.find(e => e.getEventType() === 'fix_attempt_started');
        expect(fixAttemptStartEvent).toBeDefined();

        const fixAttemptCompletedEvent = events.find(
          e => e.getEventType() === 'fix_attempt_completed'
        );
        expect(fixAttemptCompletedEvent).toBeDefined();
      }
    });

    it('should clean up all workspaces after completion', async () => {
      const result = await runner.runCompetition(mockProvider);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const competitionResult = result.value;

        if (competitionResult.workspaceDir) {
          expect(existsSync(competitionResult.workspaceDir)).toBe(false);
        }
      }
    });

    it('should handle baseline creation failure gracefully', async () => {
      const failingProvider = {
        name: 'failing-provider',
        createCodingExercise: async () => ({ success: false, message: 'Baseline failed' }),
        injectBug: async () => ({ success: true, message: 'Bug injected' }),
        fixAttempt: async () => ({ success: true, message: 'Fix applied' }),
      };

      const result = await runner.runCompetition(failingProvider);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.success).toBe(false);
        expect(result.value.message).toContain('Baseline creation failed');
      }
    });

    it('should handle bug injection failure gracefully', async () => {
      const failingProvider = {
        name: 'failing-provider',
        createCodingExercise: async () => ({ success: true, message: 'Baseline created' }),
        injectBug: async () => ({ success: false, message: 'Bug injection failed' }),
        fixAttempt: async () => ({ success: true, message: 'Fix applied' }),
      };

      const result = await runner.runCompetition(failingProvider);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.success).toBe(false);
        expect(result.value.message).toContain('Bug injection failed');
      }
    });
  });
});
