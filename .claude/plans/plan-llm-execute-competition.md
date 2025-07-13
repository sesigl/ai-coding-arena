# LLM Coding Competition System - Implementation Plan

## High-Level Blueprint

This plan breaks down the implementation into small, testable increments that build on each other. Each step is designed to be implemented safely with strong testing while making meaningful progress.

## Phase 1: Foundation (Data Layer & Core Types)

### Step 1: Project Setup & Event Storage Core
- Initialize TypeScript project with strict configuration
- Set up DuckDB integration with event schema
- Create core event types and storage interfaces
- Basic event insertion and querying

### Step 2: Event Store Implementation
- Implement EventStore class with CRUD operations
- Add connection management and error handling
- Create event querying by competition, type, and participant
- Add comprehensive unit tests

### Step 3: Domain Models & Configuration
- Define core domain types (Competition, Round, Participant)
- Create configuration validation and parsing
- Add result types for all operations
- Implement error hierarchy

## Phase 2: LLM Provider Abstraction

### Step 4: LLM Provider Interface
- Define LLMProvider interface and result types
- Create base implementation with common functionality
- Add provider registry and factory pattern
- Mock provider for testing

### Step 5: File System Operations
- Directory management utilities (create, clean, copy)
- File diff capture and analysis
- Workspace isolation and cleanup
- Integration with event logging

### Step 6: Claude Code Provider
- Implement ClaudeCodeProvider with real CLI integration
- Command execution with timeout and error handling
- Output parsing and event capture
- Comprehensive integration tests

## Phase 3: Competition Core Logic

### Step 7: Competition Runner Foundation
- CompetitionRunner class with basic lifecycle
- Round orchestration and participant rotation
- Event logging for all major operations
- Configuration validation and setup

### Step 8: Baseline Creation Phase
- Implement baseline creation workflow
- Test execution and coverage validation
- File artifact management
- Timeout handling with proper cleanup

### Step 9: Bug Injection Phase
- Bug injection workflow implementation
- Test failure validation
- Code diff capture and storage
- Integration with baseline artifacts

### Step 10: Fix Attempt Phase
- Fix attempt workflow implementation
- Test restoration validation
- Success/failure determination
- Complete round artifact collection

## Phase 4: Results & Statistics

### Step 11: Event Processing Engine
- Event aggregation and analysis utilities
- Statistics calculation from event streams
- Performance metrics computation
- Data validation and consistency checks

### Step 12: Results Generation
- JSON results formatting
- Leaderboard calculation
- Individual and competition statistics
- Export functionality

## Phase 5: CLI & Integration

### Step 13: CLI Interface
- Command-line argument parsing
- Configuration file support
- Progress reporting and logging
- Error reporting and help

### Step 14: End-to-End Integration
- Complete competition flow testing
- Multi-round competition execution
- Error handling and recovery
- Performance optimization

### Step 15: Additional Provider Support
- Gemini CLI provider implementation
- Provider abstraction refinement
- Multi-provider competition testing
- Documentation and examples

---

## Implementation Prompts

Each prompt below builds on the previous ones and should be executed in sequence. No code should be left orphaned - everything must integrate with previous steps.

---

## Prompt 1: Project Setup & Event Storage Core ✅ COMPLETED

```
You are implementing the foundation of an LLM coding competition system. Set up a new TypeScript project with strict configuration and implement the core event storage system using DuckDB.

Requirements:
1. Initialize a TypeScript project with strict mode, proper tsconfig.json
2. Add necessary dependencies: duckdb, @types/node, vitest for testing
3. Create the event schema in DuckDB as specified in .claude/plans/spec-llm-execute-competition.md
4. Implement basic event types and interfaces
5. Create a simple EventStore class that can insert and query events
6. Add unit tests for all functionality

Project structure should be:
```
src/
├── types/
│   ├── events.ts      # Event types and interfaces
│   └── index.ts       # Re-exports
├── storage/
│   ├── event-store.ts # EventStore implementation
│   └── schema.sql     # Database schema
├── index.ts           # Main exports
└── __tests__/
    └── event-store.test.ts

