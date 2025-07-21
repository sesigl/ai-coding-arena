// ABOUTME: Simple CLI interface for running competitions from the terminal
// Minimal implementation with basic error handling and progress reporting

import { SimpleCompetitionRunner } from 'competition/simple-runner';
import { EventStore } from 'infrastructure/event-store/event-store';
import { MockProvider } from 'providers/mock-provider/mock-provider';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { join } from 'path';
import { tmpdir } from 'os';

export async function runCompetition(workspaceDir: string): Promise<void> {
  console.log('🏁 Starting AI Coding Arena Competition...');
  console.log(`📁 Workspace: ${workspaceDir}`);

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
    const provider = new MockProvider();

    console.log(`🤖 Running competition with ${provider.name}...`);

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

  if (args.length !== 1) {
    console.error('Usage: npm run cli <workspace-dir>');
    console.error('Example: npm run cli ./my-workspace');
    process.exit(1);
  }

  const workspaceDir = args[0];
  await runCompetition(workspaceDir);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 CLI error:', error);
    process.exit(1);
  });
}
