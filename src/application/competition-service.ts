// ABOUTME: Competition service for orchestrating complete competitions with provider resolution
// Handles provider lookup, participant mapping, and competition execution coordination

import { Game } from 'domain/competition/game/game';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { SystemPrompts } from 'domain/competition-prompts/system-prompts';
import { WorkspaceService } from 'infrastructure/workspace/workspace-service';
import { StaticLLMProviderFactory } from 'infrastructure/llm-provider/static-llm-provider-factory';
import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { CodingAgentProviderService } from 'application/coding-agent-provider-service';
import { Result, err, ok } from 'neverthrow';
import { join } from 'path';
import { mkdir, readdir, stat } from 'fs/promises';

export interface CompetitionResult {
  finalSummary: unknown;
}

export interface GameEvent {
  type:
    | 'round-started'
    | 'baseline-attempt'
    | 'bug-injection-attempt'
    | 'fix-attempt'
    | 'round-finished';
  timestamp: Date;
  [key: string]: unknown;
}

export type CompetitionEventCallback = (event: GameEvent) => void;

export class CompetitionService {
  private readonly game: Game;
  private readonly participantProviders: Map<string, string>;
  private readonly participants: readonly ParticipantId[];
  private eventListeners: Array<(event: GameEvent) => void> = [];
  private workspaceBaseDir: string = '';

  constructor(
    private readonly workspaceService: WorkspaceService = new WorkspaceService(),
    private readonly providerFactory = new StaticLLMProviderFactory(),
    private readonly providerExecutor: CodingAgentProviderService = new CodingAgentProviderService()
  ) {
    this.game = new Game();
    this.participantProviders = new Map();
    this.participants = [];
  }

  async runCompetition(
    providerNames: string[],
    rounds: number,
    eventCallback?: CompetitionEventCallback
  ): Promise<Result<CompetitionResult, Error>> {
    if (providerNames.length < 3) {
      return err(new Error('Game runner requires at least 3 providers for competitive gameplay'));
    }

    const workspaceResult = await this.workspaceService.withWorkspace(
      'competition',
      async (workspaceDir: string) => {
        const providers = this.resolveProviders(providerNames);
        const participantMap = this.createParticipantMap(providers);

        // Initialize competition state
        this.initializeCompetition(participantMap, workspaceDir, eventCallback);

        const finalSummary = await this.start(rounds);

        return { finalSummary };
      }
    );

    if (workspaceResult.isErr()) {
      return err(workspaceResult.error);
    }

    return ok(workspaceResult.value);
  }

  private initializeCompetition(
    participantProviders: Map<string, string>,
    workspaceBaseDir: string,
    eventCallback?: CompetitionEventCallback
  ): void {
    this.participantProviders.clear();
    participantProviders.forEach((value, key) => {
      this.participantProviders.set(key, value);
    });

    (this.participants as ParticipantId[]).length = 0;
    (this.participants as ParticipantId[]).push(
      ...Array.from(participantProviders.keys()).map(p => ParticipantId.fromString(p))
    );

    this.workspaceBaseDir = workspaceBaseDir;
    this.eventListeners = [];

    if (eventCallback) {
      this.onEvent(eventCallback);
    }
  }

