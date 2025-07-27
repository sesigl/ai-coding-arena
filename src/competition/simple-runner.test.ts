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
import { unlink, writeFile, cp } from 'fs/promises';

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
      // Database file might already be deleted
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
        createCodingExercise: async (workspaceDir: string, _prompt: string) => {
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "pass"'
          );
          return { success: true, message: 'Baseline created' };
        },
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
      const competitionId = new CompetitionId(`integration-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);
      const mockProvider = new MockProvider();
      const resultsFormatter = new ResultsFormatter(eventStore);

      const competitionResult = await runner.runCompetition(mockProvider);

      expect(competitionResult.isOk()).toBe(true);

      const result = competitionResult._unsafeUnwrap();
      expect(result.success).toBe(true);
      expect(result.participantId).toBe('mock-provider');
      expect(result.message).toContain('Three-phase workflow completed');

      const summaryResult = await resultsFormatter.formatCompetitionResults(competitionId);
      expect(summaryResult.isOk()).toBe(true);

      const summary = summaryResult._unsafeUnwrap();

      expect(summary.competitionId).toBe(competitionId.getValue());
      expect(summary.participants).toEqual(['mock-provider']);

      expect(summary.phases).toHaveLength(3);

      const baselinePhase = summary.phases.find(p => p.phase === 'baseline');
      expect(baselinePhase).toBeDefined();
      expect(baselinePhase?.success).toBe(true);
      expect(baselinePhase?.participant).toBe('mock-provider');
      expect(baselinePhase?.duration).toBe(0);

      const bugInjectionPhase = summary.phases.find(p => p.phase === 'bug_injection');
      expect(bugInjectionPhase).toBeDefined();
      expect(bugInjectionPhase?.success).toBe(true);
      expect(bugInjectionPhase?.participant).toBe('mock-provider');

      const fixAttemptPhase = summary.phases.find(p => p.phase === 'fix_attempt');
      expect(fixAttemptPhase).toBeDefined();
      expect(fixAttemptPhase?.success).toBe(true);
      expect(fixAttemptPhase?.participant).toBe('mock-provider');

      expect(summary.statistics.totalPhases).toBe(3);
      expect(summary.statistics.successfulPhases).toBe(3);
      expect(summary.statistics.failedPhases).toBe(0);
      expect(summary.statistics.successRate).toBe(1.0);

      const participantStats = summary.statistics.participantStats['mock-provider'];
      expect(participantStats).toBeDefined();
      expect(participantStats?.totalPhases).toBe(3);
      expect(participantStats?.successfulPhases).toBe(3);
      expect(participantStats?.successRate).toBe(1.0);
      expect(participantStats?.phases.baseline).toBe(true);
      expect(participantStats?.phases.bugInjection).toBe(true);
      expect(participantStats?.phases.fixAttempt).toBe(true);

      const jsonOutput = resultsFormatter.formatAsJson(summary);
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      const parsedJson = JSON.parse(jsonOutput);
      expect(parsedJson.competitionId).toBe(competitionId.getValue());
      expect(parsedJson.statistics.successRate).toBe(1.0);
      expect(parsedJson.participants).toEqual(['mock-provider']);

      const eventsResult = await eventStore.getEventsByCompetition(competitionId);
      expect(eventsResult.isOk()).toBe(true);

      const events = eventsResult._unsafeUnwrap();
      expect(events.length).toBeGreaterThanOrEqual(6);
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
      const partialFailureProvider = {
        name: 'partial-failure-provider',
        createCodingExercise: async (workspaceDir: string, _prompt: string) => {
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "pass"'
          );
          return { success: true, message: 'Baseline created successfully' };
        },
        injectBug: async () => ({
          success: false,
          message: 'Bug injection failed due to test error',
        }),
        fixAttempt: async () => ({ success: true, message: 'Fix applied successfully' }),
      };

      const competitionId = new CompetitionId(`partial-failure-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);
      const resultsFormatter = new ResultsFormatter(eventStore);

      const competitionResult = await runner.runCompetition(partialFailureProvider);
      expect(competitionResult.isOk()).toBe(true);

      const result = competitionResult._unsafeUnwrap();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Bug injection failed');

      const summaryResult = await resultsFormatter.formatCompetitionResults(competitionId);
      expect(summaryResult.isOk()).toBe(true);

      const summary = summaryResult._unsafeUnwrap();

      expect(summary.phases).toHaveLength(2);

      const baselinePhase = summary.phases.find(p => p.phase === 'baseline');
      expect(baselinePhase?.success).toBe(true);

      const bugInjectionPhase = summary.phases.find(p => p.phase === 'bug_injection');
      expect(bugInjectionPhase?.success).toBe(false);

      const fixAttemptPhase = summary.phases.find(p => p.phase === 'fix_attempt');
      expect(fixAttemptPhase).toBeUndefined();

      expect(summary.statistics.totalPhases).toBe(2);
      expect(summary.statistics.successfulPhases).toBe(1);
      expect(summary.statistics.failedPhases).toBe(1);
      expect(summary.statistics.successRate).toBe(0.5);
      const participantStats = summary.statistics.participantStats['partial-failure-provider'];
      expect(participantStats?.phases.baseline).toBe(true);
      expect(participantStats?.phases.bugInjection).toBe(false);
      expect(participantStats?.phases.fixAttempt).toBe(null);
    });
  });

  describe('when running multi-participant competitions', () => {
    it('should run multiple participants sequentially and track results per participant', async () => {
      const mockProvider1 = new MockProvider();
      const mockProvider2 = {
        name: 'mock-provider-2',
        createCodingExercise: async (workspaceDir: string, _prompt: string) => {
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "pass"'
          );
          return { success: true, message: 'Baseline created' };
        },
        injectBug: async (baselineDir: string, workspaceDir: string, _prompt: string) => {
          await cp(baselineDir, workspaceDir, { recursive: true });
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "fail"; exit 1'
          );
          return { success: true, message: 'Bug injected' };
        },
        fixAttempt: async (buggyDir: string, workspaceDir: string, _prompt: string) => {
          await cp(buggyDir, workspaceDir, { recursive: true });
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "pass"'
          );
          return { success: true, message: 'Fix applied' };
        },
      };

      const competitionId = new CompetitionId(`multi-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);

      const result = await runner.runMultiParticipantCompetition([mockProvider1, mockProvider2]);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const multiResult = result.value;
        expect(multiResult.overallSuccess).toBe(true);
        expect(multiResult.participantResults).toHaveLength(2);

        const result1 = multiResult.participantResults[0];
        expect(result1).toBeDefined();
        expect(result1?.participantId).toBe('mock-provider');
        expect(result1?.success).toBe(true);

        const result2 = multiResult.participantResults[1];
        expect(result2).toBeDefined();
        expect(result2?.participantId).toBe('mock-provider-2');
        expect(result2?.success).toBe(true);

        expect(multiResult.summary).toContain('2/2 participants succeeded');
        expect(multiResult.summary).toContain('Overall result: SUCCESS');
      }
    });

    it('should handle participant failures gracefully and continue with remaining participants', async () => {
      const successfulProvider = new MockProvider();
      const failingProvider = {
        name: 'failing-provider',
        createCodingExercise: async () => ({ success: false, message: 'Baseline failed' }),
        injectBug: async () => ({ success: true, message: 'Bug injected' }),
        fixAttempt: async () => ({ success: true, message: 'Fix applied' }),
      };

      const competitionId = new CompetitionId(`multi-failure-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);

      const result = await runner.runMultiParticipantCompetition([
        successfulProvider,
        failingProvider,
      ]);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const multiResult = result.value;
        expect(multiResult.overallSuccess).toBe(false);
        expect(multiResult.participantResults).toHaveLength(2);

        const successResult = multiResult.participantResults.find(
          r => r.participantId === 'mock-provider'
        );
        expect(successResult?.success).toBe(true);

        const failureResult = multiResult.participantResults.find(
          r => r.participantId === 'failing-provider'
        );
        expect(failureResult?.success).toBe(false);
        expect(failureResult?.message).toContain('Baseline failed');

        expect(multiResult.summary).toContain('1/2 participants succeeded');
        expect(multiResult.summary).toContain('Overall result: FAILED');
      }
    });

    it('should reject empty provider list', async () => {
      const competitionId = new CompetitionId(`empty-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);

      const result = await runner.runMultiParticipantCompetition([]);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain(
        'At least one provider must be specified'
      );
    });

    it('should log system events for competition start and completion', async () => {
      const mockProvider1 = new MockProvider();
      const mockProvider2 = {
        name: 'mock-provider-2',
        createCodingExercise: async (workspaceDir: string, _prompt: string) => {
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "pass"'
          );
          return { success: true, message: 'Baseline created' };
        },
        injectBug: async (baselineDir: string, workspaceDir: string, _prompt: string) => {
          await cp(baselineDir, workspaceDir, { recursive: true });
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "fail"; exit 1'
          );
          return { success: true, message: 'Bug injected' };
        },
        fixAttempt: async (buggyDir: string, workspaceDir: string, _prompt: string) => {
          await cp(buggyDir, workspaceDir, { recursive: true });
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "pass"'
          );
          return { success: true, message: 'Fix applied' };
        },
      };

      const competitionId = new CompetitionId(`system-events-test-${Date.now()}`);
      const runner = new SimpleCompetitionRunner(eventStore, competitionId);

      await runner.runMultiParticipantCompetition([mockProvider1, mockProvider2]);

      const eventsResult = await eventStore.getEventsByCompetition(competitionId);
      expect(eventsResult.isOk()).toBe(true);

      const events = eventsResult._unsafeUnwrap();

      const competitionStartEvent = events.find(
        e => e.getEventType() === 'competition_started' && e.getParticipantId().isSystem()
      );
      expect(competitionStartEvent).toBeDefined();

      const competitionCompletedEvent = events.find(
        e => e.getEventType() === 'competition_completed' && e.getParticipantId().isSystem()
      );
      expect(competitionCompletedEvent).toBeDefined();
    });
  });

  describe('Contract compliance', () => {
    const createCompliantProvider = () => ({
      name: 'compliant-provider',
      createCodingExercise: async (workspaceDir: string, _prompt: string) => {
        await writeFile(
          join(workspaceDir, 'Makefile'),
          'setup:\n\techo "ready"\ntest:\n\techo "pass"'
        );
        return { success: true, message: 'Created' };
      },
      injectBug: async (baselineDir: string, workspaceDir: string, _prompt: string) => {
        await cp(baselineDir, workspaceDir, { recursive: true });
        await writeFile(
          join(workspaceDir, 'Makefile'),
          'setup:\n\techo "ready"\ntest:\n\techo "fail"; exit 1'
        );
        return { success: true, message: 'Bug injected' };
      },
      fixAttempt: async (buggyDir: string, workspaceDir: string, _prompt: string) => {
        await cp(buggyDir, workspaceDir, { recursive: true });
        await writeFile(
          join(workspaceDir, 'Makefile'),
          'setup:\n\techo "ready"\ntest:\n\techo "pass"'
        );
        return { success: true, message: 'Fixed' };
      },
    });

    const createBadActor = (violation: string) => ({
      name: `bad-${violation}`,
      createCodingExercise: async (workspaceDir: string, _prompt: string) => {
        if (violation !== 'no-makefile') {
          const makefile =
            violation === 'no-test'
              ? 'setup:\n\techo "ready"'
              : 'setup:\n\techo "ready"\ntest:\n\techo "pass"';
          await writeFile(join(workspaceDir, 'Makefile'), makefile);
        }
        return { success: true, message: 'Created' };
      },
      injectBug: async (baselineDir: string, workspaceDir: string, _prompt: string) => {
        await cp(baselineDir, workspaceDir, { recursive: true });
        if (violation === 'fake-bug') {
          await writeFile(
            join(workspaceDir, 'Makefile'),
            'setup:\n\techo "ready"\ntest:\n\techo "pass"'
          );
        }
        return { success: true, message: 'Bug injected' };
      },
      fixAttempt: async (buggyDir: string, workspaceDir: string, _prompt: string) => {
        await cp(buggyDir, workspaceDir, { recursive: true });
        return { success: true, message: 'Fixed' };
      },
    });

    it('should complete successfully with compliant provider', async () => {
      const result = await runner.runCompetition(createCompliantProvider());

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should detect provider without Makefile', async () => {
      const result = await runner.runCompetition(createBadActor('no-makefile'));

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('Missing required Makefile');
    });

    it('should detect provider with fake bug injection', async () => {
      const result = await runner.runCompetition(createBadActor('fake-bug'));

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain(
        'Expected tests to fail after bug injection'
      );
    });

    it('should detect provider without test target', async () => {
      const result = await runner.runCompetition(createBadActor('no-test'));

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('No rule to make target');
    });
  });
});
