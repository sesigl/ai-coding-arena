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
import { Result, ok, err } from 'neverthrow';

export interface CompetitionResult {
  readonly success: boolean;
  readonly message: string;
  readonly participantId: string;
  readonly workspaceDir?: string;
}

export class SimpleCompetitionRunner {
  constructor(
    private readonly eventStore: EventStore,
    private readonly competitionId: CompetitionId
  ) {}

  async runBaseline(provider: LLMProvider): Promise<Result<CompetitionResult, Error>> {
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

      const startTime = Date.now();
      const providerResult = await provider.createBaseline(workspaceDir);
      const durationMs = Date.now() - startTime;
      const duration = Duration.fromSeconds(Math.floor(durationMs / 1000));

      await this.logEvent(
        EventType.BASELINE_COMPLETED,
        Phase.BASELINE,
        participantId,
        { provider: provider.name, result: providerResult },
        providerResult.success,
        duration
      );

      const competitionResult: CompetitionResult = {
        success: providerResult.success,
        message: providerResult.message,
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

  async runTwoPhase(provider: LLMProvider): Promise<Result<CompetitionResult, Error>> {
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

      const baselineStartTime = Date.now();
      const baselineResult = await provider.createBaseline(baselineDir);
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

      const bugInjectionStartTime = Date.now();
      const bugInjectionResult = await provider.injectBug(baselineDir, buggyDir);
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
      // Log failure
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
    return new EventId(Date.now() + Math.floor(Math.random() * 1000));
  }
}