package.json
tsconfig.json
vitest.config.ts
```

Focus on:
- Type safety with strict TypeScript
- Proper error handling with Result types
- Connection management for DuckDB
- Comprehensive test coverage
- Clean, testable abstractions

Follow TDD: write tests first, then implement to make them pass.
```

---

## Prompt 2: Event Store Implementation ✅ COMPLETED

```
Building on the previous implementation, add only the minimal querying capabilities needed for the next step.

Context: You now have basic event types and a simple EventStore with insert and basic get functionality.

Requirements (MINIMAL - only what's needed):
1. Add just these query methods:
   - `getEventsByCompetition(competitionId: CompetitionId): Promise<Result<CompetitionEvent[], Error>>`
   - `getEventsByParticipant(participantId: ParticipantId): Promise<Result<CompetitionEvent[], Error>>`
2. Add basic `close(): Promise<void>` method for cleanup
3. Keep existing error handling simple with Result types

DO NOT ADD:
- Time range filters (not needed yet)
- Query builders (not needed yet) 
- Connection pooling (not needed yet)
- Advanced statistics (not needed yet)
- Complex error types (not needed yet)

Add minimal tests covering:
- The two new query methods
- Basic error handling
- Connection cleanup

Ensure all code integrates cleanly with existing event types from Prompt 1.
```

---

## Prompt 3: Minimal Mock Provider

```
Create a simple mock LLM provider to enable testing the first competition workflow.

Context: You have basic event storage. Now create the simplest possible provider to test a workflow.

Requirements (MINIMAL - only what's needed):
1. Create a simple `MockProvider` interface:
   ```typescript
   interface LLMProvider {
     readonly name: string;
     createBaseline(workspaceDir: string): Promise<{success: boolean, message: string}>;
   }
   ```
2. Implement `MockProvider` that:
   - Always succeeds with `success: true`
   - Creates a simple "Hello World" program with test
   - Returns a success message
3. Create basic workspace utilities:
   - `createWorkspace(name: string): Promise<string>` - creates temp directory
   - `cleanupWorkspace(dir: string): Promise<void>` - removes directory

Key files to create:
```
src/
├── providers/
│   ├── types.ts          # LLMProvider interface
│   └── mock-provider.ts  # Mock implementation
├── utils/
│   └── workspace.ts      # Workspace utilities
├── __tests__/
│   └── mock-provider.test.ts
```

DO NOT ADD:
- Complex domain models (not needed yet)
- Configuration system (not needed yet)
- Multiple provider types (not needed yet)
- Bug injection/fix phases (not needed yet)

Focus on:
- Simple, working provider that can be tested
- Basic file system operations
- Minimal error handling

This sets up the foundation for testing a basic competition workflow.
```

---

## Prompt 4: Basic Competition Runner

```
Create a minimal competition runner that can execute a single-participant baseline creation.

Context: You have EventStore and MockProvider. Now create the simplest possible competition.

Requirements (MINIMAL - only what's needed):
1. Create `SimpleCompetitionRunner` that:
   - Takes a single provider and workspace directory
   - Executes baseline creation phase only
   - Logs events to EventStore
   - Returns success/failure result
2. Basic competition flow:
   - Create workspace
   - Run provider.createBaseline()
   - Log start/end events
   - Cleanup workspace
   - Return result

Key files to create:
```
src/
├── competition/
│   └── simple-runner.ts     # Minimal competition runner
├── __tests__/
│   └── simple-runner.test.ts
```

DO NOT ADD:
- Multiple participants (not needed yet)
- Rounds system (not needed yet)
- Bug injection/fix phases (not needed yet)
- Complex configuration (not needed yet)
- Scoring system (not needed yet)

Focus on:
- Single provider baseline creation workflow
- Event logging integration
- Basic error handling and cleanup

This creates the foundation for more complex competition features.
```

---

## Prompt 5: Add Bug Injection to Mock Provider

