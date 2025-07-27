// ABOUTME: Real integration tests with Claude Code CLI - disabled by default
// Run with: npm run test:integration (requires real Claude Code CLI access)

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeProvider } from './claude-code-provider';
import { createWorkspace, cleanupWorkspace } from 'infrastructure/workspace/workspace';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { DebugLogger } from 'utils/debug-logger';
import { SystemPrompts } from 'domain/competition-prompts/system-prompts';

const INTEGRATION_TESTS_ENABLED = process.env.ENABLE_CLAUDE_INTEGRATION_TESTS === 'true';

describe.skipIf(!INTEGRATION_TESTS_ENABLED)('ClaudeCodeProvider Real Integration', () => {
  let provider: ClaudeCodeProvider;

  beforeEach(() => {
    provider = new ClaudeCodeProvider();
  });

  describe('complete competition workflow', () => {
    it('should run full baseline → bug injection → fix cycle successfully', async () => {
      DebugLogger.logPhaseStart('INTEGRATION_TEST', 'Running complete competition workflow');

      const baselineDir = await createWorkspace('integration-baseline');
      const buggyDir = await createWorkspace('integration-buggy');
      const fixDir = await createWorkspace('integration-fix');

      try {
        // PHASE 1: Create baseline project
        DebugLogger.logPhaseStart('BASELINE_CREATION', 'Creating baseline calculator project');
        const baselinePrompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
        const baselineResult = await provider.createCodingExercise(baselineDir, baselinePrompt);

        expect(baselineResult.success).toBe(true);
        expect(baselineResult.message).toContain('completed successfully');

        // Verify baseline structure (including required Makefile contract)
        await access(join(baselineDir, 'Makefile')); // Contract requirement

        // Verify the project can actually be built and tested via Makefile
        const makefileContent = await readFile(join(baselineDir, 'Makefile'), 'utf-8');
        expect(makefileContent).toContain('setup:');
        expect(makefileContent).toContain('test:');

        // PHASE 2: Inject bug
        DebugLogger.logPhaseStart('BUG_INJECTION', 'Injecting bug into calculator');
        const bugInjectionPrompt = SystemPrompts.formatPrompt(SystemPrompts.BUG_INJECTION);
        const bugResult = await provider.injectBug(baselineDir, buggyDir, bugInjectionPrompt);

        expect(bugResult.success).toBe(true);
        expect(bugResult.message).toContain('completed successfully');

        // Verify buggy code exists and Makefile contract maintained
        await access(join(buggyDir, 'Makefile')); // Contract requirement

        // PHASE 3: Fix the bug
        DebugLogger.logPhaseStart('FIX_ATTEMPT', 'Attempting to fix the bug');
        const fixPrompt = SystemPrompts.formatPrompt(SystemPrompts.FIX_ATTEMPT);
        const fixResult = await provider.fixAttempt(buggyDir, fixDir, fixPrompt);

        expect(fixResult.success).toBe(true);
        expect(fixResult.message).toContain('completed successfully');

        // Verify fix workspace exists and Makefile contract maintained
        await access(join(fixDir, 'Makefile')); // Contract requirement

        DebugLogger.logPhaseEnd(
          'INTEGRATION_TEST',
          true,
          'Complete competition workflow successful'
        );
      } finally {
        await cleanupWorkspace(baselineDir);
        await cleanupWorkspace(buggyDir);
        await cleanupWorkspace(fixDir);
      }
    }, 600000); // 10 minute timeout for complete workflow
  });

  describe('error handling', () => {
    it('should handle copy failures gracefully', async () => {
      const bugResult = await provider.injectBug(
        '/nonexistent/baseline',
        '/tmp/test-bug-fail',
        'Test prompt'
      );
      expect(bugResult.success).toBe(false);
      expect(bugResult.message).toContain('Failed to copy baseline');

      const fixResult = await provider.fixAttempt(
        '/nonexistent/buggy',
        '/tmp/test-fix-fail',
        'Test prompt'
      );
      expect(fixResult.success).toBe(false);
      expect(fixResult.message).toContain('Failed to copy buggy code');
    });
  });
});

// Simple unit tests that always run for basic functionality
describe('ClaudeCodeProvider Basic Functionality', () => {
  it('should have correct provider name', () => {
    const provider = new ClaudeCodeProvider();
    expect(provider.name).toBe('claude-code');
  });

  it('should have all required methods', () => {
    const provider = new ClaudeCodeProvider();
    expect(typeof provider.createCodingExercise).toBe('function');
    expect(typeof provider.injectBug).toBe('function');
    expect(typeof provider.fixAttempt).toBe('function');
  });
});
