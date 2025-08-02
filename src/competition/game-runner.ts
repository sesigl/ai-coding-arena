// ABOUTME: Game runner orchestrating competition flow with event emission and real provider interactions
// Provides CLI-friendly API for running complete games with behavior-driven participant simulation

import { Game } from './game/game';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { SystemPrompts } from 'domain/competition-prompts/system-prompts';
import { join } from 'path';
import { mkdir, readdir, stat } from 'fs/promises';

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

export class GameRunner {
  private readonly game: Game;
  private readonly participants: readonly ParticipantId[];
  private eventListeners: Array<(event: GameEvent) => void> = [];

  constructor(
    private readonly providers: Map<ParticipantId, LLMProvider>,
    private readonly workspaceBaseDir: string
  ) {
    this.game = new Game();
    this.participants = Array.from(providers.keys());
  }

  onEvent(listener: (event: GameEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emitEvent(event: Omit<GameEvent, 'timestamp'>): void {
    const eventWithTimestamp = { ...event, timestamp: new Date() } as GameEvent;
    this.eventListeners.forEach(listener => listener(eventWithTimestamp));
  }

  async start(totalRounds: number) {
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
    const provider = this.providers.get(participant);
    if (!provider) {
      throw new Error(`No provider found for participant ${participant.getValue()}`);
    }
    const workspaceDir = this.getTaskWorkspace(
      participant,
      'baseline',
      this.game.getCurrentRound()
    );

    try {
      await this.validateWorkspaceIsEmpty(workspaceDir);
      await mkdir(workspaceDir, { recursive: true });
      const prompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
      return provider.createCodingExercise(workspaceDir, prompt);
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
    const provider = this.providers.get(bugInjector);
    if (!provider) {
      throw new Error(`No provider found for participant ${bugInjector.getValue()}`);
    }
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
      return provider.injectBug(baselineDir, workspaceDir, prompt);
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
    const provider = this.providers.get(fixer);
    if (!provider) {
      throw new Error(`No provider found for participant ${fixer.getValue()}`);
    }
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
      return provider.fixAttempt(buggyDir, workspaceDir, prompt);
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
}