```
Extend the MockProvider to support bug injection, enabling a two-phase competition workflow.

Context: You have a working single-phase competition with baseline creation. Now add bug injection.

Requirements (MINIMAL - only what's needed):
1. Extend `LLMProvider` interface:
   ```typescript
   interface LLMProvider {
     readonly name: string;
     createBaseline(workspaceDir: string): Promise<{success: boolean, message: string}>;
     injectBug(baselineDir: string, workspaceDir: string): Promise<{success: boolean, message: string}>;
   }
   ```
2. Update `MockProvider` to:
   - Copy baseline to new workspace
   - Modify one source file to introduce a simple bug (break a test)
   - Return success result
3. Update `SimpleCompetitionRunner` to:
   - Support two-phase workflow: baseline → bug injection
   - Log events for both phases

Key files to update:
```
src/
├── providers/
│   ├── types.ts          # Updated interface
│   └── mock-provider.ts  # Add injectBug method
├── competition/
│   └── simple-runner.ts  # Add bug injection phase
├── __tests__/
│   ├── mock-provider.test.ts
│   └── simple-runner.test.ts
```

DO NOT ADD:
- Fix attempt phase (not needed yet)
- Multiple participants (not needed yet)
- Complex file diffing (not needed yet)
- Test execution validation (not needed yet)

Focus on:
- Two-phase workflow with proper workspace isolation
- Simple bug injection that breaks tests
- Event logging for both phases

This enables testing a more complete competition workflow.
```

---

## Prompt 6: Add Fix Attempt Phase

```
Extend the MockProvider to support the fix attempt phase, completing the three-phase competition workflow.

Context: You have baseline creation and bug injection working. Now add the final fix attempt phase.

Requirements (MINIMAL - only what's needed):
1. Extend `LLMProvider` interface:
   ```typescript
   interface LLMProvider {
     readonly name: string;
     createBaseline(workspaceDir: string): Promise<{success: boolean, message: string}>;
     injectBug(baselineDir: string, workspaceDir: string): Promise<{success: boolean, message: string}>;
     fixAttempt(buggyDir: string, workspaceDir: string): Promise<{success: boolean, message: string}>;
   }
   ```
2. Update `MockProvider` to:
   - Copy buggy code to new workspace
   - "Fix" the bug by reverting the change
   - Return success result
3. Update `SimpleCompetitionRunner` to:
   - Support three-phase workflow: baseline → bug injection → fix attempt
   - Log events for all phases
   - Return final competition result

Key files to update:
```
src/
├── providers/
│   ├── types.ts          # Updated interface
│   └── mock-provider.ts  # Add fixAttempt method
├── competition/
│   └── simple-runner.ts  # Add fix attempt phase
├── __tests__/
│   ├── mock-provider.test.ts
│   └── simple-runner.test.ts
```

DO NOT ADD:
- Real CLI integration (not needed yet)
- Multiple participants (not needed yet)
- Scoring system (not needed yet)
- Test execution validation (not needed yet)

Focus on:
- Complete three-phase workflow
- Event logging for full audit trail
- Basic success/failure tracking

This completes the core competition workflow with mock provider.
```

---

## Prompt 7: Simple CLI Interface

```
Create a basic command-line interface to run competitions from the terminal.

Context: You have a working three-phase competition with MockProvider. Now add a simple CLI.

Requirements (MINIMAL - only what's needed):
1. Create simple CLI that:
   - Takes workspace directory as argument
   - Runs a single competition with MockProvider
   - Prints progress and results to console
   - Handles basic errors gracefully
2. Basic structure:
   ```typescript
   // src/cli/index.ts
   async function runCompetition(workspaceDir: string): Promise<void>
   ```

Key files to create:
```
src/
├── cli/
│   └── index.ts         # Simple CLI entry point
├── bin/
│   └── ai-coding-arena  # Executable script
├── __tests__/
│   └── cli.test.ts
```

CLI functionality:
```bash
npm run cli ./workspace-dir  # Run competition in workspace-dir
```

DO NOT ADD:
- Complex argument parsing (not needed yet)
- Configuration files (not needed yet)
- Multiple commands (not needed yet)
- Help system (not needed yet)

Focus on:
- Single command execution
- Basic error handling and logging
- Integration with SimpleCompetitionRunner

This provides a simple way to test the complete workflow.
```

---

## Prompt 8: Add Claude Code Provider

