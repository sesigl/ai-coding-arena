// ABOUTME: ProviderExecutor centralizes provider command execution and validation
// Enforces separation of concerns by handling validation and delegating actual provider work

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { Duration } from 'domain/competition-event/duration';
import { Result, ok, err } from 'neverthrow';
import { setTimeout, clearTimeout } from 'timers';

export type ProviderCommand = 'baseline' | 'bug-injection' | 'fix-attempt';

export interface ProviderExecutionResult {
  readonly success: boolean;
  readonly message: string;
}

export interface TimedProviderExecutionResult {
  readonly result: ProviderExecutionResult;
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

export interface BaselineExecutionContext {
  readonly participant: ParticipantId;
  readonly workspaceDir: string;
  readonly prompt: string;
}

export interface BugInjectionExecutionContext {
  readonly participant: ParticipantId;
  readonly baselineDir: string;
  readonly workspaceDir: string;
  readonly prompt: string;
}

export interface FixAttemptExecutionContext {
  readonly participant: ParticipantId;
  readonly buggyDir: string;
  readonly workspaceDir: string;
  readonly prompt: string;
}

export class ProviderExecutor {
  constructor(
    private readonly providers: Map<ParticipantId, LLMProvider>,
    private readonly config: ProviderExecutionConfig = DEFAULT_EXECUTION_CONFIG
  ) {}

  async executeBaseline(context: BaselineExecutionContext): Promise<ProviderExecutionResult> {
    const provider = this.getProvider(context.participant);

    try {
      const result = await provider.createCodingExercise(context.workspaceDir, context.prompt);
      return this.validateAndNormalizeResult(result, 'baseline creation');
    } catch (error) {
      return {
        success: false,
        message: `Baseline creation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async executeBaselineWithTimeout(
    context: BaselineExecutionContext
  ): Promise<Result<TimedProviderExecutionResult, Error>> {
    const provider = this.getProvider(context.participant);
    return this.executeWithTimeout(
      async () => provider.createCodingExercise(context.workspaceDir, context.prompt),
      this.config.baselineTimeoutMs,
      'Baseline creation exceeded time limit'
    );
  }

  async executeBugInjection(
    context: BugInjectionExecutionContext
  ): Promise<ProviderExecutionResult> {
    const provider = this.getProvider(context.participant);

    try {
      const result = await provider.injectBug(
        context.baselineDir,
        context.workspaceDir,
        context.prompt
      );
      return this.validateAndNormalizeResult(result, 'bug injection');
    } catch (error) {
      return {
        success: false,
        message: `Bug injection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async executeBugInjectionWithTimeout(
    context: BugInjectionExecutionContext
  ): Promise<Result<TimedProviderExecutionResult, Error>> {
    const provider = this.getProvider(context.participant);
    return this.executeWithTimeout(
      async () => provider.injectBug(context.baselineDir, context.workspaceDir, context.prompt),
      this.config.bugInjectionTimeoutMs,
      'Bug injection exceeded time limit'
    );
  }

  async executeFixAttempt(context: FixAttemptExecutionContext): Promise<ProviderExecutionResult> {
    const provider = this.getProvider(context.participant);

    try {
      const result = await provider.fixAttempt(
        context.buggyDir,
        context.workspaceDir,
        context.prompt
      );
      return this.validateAndNormalizeResult(result, 'fix attempt');
    } catch (error) {
      return {
        success: false,
        message: `Fix attempt failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async executeFixAttemptWithTimeout(
    context: FixAttemptExecutionContext
  ): Promise<Result<TimedProviderExecutionResult, Error>> {
    const provider = this.getProvider(context.participant);
    return this.executeWithTimeout(
      async () => provider.fixAttempt(context.buggyDir, context.workspaceDir, context.prompt),
      this.config.fixAttemptTimeoutMs,
      'Fix attempt exceeded time limit'
    );
  }

  private getProvider(participant: ParticipantId): LLMProvider {
    const provider = this.providers.get(participant);
    if (!provider) {
      throw new Error(`No provider found for participant ${participant.getValue()}`);
    }
    return provider;
  }

  private validateAndNormalizeResult(
    result: { success: boolean; message: string },
    operation: string
  ): ProviderExecutionResult {
    if (typeof result.success !== 'boolean') {
      throw new Error(
        `Provider returned invalid success value for ${operation}: ${result.success}`
      );
    }

    if (typeof result.message !== 'string') {
      throw new Error(`Provider returned invalid message for ${operation}: ${result.message}`);
    }

    return {
      success: result.success,
      message: result.message,
    };
  }

  private async executeWithTimeout(
    operation: () => Promise<ProviderExecutionResult>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<Result<TimedProviderExecutionResult, Error>> {
    const startTime = Date.now();

    try {
      const result = await this.withTimeout(operation(), timeoutMs, timeoutMessage);
      const validatedResult = this.validateAndNormalizeResult(result, 'operation');
      const durationMs = Date.now() - startTime;
      const duration = Duration.fromSeconds(Math.floor(durationMs / 1000));

      return ok({ result: validatedResult, duration });
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
