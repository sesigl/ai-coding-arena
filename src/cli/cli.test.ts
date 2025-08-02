// ABOUTME: Tests for CLI interface functionality
// Basic integration tests for command-line execution

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runCompetition } from './index';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

describe('CLI', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
  });

  describe('runCompetition', () => {
    it('should run a complete competition workflow with default providers', async () => {
      await expect(runCompetition()).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('🏁 Starting AI Coding Arena Competition...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/📁 Workspace: .*/));
      expect(consoleSpy).toHaveBeenCalledWith(
        '🤖 Providers: mock-provider, mock-provider, mock-provider'
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Rounds: 3');
    });

    it('should run competition with specified providers', async () => {
      await expect(
        runCompetition(['mock-provider', 'mock-provider', 'mock-provider'])
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🤖 Providers: mock-provider, mock-provider, mock-provider'
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Rounds: 3');
    });

    it('should display progress messages during execution', async () => {
      await runCompetition();

      expect(consoleSpy).toHaveBeenCalledWith('🏁 Starting AI Coding Arena Competition...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/🔄 Round \d+ started/));
      expect(consoleSpy).toHaveBeenCalledWith('\n🏆 Final Results:');
    });

    it('should display competition results', async () => {
      await runCompetition();

      expect(consoleSpy).toHaveBeenCalledWith('\n🏆 Final Results:');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/\{[\s\S]*\}/)); // JSON output
    });

    it('should handle unknown provider error', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await runCompetition(['unknown-provider', 'mock-provider', 'mock-provider']);
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
        runCompetition(['mock-provider', 'mock-provider', 'mock-provider'])
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🤖 Providers: mock-provider, mock-provider, mock-provider'
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Rounds: 3');
      expect(consoleSpy).toHaveBeenCalledWith('\n🏆 Final Results:');
    });
  });

  describe('workspace cleanup', () => {
    it('should clean up temporary workspace directory after competition completes', async () => {
      let workspacePath: string | null = null;

      // Capture the workspace path from console output
      const originalConsoleLog = console.log;
      console.log = vi.fn((message: string, ...args: unknown[]) => {
        if (typeof message === 'string' && message.includes('📁 Workspace:')) {
          workspacePath = message.replace('📁 Workspace: ', '');
        }
        originalConsoleLog(message, ...args);
      });

      try {
        await runCompetition(['mock-provider', 'mock-provider', 'mock-provider']);

        // Verify workspace path was captured and is in temp directory
        expect(workspacePath).toBeTruthy();
        expect(workspacePath).toContain(tmpdir());
        expect(workspacePath).toContain('ai-coding-arena-competition');

        // Verify the workspace directory was cleaned up
        expect(workspacePath).not.toBeNull();
        if (workspacePath) {
          expect(existsSync(workspacePath)).toBe(false);
        }
      } finally {
        console.log = originalConsoleLog;
      }
    });

    it('should clean up workspace directory even when competition fails', async () => {
      let workspacePath: string | null = null;

      // Capture the workspace path from console output
      const originalConsoleLog = console.log;
      console.log = vi.fn((message: string, ...args: unknown[]) => {
        if (typeof message === 'string' && message.includes('📁 Workspace:')) {
          workspacePath = message.replace('📁 Workspace: ', '');
        }
        originalConsoleLog(message, ...args);
      });

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await runCompetition(['unknown-provider', 'mock-provider', 'mock-provider']);
      } catch {
        // Expected error for unknown provider
      }

      try {
        // Verify workspace path was captured
        if (workspacePath) {
          expect(workspacePath).toContain(tmpdir());
          expect(workspacePath).toContain('ai-coding-arena-competition');

          // Verify the workspace directory was cleaned up even after error
          expect(existsSync(workspacePath)).toBe(false);
        }
      } finally {
        console.log = originalConsoleLog;
        mockExit.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
