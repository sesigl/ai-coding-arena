// ABOUTME: Simple CLI interface for running competitions from the terminal
// Minimal implementation with basic error handling and progress reporting
/* eslint-disable no-console */

import { config } from 'dotenv';
config();

import { GameRunner } from 'competition/game-runner';
import { MockProvider } from 'infrastructure/coding-agent-providers/mock-provider/mock-provider';
import { ClaudeCodeProvider } from 'infrastructure/coding-agent-providers/claude-code-provider/claude-code-provider';
import { GeminiCliProvider } from 'infrastructure/coding-agent-providers/gemini-cli-provider/gemini-cli-provider';
import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { WorkspaceService } from 'competition/services/workspace-service';

function createProvider(providerName: string): LLMProvider {
  switch (providerName) {
    case 'mock-provider':
    case 'mock':
      return new MockProvider();
    case 'claude-code':
    case 'claude':
      return new ClaudeCodeProvider();
    case 'gemini-cli':
    case 'gemini':
      return new GeminiCliProvider();
    default:
      throw new Error(
        `Unknown provider: ${providerName}. Available providers: mock-provider, claude-code, gemini-cli`
      );
  }
}

export async function runCompetition(
  providerNames: string[] = ['mock-provider', 'mock-provider', 'mock-provider'],
  rounds: number = 3
): Promise<void> {
  console.log('🏁 Starting AI Coding Arena Competition...');
  console.log(`🤖 Providers: ${providerNames.join(', ')}`);
  console.log(`🔄 Rounds: ${rounds}`);

  if (providerNames.length < 3) {
    console.error(
      '💥 Game runner requires at least 3 providers for competitive gameplay (baseline creator, bug injector, fixer)'
    );
    process.exit(1);
  }

  const workspaceService = new WorkspaceService();

  const result = await workspaceService.withWorkspace(
    'competition',
    async (workspaceDir: string) => {
      console.log(`📁 Workspace: ${workspaceDir}`);

      const providers = providerNames.map(name => createProvider(name));
      const participantMap = createParticipantMap(providers);
      const runner = new GameRunner(participantMap, workspaceDir);

      setupEventLogging(runner);
      const finalSummary = await runner.start(rounds);

      console.log('\n🏆 Final Results:');
      console.log(JSON.stringify(finalSummary, null, 2));

      return finalSummary;
    }
  );

  if (result.isErr()) {
    console.error('💥 Unexpected error:', result.error.message);
    process.exit(1);
  }
}

function createParticipantMap(providers: LLMProvider[]): Map<ParticipantId, LLMProvider> {
  const participantMap = new Map<ParticipantId, LLMProvider>();
  providers.forEach((provider, index) => {
    const participantId = ParticipantId.fromString(`${provider.name}-${index + 1}`);
    participantMap.set(participantId, provider);
  });
  return participantMap;
}

function setupEventLogging(runner: GameRunner): void {
  runner.onEvent(event => {
    switch (event.type) {
      case 'round-started': {
        console.log(`\n🔄 Round ${event.round} started - Baseline author: ${event.baselineAuthor}`);
        break;
      }
      case 'baseline-attempt': {
        const baselineStatus = event.success ? '✅' : '❌';
        console.log(`  ${baselineStatus} Baseline: ${event.participant} - ${event.message}`);
        if (event.workspacePath) {
          console.log(`    📁 Workspace: ${event.workspacePath}`);
        }
        break;
      }
      case 'bug-injection-attempt': {
        const bugStatus = event.success ? '✅' : '❌';
        console.log(`  ${bugStatus} Bug injection: ${event.participant} - ${event.message}`);
        if (event.workspacePath) {
          console.log(`    📁 Workspace: ${event.workspacePath}`);
        }
        break;
      }
      case 'fix-attempt': {
        const fixStatus = event.success ? '✅' : '❌';
        console.log(`  ${fixStatus} Fix attempt: ${event.participant} - ${event.message}`);
        if (event.workspacePath) {
          console.log(`    📁 Workspace: ${event.workspacePath}`);
        }
        break;
      }
      case 'round-finished': {
        console.log(`\n📊 Round ${event.round} completed. Current scores:`);
        if (event.scores && typeof event.scores === 'object') {
          Object.entries(event.scores).forEach(([participant, score]) => {
            console.log(`  ${participant}: ${score}`);
          });
        }
        break;
      }
    }
  });
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let providerNames: string[] = [];
  let rounds = 3;

  // Parse arguments for providers and rounds
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg.startsWith('--rounds=')) {
      rounds = parseInt(arg.split('=')[1] as string, 10) || 3;
    } else {
      providerNames.push(arg);
    }
  }

  if (providerNames.length === 0) {
    providerNames = ['mock-provider', 'mock-provider', 'mock-provider']; // Default to 3 mock providers
  }

  if (providerNames.length < 3) {
    console.error('Usage: npm run cli [provider1] [provider2] [provider3] ... [--rounds=N]');
    console.error(
      'Providers: mock-provider, claude-code, gemini-cli (minimum 3 required for competitive gameplay)'
    );
    console.error('Examples:');
    console.error('  npm run cli mock-provider mock-provider claude-code');
    console.error('  npm run cli mock-provider claude-code gemini-cli --rounds=5');
    console.error('  npm run cli gemini-cli claude-code mock-provider');
    process.exit(1);
  }

  // Warning for insufficient rounds for fair competition
  if (rounds < providerNames.length) {
    console.warn('⚠️  WARNING: Competition fairness compromised!');
    console.warn(`   Rounds (${rounds}) < Participants (${providerNames.length})`);
    console.warn(`   For fair competition, each participant should get equal opportunities.`);
    console.warn(`   Recommended: --rounds=${providerNames.length} or higher`);
    console.warn('   Continuing anyway...\n');
  }

  await runCompetition(providerNames, rounds);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 CLI error:', error);
    process.exit(1);
  });
}
