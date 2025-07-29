// ABOUTME: SimpleCompetitionRunner for single-participant baseline creation workflow
// Refactored implementation using SOLID principles with proper service separation

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { EventStore } from 'infrastructure/event-store/event-store';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';
import { Phase } from 'domain/competition-event/phase';
import { SystemPrompts } from 'domain/competition-prompts/system-prompts';
import { Result, ok, err } from 'neverthrow';

import { WorkspaceService } from './services/workspace-service';
import { ProviderExecutionService } from './services/provider-execution-service';
import { CompetitionEventService } from './services/competition-event-service';
import { ValidationService } from './services/validation-service';

export interface CompetitionResult {
  readonly success: boolean;
  readonly message: string;
  readonly participantId: string;
  readonly workspaceDir?: string | undefined;
}

export interface MultiParticipantCompetitionResult {
  readonly overallSuccess: boolean;
  readonly participantResults: CompetitionResult[];
  readonly summary: string;
}

export class SimpleCompetitionRunner {
  private readonly workspaceService: WorkspaceService;
  private readonly executionService: ProviderExecutionService;
  private readonly eventService: CompetitionEventService;
  private readonly validationService: ValidationService;

  constructor(
    private readonly eventStore: EventStore,
    private readonly competitionId: CompetitionId
  ) {
    this.workspaceService = new WorkspaceService();
    this.executionService = new ProviderExecutionService();
    this.eventService = new CompetitionEventService(eventStore, competitionId);
    this.validationService = new ValidationService();
  }

