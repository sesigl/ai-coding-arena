// ABOUTME: Tests for ResultsFormatter with mock data and edge cases
// Validates JSON output, statistics calculation, and error handling

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResultsFormatter, CompetitionSummary } from './formatter';
import { EventStore } from 'infrastructure/event-store/event-store';
import { CompetitionEventFactory } from 'test-utils/competition-event-factory';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';

describe('ResultsFormatter', () => {
  let eventStore: EventStore;
  let formatter: ResultsFormatter;
  let dbPath: string;
  let competitionId: CompetitionId;

  beforeEach(async () => {
    await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('formatCompetitionResults', () => {
    it('should format empty competition correctly', async () => {
      const summary = await formatCompetitionResults();

      expectEmptyCompetition(summary);
    });

    it('should format single participant competition correctly', async () => {
      const participantId = createParticipant('claude-code');
      await insertThreePhaseCompetition(participantId);

      const summary = await formatCompetitionResults();

      expectSingleParticipantWithThreePhases(summary, participantId);
    });

    it('should handle multiple participants correctly', async () => {
      const successfulParticipant = createParticipant('claude-code');
      const failedParticipant = createParticipant('mock-provider');

      await insertBaselineEvent(successfulParticipant, true);
      await insertBaselineEvent(failedParticipant, false);

      const summary = await formatCompetitionResults();

      expectMultipleParticipants(summary, successfulParticipant, failedParticipant);
    });
  });

  describe('formatAsJson', () => {
    it('should format summary as valid JSON', async () => {
      const participantId = createParticipant('claude-code');
      await insertBaselineEvent(participantId, true);

      const summary = await formatCompetitionResults();
      const json = formatter.formatAsJson(summary);

      expectValidJson(json, participantId);
    });
  });

  describe('error handling', () => {
    it('should handle eventStore errors gracefully', async () => {
      await eventStore.close();

      const result = await formatter.formatCompetitionResults(competitionId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('Database not initialized');
    });
  });

  // Setup and teardown helpers
  async function setupTestEnvironment(): Promise<void> {
    dbPath = createUniqueDbPath();
    eventStore = new EventStore(dbPath);
    await initializeEventStore();
    formatter = new ResultsFormatter(eventStore);
    competitionId = createUniqueCompetitionId();
  }

  async function cleanupTestEnvironment(): Promise<void> {
    await eventStore.close();
    await deleteDbFile();
  }

  function createUniqueDbPath(): string {
    return join(tmpdir(), `test-${Date.now()}-${Math.random()}.db`);
  }

  async function initializeEventStore(): Promise<void> {
    const initResult = await eventStore.initialize();
    if (initResult.isErr()) {
      throw initResult.error;
    }
  }

  function createUniqueCompetitionId(): CompetitionId {
    return new CompetitionId(`test-competition-${Date.now()}`);
  }

  async function deleteDbFile(): Promise<void> {
    try {
      await unlink(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Test data creation helpers
  function createParticipant(name: string): ParticipantId {
    return ParticipantId.fromString(name);
  }

  async function insertThreePhaseCompetition(participantId: ParticipantId): Promise<void> {
    await insertBaselineEvent(participantId, true);
    await insertBugInjectionEvent(participantId, true);
    await insertFixAttemptEvent(participantId, false);
  }

  async function insertBaselineEvent(
    participantId: ParticipantId,
    success: boolean
  ): Promise<void> {
    const event = createPhaseCompletionEvent(
      participantId,
      EventType.BASELINE_COMPLETED,
      Phase.BASELINE,
      success,
      success ? 'Baseline created successfully' : 'Baseline failed'
    );
    await insertEventAndVerify(event);
  }

  async function insertBugInjectionEvent(
    participantId: ParticipantId,
    success: boolean
  ): Promise<void> {
    const event = createPhaseCompletionEvent(
      participantId,
      EventType.BUG_INJECTION_COMPLETED,
      Phase.BUG_INJECTION,
      success,
      success ? 'Bug injected successfully' : 'Bug injection failed'
    );
    await insertEventAndVerify(event);
  }

  async function insertFixAttemptEvent(
    participantId: ParticipantId,
    success: boolean
  ): Promise<void> {
    const event = createPhaseCompletionEvent(
      participantId,
      EventType.FIX_ATTEMPT_COMPLETED,
      Phase.FIX_ATTEMPT,
      success,
      success ? 'Fix applied successfully' : 'Fix attempt failed'
    );
    await insertEventAndVerify(event);
  }

  function createPhaseCompletionEvent(
    participantId: ParticipantId,
    eventType: EventType,
    phase: Phase,
    success: boolean,
    message: string
  ) {
    return CompetitionEventFactory.create({
      id: `${eventType}-${participantId.getValue()}-${Date.now()}`,
      competitionId: competitionId.getValue(),
      participantId: participantId.getValue(),
      eventType,
      phase,
      success,
      data: { message },
    });
  }

  async function insertEventAndVerify(
    event: ReturnType<typeof CompetitionEventFactory.create>
  ): Promise<void> {
    const result = await eventStore.insertEvent(event);
    expect(result.isOk()).toBe(true);
  }

  // Test execution helpers
  async function formatCompetitionResults() {
    const result = await formatter.formatCompetitionResults(competitionId);
    expect(result.isOk()).toBe(true);
    return result._unsafeUnwrap();
  }

  // Assertion helpers
  function expectEmptyCompetition(summary: CompetitionSummary): void {
    expect(summary.competitionId).toBe(competitionId.getValue());
    expect(summary.participants).toEqual([]);
    expect(summary.phases).toEqual([]);
    expect(summary.statistics.totalPhases).toBe(0);
    expect(summary.statistics.successRate).toBe(0);
  }

  function expectSingleParticipantWithThreePhases(
    summary: CompetitionSummary,
    participantId: ParticipantId
  ): void {
    expect(summary.competitionId).toBe(competitionId.getValue());
    expect(summary.participants).toEqual([participantId.getValue()]);
    expect(summary.phases).toHaveLength(3);

    expectOverallStatistics(summary, 3, 2, 1, 2 / 3);
    expectParticipantStatistics(summary, participantId.getValue(), 3, 2, 2 / 3);
    expectParticipantPhases(summary, participantId.getValue(), true, true, false);
  }

  function expectMultipleParticipants(
    summary: CompetitionSummary,
    successfulParticipant: ParticipantId,
    failedParticipant: ParticipantId
  ): void {
    expect(summary.participants).toEqual([
      successfulParticipant.getValue(),
      failedParticipant.getValue(),
    ]);
    expect(summary.phases).toHaveLength(2);

    expectOverallStatistics(summary, 2, 1, 1, 0.5);
    expectParticipantStatistics(summary, successfulParticipant.getValue(), 1, 1, 1);
    expectParticipantStatistics(summary, failedParticipant.getValue(), 1, 0, 0);
  }

  function expectOverallStatistics(
    summary: CompetitionSummary,
    totalPhases: number,
    successfulPhases: number,
    failedPhases: number,
    successRate: number
  ): void {
    expect(summary.statistics.totalPhases).toBe(totalPhases);
    expect(summary.statistics.successfulPhases).toBe(successfulPhases);
    expect(summary.statistics.failedPhases).toBe(failedPhases);
    expect(summary.statistics.successRate).toBeCloseTo(successRate);
  }

  function expectParticipantStatistics(
    summary: CompetitionSummary,
    participantName: string,
    totalPhases: number,
    successfulPhases: number,
    successRate: number
  ): void {
    const participantStats = summary.statistics.participantStats[participantName];
    expect(participantStats).toBeDefined();
    expect(participantStats?.totalPhases).toBe(totalPhases);
    expect(participantStats?.successfulPhases).toBe(successfulPhases);
    expect(participantStats?.successRate).toBeCloseTo(successRate);
  }

  function expectParticipantPhases(
    summary: CompetitionSummary,
    participantName: string,
    baseline: boolean,
    bugInjection: boolean,
    fixAttempt: boolean
  ): void {
    const participantStats = summary.statistics.participantStats[participantName];
    expect(participantStats?.phases.baseline).toBe(baseline);
    expect(participantStats?.phases.bugInjection).toBe(bugInjection);
    expect(participantStats?.phases.fixAttempt).toBe(fixAttempt);
  }

  function expectValidJson(json: string, participantId: ParticipantId): void {
    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.competitionId).toBe(competitionId.getValue());
    expect(parsed.participants).toEqual([participantId.getValue()]);
  }
});
