// ABOUTME: Real integration tests with Claude Code CLI - disabled by default
// Run with: npm run test:integration (requires real Claude Code CLI access)

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeProvider } from './claude-code-provider';
import { createWorkspace, cleanupWorkspace } from 'infrastructure/workspace/workspace';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { DebugLogger } from 'utils/debug-logger';

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
        const baselineResult = await provider.createCodingExercise(baselineDir);

        expect(baselineResult.success).toBe(true);
        expect(baselineResult.message).toContain('completed successfully');

        // Verify baseline structure
        await access(join(baselineDir, 'package.json'));
        await access(join(baselineDir, 'tsconfig.json'));
        await access(join(baselineDir, 'src', 'calculator.ts'));
        await access(join(baselineDir, 'src', 'calculator.test.ts'));

        const packageJson = JSON.parse(await readFile(join(baselineDir, 'package.json'), 'utf-8'));
        expect(packageJson.devDependencies).toHaveProperty('vitest');
        expect(packageJson.devDependencies).toHaveProperty('typescript');

        // PHASE 2: Inject bug
        DebugLogger.logPhaseStart('BUG_INJECTION', 'Injecting bug into calculator');
        const bugResult = await provider.injectBug(baselineDir, buggyDir);

        expect(bugResult.success).toBe(true);
        expect(bugResult.message).toContain('completed successfully');

        // Verify buggy code exists
        await access(join(buggyDir, 'package.json'));
        await access(join(buggyDir, 'src', 'calculator.ts'));
        await access(join(buggyDir, 'src', 'calculator.test.ts'));

        // PHASE 3: Fix the bug
        DebugLogger.logPhaseStart('FIX_ATTEMPT', 'Attempting to fix the bug');
        const fixResult = await provider.fixAttempt(buggyDir, fixDir);

        expect(fixResult.success).toBe(true);
        expect(fixResult.message).toContain('completed successfully');

        // Verify fix workspace exists
        await access(join(fixDir, 'package.json'));
        await access(join(fixDir, 'src', 'calculator.ts'));
        await access(join(fixDir, 'src', 'calculator.test.ts'));

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
      const bugResult = await provider.injectBug('/nonexistent/baseline', '/tmp/test-bug-fail');
      expect(bugResult.success).toBe(false);
      expect(bugResult.message).toContain('Failed to copy baseline');

      const fixResult = await provider.fixAttempt('/nonexistent/buggy', '/tmp/test-fix-fail');
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
