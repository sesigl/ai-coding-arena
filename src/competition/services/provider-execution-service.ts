// ABOUTME: Provider execution service with configurable timeouts and duration tracking
// Handles all LLM provider operations with consistent timeout and error handling

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { Duration } from 'domain/competition-event/duration';
import { Result, ok, err } from 'neverthrow';
import { setTimeout, clearTimeout } from 'timers';

export interface ProviderResult {
  readonly success: boolean;
  readonly message: string;
}

export interface TimedProviderResult {
  readonly result: ProviderResult;
  readonly duration: Duration;
}

export interface ProviderExecutionConfig {
  readonly baselineTimeoutMs: number;
  readonly bugInjectionTimeoutMs: number;
  readonly fixAttemptTimeoutMs: number;
}

export const DEFAULT_EXECUTION_CONFIG: ProviderExecutionConfig = {
  baselineTimeoutMs: 300000, // 5 minutes
  bugInjectionTimeoutMs: 180000, // 3 minutes
  fixAttemptTimeoutMs: 180000, // 3 minutes
};

export class ProviderExecutionService {
  constructor(private readonly config: ProviderExecutionConfig = DEFAULT_EXECUTION_CONFIG) {}

  async executeBaselineCreation(
    provider: LLMProvider,
    workspaceDir: string,
    prompt: string
  ): Promise<Result<TimedProviderResult, Error>> {
    return this.executeWithTimeout(
      async () => provider.createCodingExercise(workspaceDir, prompt),
      this.config.baselineTimeoutMs,
      'Baseline creation exceeded time limit'
    );
  }

  async executeBugInjection(
    provider: LLMProvider,
    baselineDir: string,
    buggyDir: string,
    prompt: string
  ): Promise<Result<TimedProviderResult, Error>> {
    return this.executeWithTimeout(
      async () => provider.injectBug(baselineDir, buggyDir, prompt),
      this.config.bugInjectionTimeoutMs,
      'Bug injection exceeded time limit'
    );
  }

  async executeFixAttempt(
    provider: LLMProvider,
    buggyDir: string,
    fixDir: string,
    prompt: string
  ): Promise<Result<TimedProviderResult, Error>> {
    return this.executeWithTimeout(
      async () => provider.fixAttempt(buggyDir, fixDir, prompt),
      this.config.fixAttemptTimeoutMs,
      'Fix attempt exceeded time limit'
    );
  }

  private async executeWithTimeout(
    operation: () => Promise<ProviderResult>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<Result<TimedProviderResult, Error>> {
    const startTime = Date.now();

    try {
      const result = await this.withTimeout(operation(), timeoutMs, timeoutMessage);
      const durationMs = Date.now() - startTime;
      const duration = Duration.fromSeconds(Math.floor(durationMs / 1000));

      return ok({ result, duration });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}
