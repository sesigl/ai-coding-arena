// ABOUTME: Validates that projects follow the standardized Makefile contract
// Executes 'make setup' and 'make test' to verify LLM provider compliance

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface ValidationResult {
  readonly success: boolean;
  readonly message: string;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
  readonly exitCode?: number | undefined;
}

export class MakefileValidator {
  async validateSetupAndTest(workspaceDir: string): Promise<ValidationResult> {
    const makefilePath = join(workspaceDir, 'Makefile');

    if (!existsSync(makefilePath)) {
      return {
        success: false,
        message: 'Missing required Makefile in project root',
      };
    }

    try {
      const setupResult = await this.executeMakeCommand(workspaceDir, 'setup');
      if (!setupResult.success) {
        return {
          success: false,
          message: `'make setup' failed: ${setupResult.message}`,
          stdout: setupResult.stdout,
          stderr: setupResult.stderr,
          exitCode: setupResult.exitCode,
        };
      }

      const testResult = await this.executeMakeCommand(workspaceDir, 'test');
      return {
        success: testResult.success,
        message: testResult.success
          ? 'Makefile contract validated successfully'
          : `'make test' failed: ${testResult.message}`,
        stdout: testResult.stdout,
        stderr: testResult.stderr,
        exitCode: testResult.exitCode,
      };
    } catch (error) {
      return {
        success: false,
        message: `Contract validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async validateTestOnly(workspaceDir: string): Promise<ValidationResult> {
    const makefilePath = join(workspaceDir, 'Makefile');

    if (!existsSync(makefilePath)) {
      return {
        success: false,
        message: 'Missing required Makefile in project root',
      };
    }

    try {
      const testResult = await this.executeMakeCommand(workspaceDir, 'test');
      return {
        success: testResult.success,
        message: testResult.success
          ? 'Tests passed successfully'
          : `'make test' failed: ${testResult.message}`,
        stdout: testResult.stdout,
        stderr: testResult.stderr,
        exitCode: testResult.exitCode,
      };
    } catch (error) {
      return {
        success: false,
        message: `Test validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async expectTestFailure(workspaceDir: string): Promise<ValidationResult> {
    const testResult = await this.validateTestOnly(workspaceDir);

    if (testResult.success) {
      return {
        success: false,
        message: 'Expected tests to fail after bug injection, but they passed',
        stdout: testResult.stdout,
        stderr: testResult.stderr,
      };
    }

    return {
      success: true,
      message: 'Bug injection successful - tests are failing as expected',
      stdout: testResult.stdout,
      stderr: testResult.stderr,
      exitCode: testResult.exitCode,
    };
  }

  private async executeMakeCommand(
    workspaceDir: string,
    target: string
  ): Promise<ValidationResult> {
    try {
      const { stdout, stderr } = await execAsync(`make ${target}`, {
        cwd: workspaceDir,
        timeout: 60000, // 1 minute timeout
      });

      return {
        success: true,
        message: `'make ${target}' completed successfully`,
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : `'make ${target}' failed`,
        stdout: (error as { stdout?: string }).stdout || '',
        stderr: (error as { stderr?: string }).stderr || '',
        exitCode: (error as { code?: number }).code || 1,
      };
    }
  }
}
