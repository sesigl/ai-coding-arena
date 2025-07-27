// ABOUTME: Simple CLI interface for running competitions from the terminal
// Minimal implementation with basic error handling and progress reporting
/* eslint-disable no-console */

import { SimpleCompetitionRunner } from 'competition/simple-runner';
import { EventStore } from 'infrastructure/event-store/event-store';
import { MockProvider } from 'providers/mock-provider/mock-provider';
import { ClaudeCodeProvider } from 'providers/claude-code-provider/claude-code-provider';
import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { ResultsFormatter } from 'results/formatter';
import { CompetitionResult, MultiParticipantCompetitionResult } from 'competition/simple-runner';
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
  providerNames: string[] = ['mock-provider']
): Promise<void> {
  console.log('🏁 Starting AI Coding Arena Competition...');
  console.log(`📁 Workspace: ${workspaceDir}`);
  console.log(`🤖 Providers: ${providerNames.join(', ')}`);

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

    // Create providers from names
    const providers = providerNames.map(name => createProvider(name));

    if (providers.length === 1) {
      // Single participant competition
      const provider = providers[0];
      if (!provider) {
        throw new Error('Provider not found at index 0');
      }
      console.log(`🚀 Running single-participant competition with ${provider.name}...`);

      const result = await runner.runCompetition(provider);

      if (result.isOk()) {
        await handleSingleParticipantResult(result.value, competitionId, eventStore);
      } else {
        console.error('💥 Competition error:', result.error.message);
        process.exit(1);
      }
    } else {
      // Multi-participant competition
      console.log(`🚀 Running multi-participant competition with ${providers.length} providers...`);

      const result = await runner.runMultiParticipantCompetition(providers);

      if (result.isOk()) {
        await handleMultiParticipantResult(result.value, competitionId, eventStore);
      } else {
        console.error('💥 Competition error:', result.error.message);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    console.log('🧹 Cleaning up...');
    await eventStore.close();
  }
}

async function handleSingleParticipantResult(
  competitionResult: CompetitionResult,
  competitionId: CompetitionId,
  eventStore: EventStore
): Promise<void> {
  if (competitionResult.success) {
    console.log('✅ Competition completed successfully!');
    console.log(`📝 Result: ${competitionResult.message}`);
    console.log(`👤 Participant: ${competitionResult.participantId}`);
  } else {
    console.log('❌ Competition failed');
    console.log(`📝 Error: ${competitionResult.message}`);
    console.log(`👤 Participant: ${competitionResult.participantId}`);
  }

  await showResultsSummary(competitionId, eventStore);

  if (!competitionResult.success) {
    process.exit(1);
  }
}

async function handleMultiParticipantResult(
  competitionResult: MultiParticipantCompetitionResult,
  competitionId: CompetitionId,
  eventStore: EventStore
): Promise<void> {
  if (competitionResult.overallSuccess) {
    console.log('✅ Multi-participant competition completed successfully!');
  } else {
    console.log('❌ Multi-participant competition completed with failures');
  }

  console.log(`📝 Summary: ${competitionResult.summary}`);

  // Show individual participant results
  console.log('\n👥 Participant Results:');
  for (const result of competitionResult.participantResults) {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.participantId}: ${result.message}`);
  }

  await showResultsSummary(competitionId, eventStore);

  if (!competitionResult.overallSuccess) {
    process.exit(1);
  }
}

async function showResultsSummary(
  competitionId: CompetitionId,
  eventStore: EventStore
): Promise<void> {
  console.log('\n📊 Competition Results:');
  const formatter = new ResultsFormatter(eventStore);
  const resultsResult = await formatter.formatCompetitionResults(competitionId);

  if (resultsResult.isOk()) {
    const summary = resultsResult.value;
    console.log(formatter.formatAsJson(summary));
  } else {
    console.error('⚠️  Failed to generate results:', resultsResult.error.message);
  }
}

// CLI entry point
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: npm run cli <workspace-dir> [provider1] [provider2] ...');
    console.error('Providers: mock-provider (default), claude-code');
    console.error('Examples:');
    console.error('  npm run cli ./my-workspace');
    console.error('  npm run cli ./my-workspace mock-provider');
    console.error('  npm run cli ./my-workspace claude-code');
    console.error('  npm run cli ./my-workspace mock-provider claude-code');
    process.exit(1);
  }

  const workspaceDir = args[0] as string;
  const providerNames = args.length > 1 ? args.slice(1) : ['mock-provider'];
  await runCompetition(workspaceDir, providerNames);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 CLI error:', error);
    process.exit(1);
  });
}
