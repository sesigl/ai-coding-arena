// ABOUTME: Real Gemini CLI provider implementation using command line interface
// Competition-focused prompts that encourage deep thinking and strategic bug creation/fixing

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { spawn } from 'child_process';
import { cp } from 'fs/promises';
import { setTimeout as nodeSetTimeout, clearTimeout } from 'timers';
import { DebugLogger } from 'infrastructure/logging/debug-logger';

export class GeminiCliProvider implements LLMProvider {
  readonly name = 'gemini-cli';
  private static readonly MAX_TIMEOUT_MS = 300000; // 5 minutes default

  async createCodingExercise(
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }> {
    DebugLogger.logPhaseStart('BASELINE_CREATION', `Creating baseline project in ${workspaceDir}`);

    const result = await this.executeGeminiCommand(workspaceDir, prompt, 'baseline creation');
    DebugLogger.logPhaseEnd('BASELINE_CREATION', result.success, result.message);
    return result;
  }

  async injectBug(
    baselineDir: string,
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }> {
    DebugLogger.logPhaseStart(
      'BUG_INJECTION',
      `Copying baseline from ${baselineDir} to ${workspaceDir}`
    );

    try {
      await cp(baselineDir, workspaceDir, { recursive: true, force: true });
      DebugLogger.logProgress('BUG_INJECTION', 'Baseline files copied successfully');
    } catch (error) {
      const errorMsg = `Failed to copy baseline: ${error instanceof Error ? error.message : String(error)}`;
      DebugLogger.logPhaseEnd('BUG_INJECTION', false, errorMsg);
      return {
        success: false,
        message: errorMsg,
      };
    }

    DebugLogger.logProgress('BUG_INJECTION', 'Starting bug injection with Gemini CLI');
    const result = await this.executeGeminiCommand(workspaceDir, prompt, 'bug injection', 300000);
    DebugLogger.logPhaseEnd('BUG_INJECTION', result.success, result.message);
    return result;
  }

  async fixAttempt(
    buggyDir: string,
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }> {
    DebugLogger.logPhaseStart(
      'FIX_ATTEMPT',
      `Copying buggy code from ${buggyDir} to ${workspaceDir}`
    );

    try {
      await cp(buggyDir, workspaceDir, { recursive: true, force: true });
      DebugLogger.logProgress('FIX_ATTEMPT', 'Buggy files copied successfully');
    } catch (error) {
      const errorMsg = `Failed to copy buggy code: ${error instanceof Error ? error.message : String(error)}`;
      DebugLogger.logPhaseEnd('FIX_ATTEMPT', false, errorMsg);
      return {
        success: false,
        message: errorMsg,
      };
    }

    DebugLogger.logProgress('FIX_ATTEMPT', 'Starting bug fix with Gemini CLI');
    const result = await this.executeGeminiCommand(workspaceDir, prompt, 'fix attempt');
    DebugLogger.logPhaseEnd('FIX_ATTEMPT', result.success, result.message);
    return result;
  }

  private async executeGeminiCommand(
    workspaceDir: string,
    prompt: string,
    phase: string,
    timeoutInMs = GeminiCliProvider.MAX_TIMEOUT_MS
  ): Promise<{ success: boolean; message: string }> {
    const phaseUpper = phase.toUpperCase().replace(' ', '_');

    try {
      DebugLogger.logProgress(phaseUpper, 'Starting Gemini CLI conversation', {
        workspaceDir,
        timeoutMs: timeoutInMs,
      });

      const enhancedPrompt = `${prompt}

IMPORTANT CONSTRAINTS:
- You are working in a sandboxed workspace directory: ${workspaceDir}
- You MUST stay within this directory - never access files outside of it
- All file paths must be relative to the current working directory
- Do not use absolute paths or .. to navigate outside the workspace
- Only work with files that exist within the workspace directory
- Always create a Makefile with 'setup:' and 'test:' targets for project validation`;

      const result = await this.runGeminiProcess(
        workspaceDir,
        enhancedPrompt,
        phaseUpper,
        timeoutInMs
      );

      const success = this.determineSuccess(result.output, phase);

      DebugLogger.logProgress(phaseUpper, `Success determination: ${success}`, {
        phase,
        outputLength: result.output.length,
      });

      return {
        success,
        message: success
          ? `Gemini CLI ${phase} completed successfully`
          : `Gemini CLI ${phase} completed but may have issues. Output: ${result.output.slice(-500)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Gemini CLI ${phase} failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async runGeminiProcess(
    workspaceDir: string,
    prompt: string,
    phaseUpper: string,
    timeoutInMs: number
  ): Promise<{ output: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      const timeout = nodeSetTimeout(() => {
        geminiProcess.kill('SIGTERM');
        reject(new Error(`Gemini CLI timed out after ${Math.round(timeoutInMs / 60000)} minutes`));
      }, timeoutInMs);

      let output = '';
      let errorOutput = '';

      const geminiProcess = spawn(
        'gemini',
        [
          '--model',
          'gemini-2.5-flash',
          '--prompt',
          prompt,
          '--yolo', // Auto-accept actions for automated execution
        ],
        {
          cwd: workspaceDir,
          env: {
            ...process.env,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY,
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      geminiProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;

        // Log significant content
        const lines = text.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          if (
            line.includes('Creating') ||
            line.includes('Writing') ||
            line.includes('File:') ||
            line.includes('Error') ||
            line.includes('Success')
          ) {
            DebugLogger.logContent(phaseUpper, `📝 ${line.trim()}`, 'GEMINI_CLI');
          }
        });
      });

      geminiProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        DebugLogger.logContent(phaseUpper, `⚠️ ${text.trim()}`, 'GEMINI_CLI');
      });

      geminiProcess.on('close', code => {
        clearTimeout(timeout);

        DebugLogger.logProgress(phaseUpper, `Gemini CLI process completed with exit code: ${code}`);

        resolve({
          output: output + errorOutput,
          exitCode: code,
        });
      });

      geminiProcess.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private determineSuccess(output: string, phase: string): boolean {
    const outputLower = output.toLowerCase();

    switch (phase) {
      case 'baseline creation':
        return (
          outputLower.includes('makefile') &&
          outputLower.includes('setup') &&
          outputLower.includes('test') &&
          (outputLower.includes('created') ||
            outputLower.includes('written') ||
            outputLower.includes('file:'))
        );

      case 'bug injection':
        return (
          outputLower.includes('test') &&
          (outputLower.includes('fail') ||
            outputLower.includes('failing') ||
            outputLower.includes('broken') ||
            outputLower.includes('bug') ||
            outputLower.includes('modified'))
        );

      case 'fix attempt':
        return (
          outputLower.includes('test') &&
          (outputLower.includes('pass') ||
            outputLower.includes('passing') ||
            outputLower.includes('fixed') ||
            outputLower.includes('fix') ||
            outputLower.includes('corrected'))
        );

      default:
        return output.length > 0 && !outputLower.includes('error');
    }
  }
}