  private async createBaselineOnly(
    provider: LLMProvider
  ): Promise<Result<CompetitionResult, Error>> {
    const participantId = ParticipantId.fromString(provider.name);
    const workspacePrefix = `competition-${this.competitionId.getValue()}-${provider.name}`;

    return this.workspaceService.withWorkspace(workspacePrefix, async workspaceDir => {
      await this.eventService.logPhaseStart(
        EventType.BASELINE_CREATION_STARTED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, workspaceDir }
      );

      const baselinePrompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
      const executionResult = await this.executionService.executeBaselineCreation(
        provider,
        workspaceDir,
        baselinePrompt
      );

      if (executionResult.isErr()) {
        await this.eventService.logError(
          EventType.BASELINE_COMPLETED,
          Phase.BASELINE,
          participantId,
          executionResult.error
        );
        throw executionResult.error;
      }

      const { result, duration } = executionResult.value;

      await this.eventService.logPhaseComplete(
        EventType.BASELINE_COMPLETED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, result },
        result.success,
        duration
      );

      return {
        success: result.success,
        message: result.message,
        participantId: provider.name,
        workspaceDir: undefined,
      };
    });
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
      await this.eventService.logSystemEvent(EventType.COMPETITION_STARTED, Phase.BASELINE, {
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

      await this.eventService.logSystemEvent(EventType.COMPETITION_COMPLETED, Phase.FIX_ATTEMPT, {
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
    const competitionPrefix = this.competitionId.getValue();
    const workspacePrefixes = [
      `baseline-${competitionPrefix}-${provider.name}`,
      `buggy-${competitionPrefix}-${provider.name}`,
      `fix-${competitionPrefix}-${provider.name}`,
    ];

    return this.workspaceService.withMultipleWorkspaces(
      workspacePrefixes,
      async (workspaceDirs: string[]) => {
        const [baselineDir, buggyDir, fixDir] = workspaceDirs;

        if (!baselineDir || !buggyDir || !fixDir) {
          throw new Error('Failed to create required workspaces');
        }
        // Baseline phase
        await this.eventService.logPhaseStart(
          EventType.BASELINE_CREATION_STARTED,
          Phase.BASELINE,
          participantId,
          { provider: provider.name, baselineDir }
        );

        const baselinePrompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
        const baselineResult = await this.executionService.executeBaselineCreation(
          provider,
          baselineDir,
          baselinePrompt
        );

        if (baselineResult.isErr()) {
          await this.eventService.logError(
            EventType.BASELINE_COMPLETED,
            Phase.BASELINE,
            participantId,
            baselineResult.error
          );
          throw baselineResult.error;
        }

        const { result: baselineOutcome, duration: baselineDuration } = baselineResult.value;

        await this.eventService.logPhaseComplete(
          EventType.BASELINE_COMPLETED,
          Phase.BASELINE,
          participantId,
          { provider: provider.name, result: baselineOutcome },
          baselineOutcome.success,
          baselineDuration
        );

        if (!baselineOutcome.success) {
          return {
            success: false,
            message: `Baseline creation failed: ${baselineOutcome.message}`,
            participantId: provider.name,
            workspaceDir: undefined,
          };
        }

        // Validate baseline
        const baselineValidationResult =
          await this.validationService.validateBaselineSetup(baselineDir);
        if (baselineValidationResult.isErr()) {
          throw baselineValidationResult.error;
        }

        const baselineValidation = baselineValidationResult.value;
        if (!baselineValidation.success) {
          throw new Error(baselineValidation.message);
        }

        // Bug injection phase
        await this.eventService.logPhaseStart(
          EventType.BUG_INJECTION_STARTED,
          Phase.BUG_INJECTION,
          participantId,
          { provider: provider.name, baselineDir, buggyDir }
        );

        const bugInjectionPrompt = SystemPrompts.formatPrompt(SystemPrompts.BUG_INJECTION);
        const bugInjectionResult = await this.executionService.executeBugInjection(
          provider,
          baselineDir,
          buggyDir,
          bugInjectionPrompt
        );

        if (bugInjectionResult.isErr()) {
          await this.eventService.logError(
            EventType.BUG_INJECTION_COMPLETED,
            Phase.BUG_INJECTION,
            participantId,
            bugInjectionResult.error
          );
          throw bugInjectionResult.error;
        }

        const { result: bugInjectionOutcome, duration: bugInjectionDuration } =
          bugInjectionResult.value;

        await this.eventService.logPhaseComplete(
          EventType.BUG_INJECTION_COMPLETED,
          Phase.BUG_INJECTION,
          participantId,
          { provider: provider.name, result: bugInjectionOutcome },
          bugInjectionOutcome.success,
          bugInjectionDuration
        );

        if (!bugInjectionOutcome.success) {
          return {
            success: false,
            message: `Bug injection failed: ${bugInjectionOutcome.message}`,
            participantId: provider.name,
            workspaceDir: undefined,
          };
        }

        // Validate bug injection
        const bugValidationResult = await this.validationService.validateBugInjection(buggyDir);
        if (bugValidationResult.isErr()) {
          throw bugValidationResult.error;
        }

        const bugValidation = bugValidationResult.value;
        if (!bugValidation.success) {
          throw new Error(bugValidation.message);
        }

        // Fix attempt phase
        await this.eventService.logPhaseStart(
          EventType.FIX_ATTEMPT_STARTED,
          Phase.FIX_ATTEMPT,
          participantId,
          { provider: provider.name, buggyDir, fixDir }
        );

        const fixPrompt = SystemPrompts.formatPrompt(SystemPrompts.FIX_ATTEMPT);
        const fixResult = await this.executionService.executeFixAttempt(
          provider,
          buggyDir,
          fixDir,
          fixPrompt
        );

        if (fixResult.isErr()) {
          await this.eventService.logError(
            EventType.FIX_ATTEMPT_COMPLETED,
            Phase.FIX_ATTEMPT,
            participantId,
            fixResult.error
          );
          throw fixResult.error;
        }

        const { result: fixOutcome, duration: fixDuration } = fixResult.value;

        await this.eventService.logPhaseComplete(
          EventType.FIX_ATTEMPT_COMPLETED,
          Phase.FIX_ATTEMPT,
          participantId,
          { provider: provider.name, result: fixOutcome },
          fixOutcome.success,
          fixDuration
        );

        // Validate fix attempt
        const fixValidationResult = await this.validationService.validateFixAttempt(fixDir);
        if (fixValidationResult.isErr()) {
          throw new Error(`Fix validation failed: ${fixValidationResult.error.message}`);
        }

        const fixValidation = fixValidationResult.value;
        if (!fixValidation.success) {
          throw new Error(`Fix validation failed: ${fixValidation.message}`);
        }

        return {
          success: fixOutcome.success,
          message: `Three-phase workflow completed: ${baselineOutcome.message}, ${bugInjectionOutcome.message}, ${fixOutcome.message}`,
          participantId: provider.name,
          workspaceDir: undefined,
        };
      }
    );
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