```
Replace MockProvider with a real ClaudeCodeProvider that executes actual `claude` CLI commands.

Context: You have a working end-to-end system with MockProvider. Now integrate with real Claude Code CLI.

Requirements (MINIMAL - only what's needed):
1. Create `ClaudeCodeProvider` that:
   - Implements same interface as MockProvider
   - Executes `claude` CLI commands with basic process management
   - Returns success/failure results
2. Handle three phases:
   - `createBaseline()`: Run claude with baseline creation prompt
   - `injectBug()`: Run claude with bug injection prompt  
   - `fixAttempt()`: Run claude with fix attempt prompt
3. Basic timeout handling (30 second default)
4. Simple error handling for CLI failures

Key files to create:
```
src/
├── providers/
│   └── claude-code-provider.ts  # Claude CLI implementation
├── __tests__/
│   └── claude-code-provider.test.ts
```

DO NOT ADD:
- Complex validation (not needed yet)
- Test coverage checking (not needed yet)
- Artifact collection (not needed yet)
- Complex output parsing (not needed yet)

Focus on:
- Basic CLI command execution
- Simple prompts for each phase
- Timeout handling
- Integration with existing LLMProvider interface

This allows testing with real Claude Code CLI instead of mocks.
```

---

## Prompt 9: Add Results Output

```
Add simple results output to show competition statistics after completion.

Context: You have a working competition system. Now add basic results reporting.

Requirements (MINIMAL - only what's needed):
1. Create simple results formatter that:
   - Shows competition summary (start/end times, participants)
   - Lists phase results (success/failure for each phase)
   - Displays basic statistics (success rates)
   - Outputs to console as JSON
2. Integrate with CLI to show results after competition

Key files to create:
```
src/
├── results/
│   └── formatter.ts     # Results formatting
├── __tests__/
│   └── formatter.test.ts
```

DO NOT ADD:
- Complex analytics (not needed yet)
- Performance metrics (not needed yet)
- Trend analysis (not needed yet)
- Data visualization (not needed yet)

Focus on:
- Simple, readable JSON output
- Basic competition statistics
- Integration with existing event data

This provides visibility into competition outcomes.
```

---

## Prompt 10: Add Multi-Participant Support

```
Extend the system to support multiple participants in a single competition.

Context: You have single-participant competitions working. Now add multiple participants.

Requirements (MINIMAL - only what's needed):
1. Update `SimpleCompetitionRunner` to:
   - Accept array of providers instead of single provider
   - Run each participant through all three phases
   - Track results per participant
   - Handle participant failures gracefully
2. Update CLI to support multiple provider names:
   ```bash
   npm run cli ./workspace-dir claude-code mock-provider
   ```

Key files to update:
```
src/
├── competition/
│   └── simple-runner.ts  # Add multi-participant support
├── cli/
│   └── index.ts         # Accept multiple provider args
```

DO NOT ADD:
- Rounds system (not needed yet)
- Participant rotation (not needed yet)
- Complex scoring (not needed yet)
- Parallel execution (not needed yet)

Focus on:
- Sequential execution of multiple participants
- Individual result tracking
- Basic error isolation between participants

This enables basic multi-participant competitions.
```

---

## Summary

This simplified implementation plan provides 10 focused prompts that build a complete LLM coding competition system incrementally:

1. **Project Setup & Event Storage Core** ✅ COMPLETED - Basic TypeScript project with DuckDB event storage
2. **Event Store Implementation** ✅ COMPLETED - Basic querying capabilities
3. **Minimal Mock Provider** - Simple provider for testing workflows
4. **Basic Competition Runner** - Single-participant baseline creation
5. **Add Bug Injection to Mock Provider** - Two-phase workflow
6. **Add Fix Attempt Phase** - Complete three-phase workflow
7. **Simple CLI Interface** - Basic command-line execution
8. **Add Claude Code Provider** - Real CLI integration
9. **Add Results Output** - Basic statistics and reporting
10. **Add Multi-Participant Support** - Multiple providers in one competition

Each prompt:
- **Builds incrementally** with minimal features only
- **Avoids premature complexity** - no unused methods or over-engineered abstractions
- **Maintains working software** after every step
- **Follows TDD principles** with focused testing
- **Focuses on real value** - working features over comprehensive APIs

The plan progresses from a simple working system to gradually more capable features, ensuring nothing is built until it's actually needed.