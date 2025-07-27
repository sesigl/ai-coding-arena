// ABOUTME: SimpleCompetitionRunner for single-participant baseline creation workflow
// Minimal implementation following TDD with proper error handling and event logging

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { EventStore } from 'infrastructure/event-store/event-store';
import { createWorkspace, cleanupWorkspace } from 'infrastructure/workspace/workspace';
import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { EventId } from 'domain/competition-event/event-id';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { RoundId } from 'domain/competition-event/round-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';
import { Duration } from 'domain/competition-event/duration';
import { SystemPrompts } from 'domain/competition-prompts/system-prompts';
import { MakefileValidator } from 'infrastructure/contract-validator/makefile-validator';
import { Result, ok, err } from 'neverthrow';

export interface CompetitionResult {
  readonly success: boolean;
  readonly message: string;
  readonly participantId: string;
  readonly workspaceDir?: string;
}

export interface MultiParticipantCompetitionResult {
  readonly overallSuccess: boolean;
  readonly participantResults: CompetitionResult[];
  readonly summary: string;
}

export class SimpleCompetitionRunner {
  private readonly validator: MakefileValidator;

  constructor(
    private readonly eventStore: EventStore,
    private readonly competitionId: CompetitionId
  ) {
    this.validator = new MakefileValidator();
  }

  private async createBaselineOnly(
    provider: LLMProvider
  ): Promise<Result<CompetitionResult, Error>> {
    const participantId = ParticipantId.fromString(provider.name);
    let workspaceDir: string | undefined;

    try {
      workspaceDir = await createWorkspace(
        `competition-${this.competitionId.getValue()}-${provider.name}`
      );

      await this.logEvent(
        EventType.BASELINE_CREATION_STARTED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, workspaceDir },
        true
      );

      const baselinePrompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
      const codingExerciseResult = await this.createCodingExercise(
        provider,
        workspaceDir,
        baselinePrompt
      );

      await this.logEvent(
        EventType.BASELINE_COMPLETED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, result: codingExerciseResult.providerResult },
        codingExerciseResult.providerResult.success,
        codingExerciseResult.duration
      );

      const competitionResult: CompetitionResult = {
        success: codingExerciseResult.providerResult.success,
        message: codingExerciseResult.providerResult.message,
        participantId: provider.name,
        workspaceDir,
      };

