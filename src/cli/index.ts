// ABOUTME: Simple CLI interface for running competitions from the terminal
// Minimal implementation with basic error handling and progress reporting
/* eslint-disable no-console */

import { SimpleCompetitionRunner } from 'competition/simple-runner';
import { EventStore } from 'infrastructure/event-store/event-store';
import { MockProvider } from 'providers/mock-provider/mock-provider';
import { ClaudeCodeProvider } from 'providers/claude-code-provider/claude-code-provider';
import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { join } from 'path';
import { tmpdir } from 'os';

function createProvider(providerName: string): LLMProvider {
  switch (providerName) {
    case 'mock-provider':
    case 'mock':
      return new MockProvider();
    case 'claude-code':
    case 'claude':
      return new ClaudeCodeProvider();
    default:
      throw new Error(
        `Unknown provider: ${providerName}. Available providers: mock-provider, claude-code`
      );
  }
}

export async function runCompetition(
  workspaceDir: string,
  providerName = 'mock-provider'
): Promise<void> {
  console.log('🏁 Starting AI Coding Arena Competition...');
  console.log(`📁 Workspace: ${workspaceDir}`);
  console.log(`🤖 Provider: ${providerName}`);

  const dbPath = join(tmpdir(), `competition-${Date.now()}.db`);
  const eventStore = new EventStore(dbPath);

  try {
    console.log('🔧 Initializing event store...');
    const initResult = await eventStore.initialize();
    if (initResult.isErr()) {
      console.error('💥 Failed to initialize event store:', initResult.error.message);
      process.exit(1);
    }

    const competitionId = new CompetitionId(`comp-${Date.now()}`);
    const runner = new SimpleCompetitionRunner(eventStore, competitionId);
    const provider = createProvider(providerName);

    console.log(`🚀 Running competition with ${provider.name}...`);

    const result = await runner.runCompetition(provider);

    if (result.isOk()) {
      const competitionResult = result.value;

      if (competitionResult.success) {
        console.log('✅ Competition completed successfully!');
        console.log(`📝 Result: ${competitionResult.message}`);
        console.log(`👤 Participant: ${competitionResult.participantId}`);
      } else {
        console.log('❌ Competition failed');
        console.log(`📝 Error: ${competitionResult.message}`);
        console.log(`👤 Participant: ${competitionResult.participantId}`);
        process.exit(1);
      }
    } else {
      console.error('💥 Competition error:', result.error.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    console.log('🧹 Cleaning up...');
    await eventStore.close();
  }
}

// CLI entry point
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.length > 2) {
    console.error('Usage: npm run cli <workspace-dir> [provider]');
    console.error('Providers: mock-provider (default), claude-code');
    console.error('Examples:');
    console.error('  npm run cli ./my-workspace');
    console.error('  npm run cli ./my-workspace mock-provider');
    console.error('  npm run cli ./my-workspace claude-code');
    process.exit(1);
  }

  const workspaceDir = args[0] as string;
  const providerName = args[1] || 'mock-provider';
  await runCompetition(workspaceDir, providerName);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 CLI error:', error);
    process.exit(1);
  });
}
