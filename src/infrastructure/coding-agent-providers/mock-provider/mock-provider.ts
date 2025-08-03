// ABOUTME: Mock LLM provider implementation using template directory approach
// Copies baseline template with executable project structure and automation

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { cp, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export class MockProvider implements LLMProvider {
  readonly name = 'mock-provider';

  async createCodingExercise(
    workspaceDir: string,
    _prompt: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const currentDir = dirname(fileURLToPath(import.meta.url));
      const templateDir = join(currentDir, 'baseline');

      await cp(templateDir, workspaceDir, {
        recursive: true,
        force: true,
      });

      return {
        success: true,
        message: 'Mock baseline created successfully with complete executable project structure',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create baseline: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async injectBug(
    baselineDir: string,
    workspaceDir: string,
    _prompt: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await cp(baselineDir, workspaceDir, {
        recursive: true,
        force: true,
      });

      const calculatorPath = join(workspaceDir, 'src', 'calculator.ts');
      const originalCode = await readFile(calculatorPath, 'utf-8');

      const buggyCode = originalCode.replace(
        'return a + b;',
        'return a - b; // BUG: Should be addition'
      );

      await writeFile(calculatorPath, buggyCode, 'utf-8');

      // Update Makefile to simulate failing tests after bug injection
      const makefilePath = join(workspaceDir, 'Makefile');
      const buggyMakefile = `setup:
\techo "Mock dependencies installed"

test:
\techo "Running tests..."
\techo "❌ Tests failed due to bug injection"
\texit 1

.PHONY: setup test`;
      await writeFile(makefilePath, buggyMakefile, 'utf-8');

      return {
        success: true,
        message: 'Mock bug injected successfully - calculator now subtracts instead of adds',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to inject bug: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async fixAttempt(
    buggyDir: string,
    workspaceDir: string,
    _prompt: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await cp(buggyDir, workspaceDir, {
        recursive: true,
        force: true,
      });

      const calculatorPath = join(workspaceDir, 'src', 'calculator.ts');
      const buggyCode = await readFile(calculatorPath, 'utf-8');

      const fixedCode = buggyCode.replace(
        'return a - b; // BUG: Should be addition',
        'return a + b;'
      );

      await writeFile(calculatorPath, fixedCode, 'utf-8');

      // Restore Makefile with passing tests
      const makefilePath = join(workspaceDir, 'Makefile');
      const fixedMakefile = `setup:
\techo "Mock dependencies installed"

test:
\techo "Running tests..."
\techo "✅ All tests passed after fix"

.PHONY: setup test`;
      await writeFile(makefilePath, fixedMakefile, 'utf-8');

      return {
        success: true,
        message: 'Mock fix applied successfully - calculator now adds correctly',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to fix bug: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