      return ok(competitionResult);
    } catch (error) {
      if (participantId) {
        await this.logEvent(
          EventType.BASELINE_COMPLETED,
          Phase.BASELINE,
          participantId,
          {
            provider: provider.name,
            error: error instanceof Error ? error.message : String(error),
          },
          false
        );
      }

      return err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (workspaceDir) {
        await cleanupWorkspace(workspaceDir);
      }
    }
  }

  private async createCodingExercise(
    provider: LLMProvider,
    workspaceDir: string,
    prompt: string
  ): Promise<CodingExerciseResult> {
    const startTime = Date.now();
    const providerResult = await provider.createCodingExercise(workspaceDir, prompt);
    const durationMs = Date.now() - startTime;
    const duration = Duration.fromSeconds(Math.floor(durationMs / 1000));
    return new CodingExerciseResult({ providerResult, duration });
  }

  private async createBaselineAndInjectBug(
    provider: LLMProvider
  ): Promise<Result<CompetitionResult, Error>> {
    const participantId = ParticipantId.fromString(provider.name);
    let baselineDir: string | undefined;
    let buggyDir: string | undefined;

    try {
      baselineDir = await createWorkspace(
        `baseline-${this.competitionId.getValue()}-${provider.name}`
      );

      await this.logEvent(
        EventType.BASELINE_CREATION_STARTED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, baselineDir },
        true
      );

      const baselinePrompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
      const baselineStartTime = Date.now();
      const baselineResult = await provider.createCodingExercise(baselineDir, baselinePrompt);
      const baselineDuration = Duration.fromSeconds(
        Math.floor((Date.now() - baselineStartTime) / 1000)
      );

      await this.logEvent(
        EventType.BASELINE_COMPLETED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, result: baselineResult },
        baselineResult.success,
        baselineDuration
      );

      if (!baselineResult.success) {
        return ok({
          success: false,
          message: `Baseline creation failed: ${baselineResult.message}`,
          participantId: provider.name,
        });
      }

      buggyDir = await createWorkspace(`buggy-${this.competitionId.getValue()}-${provider.name}`);

      await this.logEvent(
        EventType.BUG_INJECTION_STARTED,
        Phase.BUG_INJECTION,
        participantId,
        { provider: provider.name, baselineDir, buggyDir },
        true
      );

      const bugInjectionPrompt = SystemPrompts.formatPrompt(SystemPrompts.BUG_INJECTION);
      const bugInjectionStartTime = Date.now();
      const bugInjectionResult = await provider.injectBug(
        baselineDir,
        buggyDir,
        bugInjectionPrompt
      );
      const bugInjectionDuration = Duration.fromSeconds(
        Math.floor((Date.now() - bugInjectionStartTime) / 1000)
      );

      await this.logEvent(
        EventType.BUG_INJECTION_COMPLETED,
        Phase.BUG_INJECTION,
        participantId,
        { provider: provider.name, result: bugInjectionResult },
        bugInjectionResult.success,
        bugInjectionDuration
      );

      const competitionResult: CompetitionResult = {
        success: bugInjectionResult.success,
        message: `Two-phase workflow completed: ${baselineResult.message}, ${bugInjectionResult.message}`,
        participantId: provider.name,
        workspaceDir: buggyDir,
      };

      return ok(competitionResult);
    } catch (error) {
      await this.logEvent(
        EventType.BUG_INJECTION_COMPLETED,
        Phase.BUG_INJECTION,
        participantId,
        {
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error),
        },
        false
      );

      return err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (baselineDir) {
        await cleanupWorkspace(baselineDir);
      }
      if (buggyDir) {
        await cleanupWorkspace(buggyDir);
      }
    }
  }

  async runMultiParticipantCompetition(
    providers: LLMProvider[]
  ): Promise<Result<MultiParticipantCompetitionResult, Error>> {
    if (providers.length === 0) {
      return err(new Error('At least one provider must be specified'));
    }

    const participantResults: CompetitionResult[] = [];
    let overallSuccess = true;

    try {
      await this.logSystemEvent(EventType.COMPETITION_STARTED, Phase.BASELINE, {
        participantCount: providers.length,
        providers: providers.map(p => p.name),
      });

      for (const provider of providers) {
        try {
          const participantResult = await this.runCompetition(provider);

          if (participantResult.isOk()) {
            participantResults.push(participantResult.value);
            if (!participantResult.value.success) {
              overallSuccess = false;
            }
          } else {
            const failedResult: CompetitionResult = {
              success: false,
              message: `Competition failed: ${participantResult.error.message}`,
              participantId: provider.name,
            };
            participantResults.push(failedResult);
            overallSuccess = false;
          }
        } catch (error) {
          const errorResult: CompetitionResult = {
            success: false,
            message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
            participantId: provider.name,
          };
          participantResults.push(errorResult);
          overallSuccess = false;
        }
      }

      await this.logSystemEvent(EventType.COMPETITION_COMPLETED, Phase.FIX_ATTEMPT, {
        participantCount: providers.length,
        successfulParticipants: participantResults.filter(r => r.success).length,
        overallSuccess,
      });

      const summary = this.createSummary(participantResults, overallSuccess);

      return ok({
        overallSuccess,
        participantResults,
        summary,
      });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async runCompetition(provider: LLMProvider): Promise<Result<CompetitionResult, Error>> {
    const participantId = ParticipantId.fromString(provider.name);
    let baselineDir: string | undefined;
    let buggyDir: string | undefined;
    let fixDir: string | undefined;

    try {
      baselineDir = await createWorkspace(
        `baseline-${this.competitionId.getValue()}-${provider.name}`
      );

      await this.logEvent(
        EventType.BASELINE_CREATION_STARTED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, baselineDir },
        true
      );

      const baselinePrompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
      const baselineStartTime = Date.now();
      const baselineResult = await provider.createCodingExercise(baselineDir, baselinePrompt);
      const baselineDuration = Duration.fromSeconds(
        Math.floor((Date.now() - baselineStartTime) / 1000)
      );

      await this.logEvent(
        EventType.BASELINE_COMPLETED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, result: baselineResult },
        baselineResult.success,
        baselineDuration
      );

      if (!baselineResult.success) {
        return ok({
          success: false,
          message: `Baseline creation failed: ${baselineResult.message}`,
          participantId: provider.name,
        });
      }

      const baselineValidation = await this.validator.validateSetupAndTest(baselineDir);
      if (!baselineValidation.success) {
        return err(new Error(baselineValidation.message));
      }

      buggyDir = await createWorkspace(`buggy-${this.competitionId.getValue()}-${provider.name}`);

      await this.logEvent(
        EventType.BUG_INJECTION_STARTED,
        Phase.BUG_INJECTION,
        participantId,
        { provider: provider.name, baselineDir, buggyDir },
        true
      );

      const bugInjectionPrompt = SystemPrompts.formatPrompt(SystemPrompts.BUG_INJECTION);
      const bugInjectionStartTime = Date.now();
      const bugInjectionResult = await provider.injectBug(
        baselineDir,
        buggyDir,
        bugInjectionPrompt
      );
      const bugInjectionDuration = Duration.fromSeconds(
        Math.floor((Date.now() - bugInjectionStartTime) / 1000)
      );

      await this.logEvent(
        EventType.BUG_INJECTION_COMPLETED,
        Phase.BUG_INJECTION,
        participantId,
        { provider: provider.name, result: bugInjectionResult },
        bugInjectionResult.success,
        bugInjectionDuration
      );

      if (!bugInjectionResult.success) {
        return ok({
          success: false,
          message: `Bug injection failed: ${bugInjectionResult.message}`,
          participantId: provider.name,
        });
      }

      const bugValidation = await this.validator.expectTestFailure(buggyDir);
      if (!bugValidation.success) {
        return err(new Error(bugValidation.message));
      }

      fixDir = await createWorkspace(`fix-${this.competitionId.getValue()}-${provider.name}`);

      await this.logEvent(
        EventType.FIX_ATTEMPT_STARTED,
        Phase.FIX_ATTEMPT,
        participantId,
        { provider: provider.name, buggyDir, fixDir },
        true
      );

      const fixPrompt = SystemPrompts.formatPrompt(SystemPrompts.FIX_ATTEMPT);
      const fixStartTime = Date.now();
      const fixResult = await provider.fixAttempt(buggyDir, fixDir, fixPrompt);
      const fixDuration = Duration.fromSeconds(Math.floor((Date.now() - fixStartTime) / 1000));

      await this.logEvent(
        EventType.FIX_ATTEMPT_COMPLETED,
        Phase.FIX_ATTEMPT,
        participantId,
        { provider: provider.name, result: fixResult },
        fixResult.success,
        fixDuration
      );

      const fixValidation = await this.validator.validateTestOnly(fixDir);
      if (!fixValidation.success) {
        return err(new Error(`Fix validation failed: ${fixValidation.message}`));
      }

      const competitionResult: CompetitionResult = {
        success: fixResult.success,
        message: `Three-phase workflow completed: ${baselineResult.message}, ${bugInjectionResult.message}, ${fixResult.message}`,
        participantId: provider.name,
        workspaceDir: fixDir,
      };

      return ok(competitionResult);
    } catch (error) {
      await this.logEvent(
        EventType.FIX_ATTEMPT_COMPLETED,
        Phase.FIX_ATTEMPT,
        participantId,
        {
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error),
        },
        false
      );

      return err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (baselineDir) {
        await cleanupWorkspace(baselineDir);
      }
      if (buggyDir) {
        await cleanupWorkspace(buggyDir);
      }
      if (fixDir) {
        await cleanupWorkspace(fixDir);
      }
    }
  }

  private async logEvent(
    eventType: EventType,
    phase: Phase,
    participantId: ParticipantId,
    data: Record<string, unknown>,
    success: boolean,
    duration: Duration = Duration.notMeasured()
  ): Promise<void> {
    const event = new CompetitionEvent(
      this.generateEventId(),
      new Date(),
      this.competitionId,
      RoundId.notApplicable(),
      participantId,
      eventType,
      phase,
      data,
      success,
      duration
    );

    const result = await this.eventStore.insertEvent(event);
    if (result.isErr()) {
      throw new Error(`Failed to log event: ${result.error.message}`);
    }
  }

  private generateEventId(): EventId {
    return EventId.generate();
  }

  private async logSystemEvent(
    eventType: EventType,
    phase: Phase,
    data: Record<string, unknown>
  ): Promise<void> {
    const event = new CompetitionEvent(
      this.generateEventId(),
      new Date(),
      this.competitionId,
      RoundId.notApplicable(),
      ParticipantId.system(), // System participant for competition-level events
      eventType,
      phase,
      data,
      true, // System events are always "successful"
      Duration.notMeasured()
    );

    const result = await this.eventStore.insertEvent(event);
    if (result.isErr()) {
      throw new Error(`Failed to log system event: ${result.error.message}`);
    }
  }

  private createSummary(participantResults: CompetitionResult[], overallSuccess: boolean): string {
    const totalParticipants = participantResults.length;
    const successfulParticipants = participantResults.filter(r => r.success).length;
    const failedParticipants = totalParticipants - successfulParticipants;

    const successRate =
      totalParticipants > 0 ? (successfulParticipants / totalParticipants) * 100 : 0;

    let summary = `Multi-participant competition completed. `;
    summary += `${successfulParticipants}/${totalParticipants} participants succeeded (${successRate.toFixed(1)}%). `;

    if (overallSuccess) {
      summary += 'Overall result: SUCCESS';
    } else {
      summary += `Overall result: FAILED (${failedParticipants} participant(s) failed)`;
    }

    return summary;
  }
}

class CodingExerciseResult {
  public readonly providerResult: { readonly success: boolean; readonly message: string };
  public readonly duration: Duration;

  constructor(
    readonly props: {
      providerResult: { readonly success: boolean; message: string };
      readonly duration: Duration;
    }
  ) {
    this.providerResult = props.providerResult;
    this.duration = props.duration;
  }
}
