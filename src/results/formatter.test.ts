// ABOUTME: Tests for ResultsFormatter with mock data and edge cases
// Validates JSON output, statistics calculation, and error handling

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResultsFormatter } from './formatter';
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
    dbPath = join(tmpdir(), `test-${Date.now()}-${Math.random()}.db`);
    eventStore = new EventStore(dbPath);
    const initResult = await eventStore.initialize();
    if (initResult.isErr()) {
      throw initResult.error;
    }
    formatter = new ResultsFormatter(eventStore);
    competitionId = new CompetitionId(`test-competition-${Date.now()}`);
  });

  afterEach(async () => {
    await eventStore.close();
    try {
      await unlink(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('formatCompetitionResults', () => {
    it('should format empty competition correctly', async () => {
      const result = await formatter.formatCompetitionResults(competitionId);

      expect(result.isOk()).toBe(true);
      const summary = result._unsafeUnwrap();

      expect(summary.competitionId).toBe(competitionId.getValue());
      expect(summary.participants).toEqual([]);
      expect(summary.phases).toEqual([]);
      expect(summary.statistics.totalPhases).toBe(0);
      expect(summary.statistics.successRate).toBe(0);
    });

    it('should format single participant competition correctly', async () => {
      const participantId = ParticipantId.fromString('claude-code');

      // Insert just the phase completion events
      const baselineCompleted = CompetitionEventFactory.create({
        competitionId: competitionId.getValue(),
        participantId: participantId.getValue(),
        eventType: EventType.BASELINE_COMPLETED,
        phase: Phase.BASELINE,
        success: true,
        data: { message: 'Baseline created successfully' },
      });
      const insertResult1 = await eventStore.insertEvent(baselineCompleted);
      expect(insertResult1.isOk()).toBe(true);

      const bugInjectionCompleted = CompetitionEventFactory.create({
        id: 'test-id-2',
        competitionId: competitionId.getValue(),
        participantId: participantId.getValue(),
        eventType: EventType.BUG_INJECTION_COMPLETED,
        phase: Phase.BUG_INJECTION,
        success: true,
        data: { message: 'Bug injected successfully' },
      });
      const insertResult2 = await eventStore.insertEvent(bugInjectionCompleted);
      expect(insertResult2.isOk()).toBe(true);

      const fixAttemptCompleted = CompetitionEventFactory.create({
        id: 'test-id-3',
        competitionId: competitionId.getValue(),
        participantId: participantId.getValue(),
        eventType: EventType.FIX_ATTEMPT_COMPLETED,
        phase: Phase.FIX_ATTEMPT,
        success: false,
        data: { message: 'Fix attempt failed' },
      });
      const insertResult3 = await eventStore.insertEvent(fixAttemptCompleted);
      expect(insertResult3.isOk()).toBe(true);

      const result = await formatter.formatCompetitionResults(competitionId);

      expect(result.isOk()).toBe(true);
      const summary = result._unsafeUnwrap();

      expect(summary.competitionId).toBe(competitionId.getValue());
      expect(summary.participants).toEqual(['claude-code']);
      expect(summary.phases).toHaveLength(3);
      expect(summary.statistics.totalPhases).toBe(3);
      expect(summary.statistics.successfulPhases).toBe(2);
      expect(summary.statistics.failedPhases).toBe(1);
      expect(summary.statistics.successRate).toBeCloseTo(2 / 3);

      const participantStats = summary.statistics.participantStats['claude-code'];
      expect(participantStats).toBeDefined();
      expect(participantStats?.totalPhases).toBe(3);
      expect(participantStats?.successfulPhases).toBe(2);
      expect(participantStats?.successRate).toBeCloseTo(2 / 3);
      expect(participantStats?.phases.baseline).toBe(true);
      expect(participantStats?.phases.bugInjection).toBe(true);
      expect(participantStats?.phases.fixAttempt).toBe(false);
    });

    it('should handle multiple participants correctly', async () => {
      const participant1 = ParticipantId.fromString('claude-code');
      const participant2 = ParticipantId.fromString('mock-provider');

      // Insert events for first participant
      const baseline1 = CompetitionEventFactory.create({
        id: 'multi-test-1',
        competitionId: competitionId.getValue(),
        participantId: participant1.getValue(),
        eventType: EventType.BASELINE_COMPLETED,
        phase: Phase.BASELINE,
        success: true,
        data: { message: 'Success' },
      });
      await eventStore.insertEvent(baseline1);

      // Insert events for second participant
      const baseline2 = CompetitionEventFactory.create({
        id: 'multi-test-2',
        competitionId: competitionId.getValue(),
        participantId: participant2.getValue(),
        eventType: EventType.BASELINE_COMPLETED,
        phase: Phase.BASELINE,
        success: false,
        data: { message: 'Failed' },
      });
      await eventStore.insertEvent(baseline2);

      const result = await formatter.formatCompetitionResults(competitionId);

      expect(result.isOk()).toBe(true);
      const summary = result._unsafeUnwrap();

      expect(summary.participants).toEqual(['claude-code', 'mock-provider']);
      expect(summary.phases).toHaveLength(2);
      expect(summary.statistics.totalPhases).toBe(2);
      expect(summary.statistics.successfulPhases).toBe(1);
      expect(summary.statistics.successRate).toBe(0.5);

      expect(summary.statistics.participantStats['claude-code']?.successRate).toBe(1);
      expect(summary.statistics.participantStats['mock-provider']?.successRate).toBe(0);
    });
  });

  describe('formatAsJson', () => {
    it('should format summary as valid JSON', async () => {
      const participantId = ParticipantId.fromString('claude-code');

      const baselineCompleted = CompetitionEventFactory.create({
        competitionId: competitionId.getValue(),
        participantId: participantId.getValue(),
        eventType: EventType.BASELINE_COMPLETED,
        phase: Phase.BASELINE,
        success: true,
        data: { message: 'Success' },
      });
      await eventStore.insertEvent(baselineCompleted);

      const result = await formatter.formatCompetitionResults(competitionId);
      const summary = result._unsafeUnwrap();

      const json = formatter.formatAsJson(summary);

      // Should be valid JSON
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.competitionId).toBe(competitionId.getValue());
      expect(parsed.participants).toEqual(['claude-code']);
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
});
