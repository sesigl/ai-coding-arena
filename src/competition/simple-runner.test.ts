// ABOUTME: Tests for SimpleCompetitionRunner baseline creation workflow
// TDD approach with behavior-driven tests using real EventStore and MockProvider

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleCompetitionRunner } from './simple-runner';
import { EventStore } from 'infrastructure/event-store/event-store';
import { MockProvider } from 'providers/mock-provider/mock-provider';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { ResultsFormatter } from 'results/formatter';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';

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
    try {
      await unlink(dbPath);
    } catch {
      // Ignore cleanup errors
    }
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

  describe('end-to-end competition behavior with results integration', () => {
    it('should execute complete competition and generate expected results summary', async () => {
      // Given: A competition runner with real components (no mocks)
      const competitionId = new CompetitionId(`integration-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);
      const mockProvider = new MockProvider();
      const resultsFormatter = new ResultsFormatter(eventStore);

      // When: Running a complete competition
      const competitionResult = await runner.runCompetition(mockProvider);

      // Then: Competition should succeed
      expect(competitionResult.isOk()).toBe(true);

      const result = competitionResult._unsafeUnwrap();
      expect(result.success).toBe(true);
      expect(result.participantId).toBe('mock-provider');
      expect(result.message).toContain('Three-phase workflow completed');

      // And: Results summary should capture complete competition behavior
      const summaryResult = await resultsFormatter.formatCompetitionResults(competitionId);
      expect(summaryResult.isOk()).toBe(true);

      const summary = summaryResult._unsafeUnwrap();

      // Verify competition identity
      expect(summary.competitionId).toBe(competitionId.getValue());
      expect(summary.participants).toEqual(['mock-provider']);

      // Verify all three phases were executed successfully
      expect(summary.phases).toHaveLength(3);

      const baselinePhase = summary.phases.find(p => p.phase === 'baseline');
      expect(baselinePhase).toBeDefined();
      expect(baselinePhase?.success).toBe(true);
      expect(baselinePhase?.participant).toBe('mock-provider');
      expect(baselinePhase?.duration).toBe(0); // MockProvider uses 0 duration

      const bugInjectionPhase = summary.phases.find(p => p.phase === 'bug_injection');
      expect(bugInjectionPhase).toBeDefined();
      expect(bugInjectionPhase?.success).toBe(true);
      expect(bugInjectionPhase?.participant).toBe('mock-provider');

      const fixAttemptPhase = summary.phases.find(p => p.phase === 'fix_attempt');
      expect(fixAttemptPhase).toBeDefined();
      expect(fixAttemptPhase?.success).toBe(true);
      expect(fixAttemptPhase?.participant).toBe('mock-provider');

      // Verify overall statistics reflect successful competition
      expect(summary.statistics.totalPhases).toBe(3);
      expect(summary.statistics.successfulPhases).toBe(3);
      expect(summary.statistics.failedPhases).toBe(0);
      expect(summary.statistics.successRate).toBe(1.0);

      // Verify participant-specific statistics
      const participantStats = summary.statistics.participantStats['mock-provider'];
      expect(participantStats).toBeDefined();
      expect(participantStats?.totalPhases).toBe(3);
      expect(participantStats?.successfulPhases).toBe(3);
      expect(participantStats?.successRate).toBe(1.0);
      expect(participantStats?.phases.baseline).toBe(true);
      expect(participantStats?.phases.bugInjection).toBe(true);
      expect(participantStats?.phases.fixAttempt).toBe(true);

      // Verify JSON serialization works correctly
      const jsonOutput = resultsFormatter.formatAsJson(summary);
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      const parsedJson = JSON.parse(jsonOutput);
      expect(parsedJson.competitionId).toBe(competitionId.getValue());
      expect(parsedJson.statistics.successRate).toBe(1.0);
      expect(parsedJson.participants).toEqual(['mock-provider']);

      // Verify event trail exists for audit purposes
      const eventsResult = await eventStore.getEventsByCompetition(competitionId);
      expect(eventsResult.isOk()).toBe(true);

      const events = eventsResult._unsafeUnwrap();
      expect(events.length).toBeGreaterThanOrEqual(6); // At least start/end for each phase

      // Verify critical events are present
      const criticalEventTypes = [
        'baseline_creation_started',
        'baseline_completed',
        'bug_injection_started',
        'bug_injection_completed',
        'fix_attempt_started',
        'fix_attempt_completed',
      ];

      for (const eventType of criticalEventTypes) {
        const event = events.find(e => e.getEventType() === eventType);
        expect(event).toBeDefined();
        if (event) {
          expect(event.getParticipantId().getValue()).toBe('mock-provider');
          expect(event.getCompetitionId().getValue()).toBe(competitionId.getValue());
        }
      }
    });

    it('should handle partial failure and reflect it in results summary', async () => {
      // Given: A provider that fails at bug injection phase
      const partialFailureProvider = {
        name: 'partial-failure-provider',
        createCodingExercise: async () => ({
          success: true,
          message: 'Baseline created successfully',
        }),
        injectBug: async () => ({
          success: false,
          message: 'Bug injection failed due to test error',
        }),
        fixAttempt: async () => ({ success: true, message: 'Fix applied successfully' }),
      };

      const competitionId = new CompetitionId(`partial-failure-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);
      const resultsFormatter = new ResultsFormatter(eventStore);

      // When: Running the competition
      const competitionResult = await runner.runCompetition(partialFailureProvider);

      // Then: Competition should fail at bug injection
      expect(competitionResult.isOk()).toBe(true);

      const result = competitionResult._unsafeUnwrap();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Bug injection failed');

      // And: Results summary should accurately reflect the partial failure
      const summaryResult = await resultsFormatter.formatCompetitionResults(competitionId);
      expect(summaryResult.isOk()).toBe(true);

      const summary = summaryResult._unsafeUnwrap();

      // Should show only completed phases (baseline succeeded, bug injection failed, fix not attempted)
      expect(summary.phases).toHaveLength(2); // Only baseline and bug injection attempted

      const baselinePhase = summary.phases.find(p => p.phase === 'baseline');
      expect(baselinePhase?.success).toBe(true);

      const bugInjectionPhase = summary.phases.find(p => p.phase === 'bug_injection');
      expect(bugInjectionPhase?.success).toBe(false);

      // No fix attempt phase should be present since it wasn't reached
      const fixAttemptPhase = summary.phases.find(p => p.phase === 'fix_attempt');
      expect(fixAttemptPhase).toBeUndefined();

      // Statistics should reflect partial completion
      expect(summary.statistics.totalPhases).toBe(2);
      expect(summary.statistics.successfulPhases).toBe(1);
      expect(summary.statistics.failedPhases).toBe(1);
      expect(summary.statistics.successRate).toBe(0.5);

      // Participant stats should show mixed results
      const participantStats = summary.statistics.participantStats['partial-failure-provider'];
      expect(participantStats?.phases.baseline).toBe(true);
      expect(participantStats?.phases.bugInjection).toBe(false);
      expect(participantStats?.phases.fixAttempt).toBe(null); // Not attempted
    });
  });
});
