// ABOUTME: TDD tests for GameRunner orchestrating complete game execution with real MockProvider simulation
// Tests cover behavior-driven game runner with event emission and actual provider interactions

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameRunner, GameEvent } from './game-runner';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { MockProvider } from 'providers/mock-provider/mock-provider';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';

describe('GameRunner', () => {
  let gameRunner: GameRunner;
  let participantA: ParticipantId;
  let participantB: ParticipantId;
  let participantC: ParticipantId;
  let testWorkspaceDir: string;

  beforeEach(async () => {
    participantA = ParticipantId.fromString('blazing-bulldozer');
    participantB = ParticipantId.fromString('radical-rampage');
    participantC = ParticipantId.fromString('turbo-terror');

    // Create test workspace
    testWorkspaceDir = join(tmpdir(), `game-runner-test-${Date.now()}`);
    await mkdir(testWorkspaceDir, { recursive: true });

    // Create provider configurations for different participants
    const providers = new Map([
      [participantA, new MockProvider()],
      [participantB, new MockProvider()],
      [participantC, new MockProvider()],
    ]);

    gameRunner = new GameRunner(providers, testWorkspaceDir);
  });

  afterEach(async () => {
    await rm(testWorkspaceDir, { recursive: true, force: true });
  });

  describe('Single Round Game Simulation', () => {
    it('should orchestrate complete round with baseline, bug injection, and fix attempt', async () => {
      const events: GameEvent[] = [];
      gameRunner.onEvent(event => events.push(event));

      await gameRunner.start(1);

      expect(events).toEqual([
        {
          type: 'round-started',
          round: 1,
          baselineAuthor: participantA.getValue(),
          timestamp: expect.any(Date),
        },
        {
          type: 'baseline-attempt',
          participant: participantA.getValue(),
          success: true,
          message: expect.stringContaining('Mock baseline created successfully'),
          timestamp: expect.any(Date),
          workspacePath: expect.stringContaining('blazing-bulldozer'),
        },
        {
          type: 'bug-injection-attempt',
          participant: participantB.getValue(),
          success: true,
          message: expect.stringContaining('Mock bug injected successfully'),
          timestamp: expect.any(Date),
          workspacePath: expect.stringContaining('radical-rampage'),
        },
        {
          type: 'fix-attempt',
          participant: participantC.getValue(),
          success: true,
          message: expect.stringContaining('Mock fix applied successfully'),
          timestamp: expect.any(Date),
          workspacePath: expect.stringContaining('turbo-terror'),
        },
        {
          type: 'round-finished',
          round: 1,
          scores: expect.any(Object),
          timestamp: expect.any(Date),
        },
      ]);
    });

    it('should provide workspace paths to participants during their actions', async () => {
      const events: GameEvent[] = [];
      gameRunner.onEvent(event => events.push(event));

      await gameRunner.start(1);

      // Verify baseline creation created workspace structure
      const baselineEvent = events.find(e => e.type === 'baseline-attempt');
      expect(baselineEvent).toBeDefined();
      expect((baselineEvent as typeof baselineEvent & { success: boolean }).success).toBe(true);
      expect(
        (baselineEvent as typeof baselineEvent & { workspacePath: string }).workspacePath
      ).toMatch(/blazing-bulldozer/);

      // Verify bug injection had access to baseline workspace
      const bugEvent = events.find(e => e.type === 'bug-injection-attempt');
      expect(bugEvent).toBeDefined();
      expect((bugEvent as typeof bugEvent & { success: boolean }).success).toBe(true);
      expect((bugEvent as typeof bugEvent & { workspacePath: string }).workspacePath).toMatch(
        /radical-rampage/
      );

      // Verify fix attempt had access to buggy workspace
      const fixEvent = events.find(e => e.type === 'fix-attempt');
      expect(fixEvent).toBeDefined();
      expect((fixEvent as typeof fixEvent & { success: boolean }).success).toBe(true);
      expect((fixEvent as typeof fixEvent & { workspacePath: string }).workspacePath).toMatch(
        /turbo-terror/
      );
    });
  });

  describe('Game Flow Control', () => {
    it('should handle baseline failure and end round early', async () => {
      // Create a provider that will fail baseline creation
      const failingProvider = new MockProvider();
      failingProvider.createCodingExercise = async () => ({
        success: false,
        message: 'Baseline creation failed for testing',
      });

      const providers = new Map([
        [participantA, failingProvider],
        [participantB, new MockProvider()],
        [participantC, new MockProvider()],
      ]);

      const failingGameRunner = new GameRunner(providers, testWorkspaceDir);
      const events: GameEvent[] = [];
      failingGameRunner.onEvent(event => events.push(event));

      await failingGameRunner.start(1);

      expect(events).toEqual([
        expect.objectContaining({ type: 'round-started' }),
        expect.objectContaining({
          type: 'baseline-attempt',
          success: false,
          message: 'Baseline creation failed for testing',
        }),
        expect.objectContaining({ type: 'round-finished' }),
      ]);

      // Should not have bug injection or fix attempts
      expect(events.some(e => e.type === 'bug-injection-attempt')).toBe(false);
      expect(events.some(e => e.type === 'fix-attempt')).toBe(false);
    });
  });

  describe('Multi-Round Simulation', () => {
    it('should run 3 rounds with participant rotation', async () => {
      const events: GameEvent[] = [];
      gameRunner.onEvent(event => events.push(event));

      const summary = await gameRunner.start(3);

      const roundStartEvents = events.filter(e => e.type === 'round-started');
      const roundFinishEvents = events.filter(e => e.type === 'round-finished');

      expect(roundStartEvents).toHaveLength(3);
      expect(roundFinishEvents).toHaveLength(3);

      expect(roundStartEvents[0]).toMatchObject({ baselineAuthor: participantA.getValue() });
      expect(roundStartEvents[1]).toMatchObject({ baselineAuthor: participantB.getValue() });
      expect(roundStartEvents[2]).toMatchObject({ baselineAuthor: participantC.getValue() });

      expect(summary.totalRounds).toBe(3);
      expect(summary.participantScores).toHaveLength(3);
    });
  });

  describe('Unique Workspace Directory Management', () => {
    it('should create unique workspace directories for each task to prevent cross-contamination', async () => {
      const events: GameEvent[] = [];
      gameRunner.onEvent(event => events.push(event));

      await gameRunner.start(2);

      const baselineEvents = events.filter(e => e.type === 'baseline-attempt');
      const bugInjectionEvents = events.filter(e => e.type === 'bug-injection-attempt');
      const fixAttemptEvents = events.filter(e => e.type === 'fix-attempt');

      expect(baselineEvents).toHaveLength(2);

      const baselinePaths = baselineEvents.map(
        e => (e as typeof e & { workspacePath: string }).workspacePath
      );
      expect(baselinePaths[0]).not.toBe(baselinePaths[1]);

      expect(baselinePaths[0]).toMatch(/round1.*baseline/);
      expect(baselinePaths[1]).toMatch(/round2.*baseline/);

      const bugInjectionPaths = bugInjectionEvents.map(
        e => (e as typeof e & { workspacePath: string }).workspacePath
      );
      const fixAttemptPaths = fixAttemptEvents.map(
        e => (e as typeof e & { workspacePath: string }).workspacePath
      );

      expect(bugInjectionPaths[0]).toMatch(/round1.*buginjection/);
      expect(bugInjectionPaths[1]).toMatch(/round2.*buginjection/);

      expect(fixAttemptPaths[0]).toMatch(/round1.*fixattempt/);
      expect(fixAttemptPaths[1]).toMatch(/round2.*fixattempt/);

      const allPaths = [...baselinePaths, ...bugInjectionPaths, ...fixAttemptPaths];
      const uniquePaths = new Set(allPaths);
      expect(uniquePaths.size).toBe(allPaths.length);
    });

    it('should fail fast when workspace directory already exists and is non-empty', async () => {
      const workspaceDir = join(testWorkspaceDir, 'blazing-bulldozer-round1-baseline');
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(join(workspaceDir, 'existing-file.txt'), 'contaminated content');

      const events: GameEvent[] = [];
      gameRunner.onEvent(event => events.push(event));

      await gameRunner.start(1);

      const baselineEvent = events.find(e => e.type === 'baseline-attempt');
      expect(baselineEvent).toBeDefined();
      expect((baselineEvent as typeof baselineEvent & { success: boolean }).success).toBe(false);
      expect((baselineEvent as typeof baselineEvent & { message: string }).message).toContain(
        'Workspace directory is not empty'
      );
    });
  });
});