  private onEvent(listener: (event: GameEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emitEvent(event: Omit<GameEvent, 'timestamp'>): void {
    const eventWithTimestamp = { ...event, timestamp: new Date() } as GameEvent;
    this.eventListeners.forEach(listener => listener(eventWithTimestamp));
  }

  private async start(totalRounds: number) {
    // Register all participants with the game so they appear in final summary
    for (const participant of this.participants) {
      this.game.registerParticipant(participant);
    }

    for (let round = 1; round <= totalRounds; round++) {
      await this.runRound(round);
    }

    return this.game.getFinalSummary();
  }

  private async runRound(roundNumber: number): Promise<void> {
    const baselineAuthor = this.participants[(roundNumber - 1) % this.participants.length];
    if (!baselineAuthor) {
      throw new Error('No baseline author found for round');
    }

    this.game.startRound(roundNumber, baselineAuthor);
    this.emitEvent({
      type: 'round-started',
      round: roundNumber,
      baselineAuthor: baselineAuthor.getValue(),
    });

    // Execute baseline creation
    const baselineResult = await this.executeBaselineCreation(baselineAuthor);
    this.emitEvent({
      type: 'baseline-attempt',
      participant: baselineAuthor.getValue(),
      success: baselineResult.success,
      message: baselineResult.message,
      workspacePath: this.getTaskWorkspace(baselineAuthor, 'baseline', this.game.getCurrentRound()),
    });

    if (baselineResult.success) {
      this.game.recordBaselineSuccess(baselineAuthor);

      // Find bug injector (next participant who isn't baseline author)
      const bugInjector = this.participants.find(p => !p.equals(baselineAuthor));
      if (!bugInjector) {
        throw new Error('No valid participant found for bug injection');
      }

      const bugResult = await this.executeBugInjection(bugInjector, baselineAuthor);
      this.emitEvent({
        type: 'bug-injection-attempt',
        participant: bugInjector.getValue(),
        success: bugResult.success,
        message: bugResult.message,
        workspacePath: this.getTaskWorkspace(
          bugInjector,
          'buginjection',
          this.game.getCurrentRound()
        ),
      });

      if (bugResult.success) {
        this.game.recordBugInjectionSuccess(bugInjector);

        // Find fixer (participant who isn't baseline author or bug injector)
        const fixer = this.participants.find(
          p => !p.equals(baselineAuthor) && !p.equals(bugInjector)
        );
        if (!fixer) {
          throw new Error('No valid participant found for fix attempt');
        }

        const fixResult = await this.executeFixAttempt(fixer, bugInjector);
        this.emitEvent({
          type: 'fix-attempt',
          participant: fixer.getValue(),
          success: fixResult.success,
          message: fixResult.message,
          workspacePath: this.getTaskWorkspace(fixer, 'fixattempt', this.game.getCurrentRound()),
        });

        if (fixResult.success) {
          this.game.recordFixSuccess(fixer);
        } else {
          this.game.recordFixFailure(fixer);
        }
      } else {
        this.game.recordBugInjectionFailure(bugInjector);
      }
    } else {
      this.game.recordBaselineFailure(baselineAuthor);
    }

    this.game.finishRound();
    this.emitEvent({
      type: 'round-finished',
      round: roundNumber,
      scores: this.getCurrentScores(),
    });
  }

  private async executeBaselineCreation(
    participant: ParticipantId
  ): Promise<{ success: boolean; message: string }> {
    const workspaceDir = this.getTaskWorkspace(
      participant,
      'baseline',
      this.game.getCurrentRound()
    );

    try {
      await this.validateWorkspaceIsEmpty(workspaceDir);
      await mkdir(workspaceDir, { recursive: true });
      const prompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
      const providerName = this.participantProviders.get(participant.getValue());
      if (!providerName) {
        throw new Error(`No provider assigned to participant ${participant.getValue()}`);
      }

      return this.providerExecutor.executeBaseline({
        providerName,
        workspaceDir,
        prompt,
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeBugInjection(
    bugInjector: ParticipantId,
    baselineAuthor: ParticipantId
  ): Promise<{ success: boolean; message: string }> {
    const baselineDir = this.getTaskWorkspace(
      baselineAuthor,
      'baseline',
      this.game.getCurrentRound()
    );
    const workspaceDir = this.getTaskWorkspace(
      bugInjector,
      'buginjection',
      this.game.getCurrentRound()
    );

    try {
      await this.validateWorkspaceIsEmpty(workspaceDir);
      await mkdir(workspaceDir, { recursive: true });
      const prompt = SystemPrompts.formatPrompt(SystemPrompts.BUG_INJECTION);
      const providerName = this.participantProviders.get(bugInjector.getValue());
      if (!providerName) {
        throw new Error(`No provider assigned to participant ${bugInjector.getValue()}`);
      }

      return this.providerExecutor.executeBugInjection({
        providerName,
        baselineDir,
        workspaceDir,
        prompt,
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeFixAttempt(
    fixer: ParticipantId,
    bugInjector: ParticipantId
  ): Promise<{ success: boolean; message: string }> {
    const buggyDir = this.getTaskWorkspace(
      bugInjector,
      'buginjection',
      this.game.getCurrentRound()
    );
    const workspaceDir = this.getTaskWorkspace(fixer, 'fixattempt', this.game.getCurrentRound());

    try {
      await this.validateWorkspaceIsEmpty(workspaceDir);
      await mkdir(workspaceDir, { recursive: true });
      const prompt = SystemPrompts.formatPrompt(SystemPrompts.FIX_ATTEMPT);
      const providerName = this.participantProviders.get(fixer.getValue());
      if (!providerName) {
        throw new Error(`No provider assigned to participant ${fixer.getValue()}`);
      }

      return this.providerExecutor.executeFixAttempt({
        providerName,
        buggyDir,
        workspaceDir,
        prompt,
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private getTaskWorkspace(participant: ParticipantId, task: string, round: number): string {
    return join(this.workspaceBaseDir, `${participant.getValue()}-round${round}-${task}`);
  }

  private async validateWorkspaceIsEmpty(workspaceDir: string): Promise<void> {
    try {
      const stats = await stat(workspaceDir);
      if (stats.isDirectory()) {
        const contents = await readdir(workspaceDir);
        if (contents.length > 0) {
          throw new Error(
            `Workspace directory is not empty: ${workspaceDir}. Contains: ${contents.join(', ')}`
          );
        }
      }
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  private getCurrentScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const participant of this.participants) {
      scores[participant.getValue()] = this.game.getScore(participant);
    }
    return scores;
  }

  private resolveProviders(providerNames: string[]): LLMProvider[] {
    return providerNames.map(name => {
      const provider = this.providerFactory.getProviderByName(name);
      if (!provider) {
        throw new Error(`Provider not found: ${name}`);
      }
      return provider;
    });
  }

  private createParticipantMap(providers: LLMProvider[]): Map<string, string> {
    const participantMap = new Map<string, string>();
    providers.forEach((provider, index) => {
      const participantName = `${provider.name}-${index + 1}`;
      participantMap.set(participantName, provider.name);
    });
    return participantMap;
  }
}
