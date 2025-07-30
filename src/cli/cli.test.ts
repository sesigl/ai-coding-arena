// ABOUTME: Tests for CLI interface functionality
// Basic integration tests for command-line execution

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runCompetition } from './index';
import { createWorkspace, cleanupWorkspace } from 'infrastructure/workspace/workspace';

describe('CLI', () => {
  let workspaceDir: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    workspaceDir = await createWorkspace('cli-test');
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await cleanupWorkspace(workspaceDir);
  });

  describe('runCompetition', () => {
    it('should run a complete competition workflow with default providers', async () => {
      await expect(runCompetition(workspaceDir)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('🏁 Starting AI Coding Arena Competition...');
      expect(consoleSpy).toHaveBeenCalledWith(`📁 Workspace: ${workspaceDir}`);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🤖 Providers: mock-provider, mock-provider, mock-provider'
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Rounds: 3');
    });

    it('should run competition with specified providers', async () => {
      await expect(
        runCompetition(workspaceDir, ['mock-provider', 'mock-provider', 'mock-provider'])
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🤖 Providers: mock-provider, mock-provider, mock-provider'
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Rounds: 3');
    });

    it('should display progress messages during execution', async () => {
      await runCompetition(workspaceDir);

      expect(consoleSpy).toHaveBeenCalledWith('🏁 Starting AI Coding Arena Competition...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/🔄 Round \d+ started/));
      expect(consoleSpy).toHaveBeenCalledWith('\n🏆 Final Results:');
    });

    it('should display competition results', async () => {
      await runCompetition(workspaceDir);

      expect(consoleSpy).toHaveBeenCalledWith('\n🏆 Final Results:');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/\{[\s\S]*\}/)); // JSON output
    });

    it('should handle unknown provider error', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await runCompetition(workspaceDir, ['unknown-provider', 'mock-provider', 'mock-provider']);
      } catch {
        // Expected error for unknown provider
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '💥 Unexpected error:',
        'Unknown provider: unknown-provider. Available providers: mock-provider, claude-code'
      );

      mockExit.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should run multi-participant competition with multiple providers', async () => {
      await expect(
        runCompetition(workspaceDir, ['mock-provider', 'mock-provider', 'mock-provider'])
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🤖 Providers: mock-provider, mock-provider, mock-provider'
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Rounds: 3');
      expect(consoleSpy).toHaveBeenCalledWith('\n🏆 Final Results:');
    });
  });
});
