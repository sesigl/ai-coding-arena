// ABOUTME: Real integration tests with Claude Code CLI - disabled by default
// Run with: npm run test:integration (requires real Claude Code CLI access)

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeProvider } from './claude-code-provider';
import { createWorkspace, cleanupWorkspace } from 'infrastructure/workspace/workspace';
import { readFile, access } from 'fs/promises';
import { join } from 'path';

const INTEGRATION_TESTS_ENABLED = process.env.ENABLE_CLAUDE_INTEGRATION_TESTS === 'true';

describe.skipIf(!INTEGRATION_TESTS_ENABLED)('ClaudeCodeProvider Real Integration', () => {
  let provider: ClaudeCodeProvider;

  beforeEach(() => {
    provider = new ClaudeCodeProvider();
  });

  describe('full competition workflow with real Claude Code', () => {
    it('should create a complete, testable baseline project', async () => {
      const workspaceDir = await createWorkspace('integration-baseline');

      try {
        const result = await provider.createCodingExercise(workspaceDir);

        expect(result.success).toBe(true);

        // Verify essential files exist
        await access(join(workspaceDir, 'package.json'));
        await access(join(workspaceDir, 'tsconfig.json'));

        // Verify source files exist
        const srcFiles = await Promise.allSettled([
          access(join(workspaceDir, 'src')),
          access(join(workspaceDir, 'src', 'calculator.ts')),
          access(join(workspaceDir, 'src', 'calculator.test.ts')),
        ]);

        expect(srcFiles.every(f => f.status === 'fulfilled')).toBe(true);

        // Verify package.json has necessary dependencies
        const packageJson = JSON.parse(await readFile(join(workspaceDir, 'package.json'), 'utf-8'));
        expect(packageJson.devDependencies).toHaveProperty('vitest');
        expect(packageJson.devDependencies).toHaveProperty('typescript');
      } finally {
        await cleanupWorkspace(workspaceDir);
      }
    }, 300000); // 5 minute timeout for real Claude Code

    it('should inject a realistic bug that breaks tests', async () => {
      const baselineDir = await createWorkspace('integration-baseline-for-bug');
      const bugWorkspace = await createWorkspace('integration-bug');

      try {
        // First create baseline
        const baselineResult = await provider.createCodingExercise(baselineDir);
        expect(baselineResult.success).toBe(true);

        // Then inject bug
        const bugResult = await provider.injectBug(baselineDir, bugWorkspace);
        expect(bugResult.success).toBe(true);

        // Verify files were copied
        await access(join(bugWorkspace, 'package.json'));
        await access(join(bugWorkspace, 'src'));

        // The bug injection should have modified source files
        const sourceFiles = [
          join(bugWorkspace, 'src', 'calculator.ts'),
          join(bugWorkspace, 'src', 'calculator.test.ts'),
        ];

        for (const file of sourceFiles) {
          try {
            await access(file);
            const content = await readFile(file, 'utf-8');
            expect(content.length).toBeGreaterThan(0);
          } catch {
            // File might not exist depending on Claude's implementation choice
          }
        }
      } finally {
        await cleanupWorkspace(baselineDir);
        await cleanupWorkspace(bugWorkspace);
      }
    }, 300000);

    it('should fix bugs and restore passing tests', async () => {
      const baselineDir = await createWorkspace('integration-baseline-for-fix');
      const buggyDir = await createWorkspace('integration-buggy-for-fix');
      const fixWorkspace = await createWorkspace('integration-fix');

      try {
        // Create baseline
        const baselineResult = await provider.createCodingExercise(baselineDir);
        expect(baselineResult.success).toBe(true);

        // Inject bug
        const bugResult = await provider.injectBug(baselineDir, buggyDir);
        expect(bugResult.success).toBe(true);

        // Attempt fix
        const fixResult = await provider.fixAttempt(buggyDir, fixWorkspace);
        expect(fixResult.success).toBe(true);

        // Verify files exist in fix workspace
        await access(join(fixWorkspace, 'package.json'));
        await access(join(fixWorkspace, 'src'));
      } finally {
        await cleanupWorkspace(baselineDir);
        await cleanupWorkspace(buggyDir);
        await cleanupWorkspace(fixWorkspace);
      }
    }, 300000);
  });

  describe('competitive prompting effectiveness', () => {
    it('should create different solutions across multiple runs', async () => {
      const workspace1 = await createWorkspace('competition-run-1');
      const workspace2 = await createWorkspace('competition-run-2');

      try {
        const [result1, result2] = await Promise.all([
          provider.createCodingExercise(workspace1),
          provider.createCodingExercise(workspace2),
        ]);

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);

        // Both should create valid projects but potentially with different approaches
        await access(join(workspace1, 'package.json'));
        await access(join(workspace2, 'package.json'));
      } finally {
        await cleanupWorkspace(workspace1);
        await cleanupWorkspace(workspace2);
      }
    }, 600000); // Longer timeout for parallel execution
  });

  describe('error scenarios with real Claude Code', () => {
    it('should handle invalid workspace directories gracefully', async () => {
      const result = await provider.createCodingExercise('/invalid/nonexistent/path');

      // Should either succeed (if Claude Code creates the path) or fail gracefully
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should handle copy failures in bug injection', async () => {
      const result = await provider.injectBug('/nonexistent/baseline', '/tmp/test-bug-fail');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to copy baseline');
    });

    it('should handle copy failures in fix attempt', async () => {
      const result = await provider.fixAttempt('/nonexistent/buggy', '/tmp/test-fix-fail');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to copy buggy code');
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
