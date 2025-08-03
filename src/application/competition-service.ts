// ABOUTME: Competition service for orchestrating complete competitions with provider resolution
// Handles provider lookup, participant mapping, and competition execution coordination

import { GameRunner } from 'interfaces/cli/game-runner';
import { WorkspaceService } from 'application/workspace-service';
import { StaticLLMProviderFactory } from 'infrastructure/llm-provider/static-llm-provider-factory';
import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { Result, err, ok } from 'neverthrow';

export interface CompetitionResult {
  finalSummary: unknown;
}

export type CompetitionEventCallback = (event: {
  type: string;
  timestamp: Date;
  [key: string]: unknown;
}) => void;

export class CompetitionService {
  constructor(
    private readonly workspaceService: WorkspaceService = new WorkspaceService(),
    private readonly providerFactory = new StaticLLMProviderFactory()
  ) {}

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
        const runner = new GameRunner(participantMap, workspaceDir);

        if (eventCallback) {
          runner.onEvent(eventCallback);
        }

        const finalSummary = await runner.start(rounds);

        return { finalSummary };
      }
    );

    if (workspaceResult.isErr()) {
      return err(workspaceResult.error);
    }

    return ok(workspaceResult.value);
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
