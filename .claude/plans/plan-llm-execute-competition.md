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

## Prompt 2: Event Store Implementation

```
Building on the previous implementation, enhance the EventStore with full CRUD operations, proper connection management, and comprehensive querying capabilities.

Context: You now have basic event types and a simple EventStore. 

Requirements:
1. Enhance EventStore with methods for:
   - Querying events by competition_id
   - Querying events by event_type  
   - Querying events by participant_id
   - Querying events with time range filters
   - Getting event counts and statistics
2. Add proper connection pooling and lifecycle management
3. Implement database initialization and migration
4. Add comprehensive error handling with custom error types
5. Create query builder utilities for common patterns
6. Add performance indexes as specified in @.claude/plans/spec-llm-execute-competition.md

Key methods to implement:
- `getEventsByCompetition(competitionId: string): Promise<CompetitionEvent[]>`
- `getEventsByType(eventType: string): Promise<CompetitionEvent[]>`
- `getEventsByParticipant(participantId: string): Promise<CompetitionEvent[]>`
- `getEventCount(filters?: EventFilters): Promise<number>`
- `close(): Promise<void>`

Add comprehensive unit tests covering:
- All query methods with various filters
- Error conditions (DB connection failures, invalid queries)
- Connection lifecycle management
- Concurrent access patterns

Ensure all code integrates cleanly with the existing event types from Prompt 1.
```

---

## Prompt 3: Domain Models & Configuration

```
Building on the EventStore implementation, create the core domain models and configuration system for the competition.

Context: You have a working EventStore with comprehensive querying. Now add the business domain layer.

Requirements:
1. Create domain types based on @.claude/plans/spec-llm-execute-competition.md:
   - Competition (id, participants, rounds, config, status)
   - Round (id, number, phase, participants, results)  
   - Participant (id, name, provider type)
   - CompetitionConfig (participants, rounds, timeouts)
2. Implement configuration validation and parsing
3. Create Result types for all operations (success/error handling)
4. Add comprehensive domain validation rules
5. Create factory functions for domain objects
6. Implement serialization/deserialization for persistence

Key files to create:
```
src/
├── domain/
│   ├── competition.ts    # Competition domain model
│   ├── round.ts         # Round domain model  
│   ├── participant.ts   # Participant domain model
│   ├── config.ts        # Configuration types and validation
│   └── results.ts       # Result types and utilities
├── __tests__/
│   ├── competition.test.ts
│   ├── config.test.ts
│   └── results.test.ts
```

Focus on:
- Strong typing with branded types where appropriate
- Comprehensive validation with clear error messages
- Immutable domain objects where possible
- Factory patterns for complex object creation
- Integration with existing EventStore

Add extensive unit tests covering:
- Configuration validation (valid/invalid cases)
- Domain object creation and validation
- Serialization round-trips
- Error handling and edge cases

Ensure clean integration with existing EventStore from previous prompts.
```

---

## Prompt 4: LLM Provider Interface

```
Building on the domain models, implement the LLM provider abstraction layer that will be used to integrate with different LLM CLI tools.

Context: You have EventStore, domain models, and configuration. Now create the abstraction for LLM interactions.

Requirements:
1. Implement the LLMProvider interface as specified in @.claude/plans/spec-llm-execute-competition.md
2. Create result types for all provider operations (BaselineResult, BugResult, FixResult)
3. Implement a provider registry and factory system
4. Create a mock provider for testing
5. Add base provider implementation with common functionality
6. Implement timeout handling and process management
7. Add comprehensive logging and event integration

Key files to create:
```
src/
├── providers/
│   ├── types.ts          # Provider interfaces and result types
│   ├── base-provider.ts  # Base implementation with common logic
│   ├── mock-provider.ts  # Mock for testing
│   ├── registry.ts       # Provider registry and factory
│   └── index.ts          # Re-exports
├── __tests__/
│   ├── base-provider.test.ts
│   ├── mock-provider.test.ts
│   └── registry.test.ts
```

Key interfaces to implement:
```typescript
interface LLMProvider {
  readonly id: string;
  readonly name: string;
  createBaseline(prompt: string, workspaceDir: string, timeoutSeconds: number): Promise<BaselineResult>;
  injectBug(baselineDir: string, workspaceDir: string, timeoutSeconds: number): Promise<BugResult>;
  fixCode(buggyCodeDir: string, workspaceDir: string, timeoutSeconds: number): Promise<FixResult>;
}
```

Focus on:
- Clean abstraction that hides CLI implementation details
- Proper timeout and error handling
- Event integration for all operations
- Testable design with dependency injection
- Registry pattern for provider management

Add comprehensive tests covering:
- Provider interface compliance
- Timeout handling and cancellation
- Error conditions and edge cases
- Registry functionality (registration, lookup, validation)
- Mock provider behavior

Integrate with existing EventStore to log all provider operations.
```

---

## Prompt 5: File System Operations

```
Building on the provider abstraction, implement the file system utilities needed for workspace management, file operations, and diff capture.

Context: You have LLM providers that need to work with isolated workspaces and capture file changes.

Requirements:
1. Create workspace management utilities for isolated directories
2. Implement file diff capture and analysis
3. Add directory copying and synchronization
4. Create cleanup and lifecycle management
5. Integrate with event logging for all file operations
6. Add comprehensive error handling for file system operations

Key files to create:
```
src/
├── filesystem/
│   ├── workspace.ts     # Workspace creation and management
│   ├── diff.ts          # File diff capture and analysis
│   ├── operations.ts    # Core file operations (copy, move, delete)
│   ├── cleanup.ts       # Cleanup and lifecycle management
│   └── index.ts         # Re-exports
├── __tests__/
│   ├── workspace.test.ts
│   ├── diff.test.ts
│   └── operations.test.ts
```

Key functionality to implement:
- `createWorkspace(competitionId: string, roundId: number, participantId: string): Promise<string>`
- `copyDirectory(source: string, destination: string): Promise<void>`
- `captureFileDiff(originalDir: string, modifiedDir: string): Promise<FileDiff[]>`
- `cleanupWorkspace(workspaceDir: string): Promise<void>`
- `validateTestCoverage(workspaceDir: string): Promise<CoverageResult>`

Focus on:
- Atomic operations with proper cleanup on failure
- Cross-platform compatibility (Windows/macOS/Linux)
- Event integration for audit trail
- Performance optimization for large codebases
- Comprehensive error handling

Add extensive tests covering:
- Workspace isolation and cleanup
- File diff accuracy with various scenarios
- Error handling (permissions, disk space, concurrent access)
- Integration with event logging
- Performance with various file sizes

Ensure integration with existing EventStore and provider interfaces.
```

---

## Prompt 6: Claude Code Provider

```
Building on the provider interface and file system utilities, implement the Claude Code provider that executes real CLI commands.

Context: You have the LLMProvider interface, file system utilities, and workspace management. Now implement the first real provider.

Requirements:
1. Implement ClaudeCodeProvider class extending base provider
2. Execute real `claude` CLI commands with proper process management
3. Parse CLI output and capture all interactions
4. Implement all three phases: baseline creation, bug injection, fix attempts
5. Add comprehensive timeout and error handling
6. Integrate with event logging for full audit trail
7. Add validation for test coverage and compilation

Key files to create:
```
src/
├── providers/
│   ├── claude-code-provider.ts  # Main implementation
│   ├── claude-prompts.ts        # Prompt templates for each phase
│   └── claude-parser.ts         # Output parsing utilities
├── __tests__/
│   ├── claude-code-provider.test.ts
│   └── integration/
│       └── claude-integration.test.ts  # Real CLI tests (optional)
```

Key methods to implement:
- `createBaseline()`: Execute Claude with baseline creation prompt, validate 100% coverage
- `injectBug()`: Execute Claude with bug injection prompt, ensure tests fail
- `fixCode()`: Execute Claude with fix prompt, validate tests pass
- Command execution with timeout, cancellation, and cleanup

Focus on:
- Robust process management and cleanup
- Comprehensive output parsing and validation
- Detailed event logging for debugging
- Error handling for CLI failures, timeouts, invalid outputs
- Integration with workspace and file system utilities

Add thorough tests covering:
- All three operation phases
- Timeout and cancellation scenarios
- CLI error conditions (command not found, invalid output)
- Output parsing with various response formats
- Integration with file system and event logging

Note: Include integration tests that can run with actual `claude` CLI if available, but make them optional/skippable for CI.

Ensure seamless integration with existing provider registry and EventStore.
```

---

## Prompt 7: Competition Runner Foundation

```
Building on all previous components, implement the core CompetitionRunner that orchestrates the entire competition workflow.

Context: You have EventStore, domain models, providers, and file system utilities. Now create the orchestration layer.

Requirements:
1. Implement CompetitionRunner class with complete lifecycle management
2. Add round orchestration with participant rotation
3. Implement configuration validation and setup
4. Create comprehensive event logging for all operations
5. Add error handling with proper cleanup
6. Integrate all previous components into cohesive workflow

Key files to create:
```
src/
├── competition/
│   ├── runner.ts        # Main CompetitionRunner class
│   ├── orchestrator.ts  # Round and phase orchestration
│   ├── validator.ts     # Validation utilities
│   └── lifecycle.ts     # Lifecycle management
├── __tests__/
│   ├── runner.test.ts
│   ├── orchestrator.test.ts
│   └── integration/
│       └── competition-flow.test.ts
```

Key methods to implement:
- `start(config: CompetitionConfig): Promise<CompetitionResult>`
- `executeRound(round: Round): Promise<RoundResult>`
- `validateSetup(): Promise<ValidationResult>`
- `cleanup(): Promise<void>`

Competition flow:
1. Validate configuration and providers
2. Create competition directory structure
3. Initialize event logging
4. Execute rounds with participant rotation
5. Collect results and cleanup
6. Generate final statistics

Focus on:
- Clean error handling with proper resource cleanup
- Comprehensive logging of all major operations
- Integration with all existing components
- Testable design with dependency injection
- Performance monitoring and timeout management

Add comprehensive tests covering:
- Full competition workflow with mock providers
- Error handling and cleanup scenarios
- Configuration validation
- Round rotation logic
- Integration with EventStore and file system

Ensure all previously implemented components are properly integrated and no code is orphaned.
```

---

## Prompt 8: Baseline Creation Phase

```
Building on the CompetitionRunner foundation, implement the detailed baseline creation workflow with validation and artifact management.

Context: You have the CompetitionRunner structure. Now implement the first phase of the competition workflow.

Requirements:
1. Implement detailed baseline creation workflow
2. Add test execution and coverage validation (100% requirement)
3. Implement comprehensive artifact management and storage
4. Add timeout handling with proper cleanup
5. Create detailed event logging for debugging
6. Integrate with provider interface and file system utilities

Key files to enhance/create:
```
src/
├── phases/
│   ├── baseline-phase.ts    # Baseline creation implementation
│   ├── validation.ts        # Test and coverage validation
│   └── artifacts.ts         # Artifact collection and storage
├── __tests__/
│   ├── baseline-phase.test.ts
│   └── validation.test.ts
```

Key functionality:
- `executeBaselineCreation(participant: Participant, workspace: string): Promise<BaselineResult>`
- `validateTestCoverage(workspaceDir: string): Promise<CoverageValidation>`
- `validateTestExecution(workspaceDir: string): Promise<TestValidation>`
- `collectBaselineArtifacts(workspaceDir: string): Promise<ArtifactCollection>`

Validation requirements:
- All tests must pass (green status)
- 100% line and branch coverage required
- Code must compile without errors
- No external dependencies or I/O operations

Focus on:
- Rigorous validation with clear error messages
- Comprehensive artifact collection (code, tests, coverage reports)
- Detailed event logging for audit trail
- Timeout handling with workspace cleanup
- Integration with existing provider and file system components

Add thorough tests covering:
- Successful baseline creation with valid code
- Validation failures (coverage < 100%, failing tests, compilation errors)
- Timeout scenarios with proper cleanup
- Artifact collection and storage
- Event logging accuracy

Ensure seamless integration with CompetitionRunner and existing components.
```

---

## Prompt 9: Bug Injection Phase

```
Building on the baseline creation phase, implement the bug injection workflow with validation and diff capture.

Context: You have working baseline creation with validation. Now implement the bug injection phase.

Requirements:
1. Implement bug injection workflow that modifies existing baseline
2. Add validation that exactly one bug is introduced (tests fail)
3. Implement code diff capture between original and buggy versions
4. Add test immutability validation (tests cannot be modified)
5. Create comprehensive artifact management for bug injection
6. Integrate with event logging and timeout handling

Key files to enhance/create:
```
src/
├── phases/
│   ├── bug-injection-phase.ts  # Bug injection implementation
│   ├── bug-validation.ts       # Bug introduction validation
│   └── diff-capture.ts         # Code diff analysis
├── __tests__/
│   ├── bug-injection-phase.test.ts
│   ├── bug-validation.test.ts
│   └── diff-capture.test.ts
```

Key functionality:
- `executeBugInjection(participant: Participant, baselineDir: string, workspace: string): Promise<BugResult>`
- `validateBugIntroduction(originalDir: string, buggyDir: string): Promise<BugValidation>`
- `validateTestImmutability(originalDir: string, buggyDir: string): Promise<TestValidation>`
- `captureBugDiff(originalDir: string, buggyDir: string): Promise<FileDiff[]>`

Validation requirements:
- At least one test must fail after bug injection
- Test files must remain completely unchanged
- Code must still compile (syntax errors not allowed)
- Only one logical bug should be introduced

Focus on:
- Precise diff analysis to detect unauthorized test changes
- Comprehensive validation of bug introduction
- Detailed artifact collection (original vs buggy code)
- Event logging for complete audit trail
- Error handling for invalid bug attempts

Add comprehensive tests covering:
- Successful bug injection with failing tests
- Validation failures (no failing tests, test modifications, syntax errors)
- Edge cases (multiple bugs, complex diffs)
- Test immutability enforcement
- Timeout and error handling scenarios

Ensure integration with existing baseline phase and CompetitionRunner.
```

---

## Prompt 10: Fix Attempt Phase

```
Building on the bug injection phase, implement the fix attempt workflow that completes the competition round.

Context: You have baseline creation and bug injection working. Now implement the final phase where participants attempt to fix bugs.

Requirements:
1. Implement fix attempt workflow starting from buggy code
2. Add validation that all tests pass after fix attempt
3. Implement test immutability validation (tests still cannot be modified)
4. Add comprehensive artifact collection for complete round
5. Create scoring logic based on success/failure
6. Integrate with complete round completion and statistics

Key files to enhance/create:
```
src/
├── phases/
│   ├── fix-attempt-phase.ts    # Fix attempt implementation
│   ├── fix-validation.ts       # Fix success validation
│   └── round-completion.ts     # Round finalization
├── scoring/
│   ├── scoring-engine.ts       # Point calculation logic
│   └── round-results.ts        # Round result aggregation
├── __tests__/
│   ├── fix-attempt-phase.test.ts
│   ├── fix-validation.test.ts
│   └── scoring-engine.test.ts
```

Key functionality:
- `executeFixAttempt(participant: Participant, buggyDir: string, workspace: string): Promise<FixResult>`
- `validateFixSuccess(originalDir: string, fixedDir: string): Promise<FixValidation>`
- `validateTestsStillImmutable(originalDir: string, fixedDir: string): Promise<TestValidation>`
- `calculateRoundScore(roundResults: RoundResult[]): Promise<ScoreResult>`
- `completeRound(roundId: string, results: PhaseResult[]): Promise<RoundCompletion>`

Validation requirements:
- All tests must pass (green status) after fix
- Test files must remain unchanged from original baseline
- Code must compile without errors
- Fix must address the introduced bug

Scoring logic (from spec):
- Successful fix: +1 point to fixer
- Unfixed bug: +1 point to bug creator  
- Invalid baseline: -1 point to baseline creator

Focus on:
- Comprehensive validation of fix success
- Accurate scoring based on round outcomes
- Complete artifact collection for round analysis
- Detailed event logging for full audit trail
- Integration with all previous phases

Add thorough tests covering:
- Successful fix attempts with passing tests
- Failed fix attempts (tests still failing, compilation errors)
- Test immutability validation throughout entire round
- Scoring calculation with various round outcomes
- Complete round workflow integration

Ensure seamless integration with baseline and bug injection phases to complete the full competition round workflow.
```

---

## Prompt 11: Event Processing Engine

```
Building on the complete competition phases, implement the event processing engine that computes statistics and insights from stored events.

Context: You have a complete competition workflow storing detailed events. Now create the analysis layer.

Requirements:
1. Implement event aggregation and analysis utilities
2. Create statistics calculation from event streams
3. Add performance metrics computation (timing, success rates)
4. Implement data validation and consistency checks
5. Create flexible querying for different analysis needs
6. Add caching for expensive calculations

Key files to create:
```
src/
├── analytics/
│   ├── event-processor.ts      # Core event processing engine
│   ├── statistics-calculator.ts # Statistics computation
│   ├── performance-analyzer.ts  # Performance metrics
│   ├── aggregators.ts          # Event aggregation utilities
│   └── validators.ts           # Data consistency validation
├── __tests__/
│   ├── event-processor.test.ts
│   ├── statistics-calculator.test.ts
│   └── performance-analyzer.test.ts
```

Key functionality:
- `processCompetitionEvents(competitionId: string): Promise<CompetitionAnalysis>`
- `calculateParticipantStats(participantId: string, events: CompetitionEvent[]): Promise<ParticipantStats>`
- `analyzePerformanceMetrics(events: CompetitionEvent[]): Promise<PerformanceMetrics>`
- `validateEventConsistency(events: CompetitionEvent[]): Promise<ValidationResult>`
- `aggregateRoundResults(roundEvents: CompetitionEvent[]): Promise<RoundSummary>`

Statistics to compute:
- Success rates by phase (baseline, bug injection, fix attempts)
- Average execution times for each phase
- Competition and round completion rates
- Participant performance comparisons
- Trend analysis over multiple competitions

Focus on:
- Efficient event processing with large datasets
- Accurate statistical calculations with proper error handling
- Flexible aggregation that supports various analysis queries
- Data validation to ensure consistency
- Performance optimization with caching strategies

Add comprehensive tests covering:
- Statistical accuracy with known datasets
- Performance with large event collections
- Edge cases (empty datasets, incomplete competitions)
- Data validation and error detection
- Caching behavior and invalidation

Integrate with existing EventStore to provide complete analytics capabilities.
```

---

## Prompt 12: Results Generation

```
Building on the event processing engine, implement the results generation system that produces the final JSON output.

Context: You have event processing and statistics calculation. Now create the final output formatting.

Requirements:
1. Implement JSON results formatting as specified in @.claude/plans/spec-llm-execute-competition.md
2. Create leaderboard calculation and ranking
3. Add individual and competition statistics formatting
4. Implement export functionality with proper error handling
5. Add result validation and consistency checks
6. Create flexible formatting for different output needs

Key files to create:
```
src/
├── results/
│   ├── results-generator.ts    # Main results generation
│   ├── leaderboard.ts         # Leaderboard calculation and ranking
│   ├── formatters.ts          # JSON formatting utilities
│   ├── exporters.ts           # Export functionality
│   └── validators.ts          # Result validation
├── __tests__/
│   ├── results-generator.test.ts
│   ├── leaderboard.test.ts
│   └── formatters.test.ts
```

Key functionality:
- `generateCompetitionResults(competitionId: string): Promise<CompetitionResults>`
- `calculateLeaderboard(participantStats: ParticipantStats[]): Promise<LeaderboardEntry[]>`
- `formatIndividualStats(participantId: string, events: CompetitionEvent[]): Promise<IndividualStats>`
- `exportResults(results: CompetitionResults, format: OutputFormat): Promise<string>`
- `validateResults(results: CompetitionResults): Promise<ValidationResult>`

Output format (from @.claude/plans/spec-llm-execute-competition.md):
- Competition summary with timing and participants
- Leaderboard with scores and rankings
- Individual statistics with success rates and timings
- Round-by-round details with outcomes

Focus on:
- Exact format compliance with @.claude/plans/spec-llm-execute-competition.md requirements
- Accurate ranking and tie-breaking logic
- Comprehensive data validation
- Clean JSON structure with proper typing
- Error handling for incomplete or invalid data

Add thorough tests covering:
- Complete results generation with various competition scenarios
- Leaderboard calculation with ties and edge cases
- Individual statistics accuracy
- JSON format validation
- Export functionality and error handling

Ensure integration with event processing engine and maintain consistency with all previous components.
```

---

## Prompt 13: CLI Interface

```
Building on the complete results generation system, implement the command-line interface that ties everything together.

Context: You have a complete competition system with results generation. Now create the user-facing CLI.

Requirements:
1. Implement command-line argument parsing and validation
2. Add configuration file support (JSON) with validation
3. Create progress reporting and real-time logging
4. Implement comprehensive error reporting and help
5. Add command structure for different operations
6. Integrate with all existing components

Key files to create:
```
src/
├── cli/
│   ├── index.ts              # Main CLI entry point
│   ├── commands.ts           # Command definitions and handlers
│   ├── config-loader.ts      # Configuration file handling
│   ├── progress-reporter.ts  # Progress and logging
│   └── error-handler.ts      # Error formatting and help
├── bin/
│   └── ai-coding-arena       # Executable script
├── __tests__/
│   ├── cli.test.ts
│   └── commands.test.ts
```

CLI commands to implement:
- `compete [config-file]` - Run a competition
- `validate-config <config-file>` - Validate configuration
- `list-providers` - Show available LLM providers
- `results <competition-id>` - Show competition results
- `help` - Show help information

Configuration file support:
```json
{
  "participants": ["claude-code", "mock-provider"],
  "rounds": 2,
  "timeouts": {
    "baseline_creation_seconds": 300,
    "bug_injection_seconds": 180,
    "fix_attempt_seconds": 240
  },
  "workspace_dir": "./competitions",
  "database_path": "./competitions.duckdb"
}
```

Focus on:
- Intuitive command-line interface with good help
- Comprehensive error messages with suggestions
- Real-time progress reporting during competitions
- Configuration validation with clear error messages
- Integration with all existing competition components

Add comprehensive tests covering:
- All CLI commands with various arguments
- Configuration loading and validation
- Error handling and help display
- Progress reporting functionality
- Integration with competition runner

Create proper executable script and package.json bin configuration for npm installation.
```

---

## Prompt 14: End-to-End Integration

```
Building on the complete CLI interface, implement comprehensive end-to-end integration testing and final system validation.

Context: You have all individual components working. Now ensure they work together seamlessly and add comprehensive integration testing.

Requirements:
1. Create end-to-end integration tests for complete competition flows
2. Add multi-round competition execution with validation
3. Implement comprehensive error handling and recovery testing
4. Add performance optimization and monitoring
5. Create example configurations and documentation
6. Validate all components work together seamlessly

Key files to create:
```
src/
├── __tests__/
│   ├── integration/
│   │   ├── full-competition.test.ts    # Complete competition flow
│   │   ├── multi-round.test.ts         # Multi-round scenarios
│   │   ├── error-scenarios.test.ts     # Error handling validation
│   │   └── performance.test.ts         # Performance testing
├── examples/
│   ├── basic-config.json               # Example configuration
│   ├── multi-provider-config.json      # Multiple providers
│   └── stress-test-config.json         # Performance testing
└── scripts/
    ├── setup-dev.sh                    # Development setup
    └── run-examples.sh                  # Example execution
```

Integration test scenarios:
1. Complete 2-round competition with mock providers
2. Error handling during each phase (timeout, validation failure)
3. Configuration validation and error reporting
4. Results generation and export
5. Database consistency after failures
6. Concurrent competition prevention

Performance considerations:
- Competition execution time monitoring
- Memory usage during large competitions
- Database query optimization
- File system operation efficiency

Focus on:
- Comprehensive end-to-end validation
- Real-world scenario testing
- Performance benchmarking and optimization
- Error recovery and system stability
- Documentation of expected behaviors

Add thorough integration tests covering:
- Complete competition workflows with various configurations
- Error injection and recovery scenarios
- Performance under load
- Database consistency and integrity
- CLI integration and user experience

Ensure all previous components integrate seamlessly and no functionality is orphaned or unreachable.
```

---

## Prompt 15: Additional Provider Support & Finalization

```
Building on the complete integrated system, add support for additional LLM providers and finalize the system with documentation and examples.

Context: You have a fully working system with Claude Code support. Now add Gemini CLI and finalize everything.

Requirements:
1. Implement Gemini CLI provider following the same pattern as Claude Code
2. Refine provider abstraction based on multi-provider learnings
3. Add comprehensive provider testing and validation
4. Create complete documentation and usage examples
5. Add final system validation and quality assurance
6. Prepare for production deployment

Key files to create/enhance:
```
src/
├── providers/
│   ├── gemini-cli-provider.ts   # Gemini CLI implementation
│   ├── gemini-prompts.ts        # Gemini-specific prompts
│   └── gemini-parser.ts         # Gemini output parsing
├── docs/
│   ├── README.md                # Complete system documentation
│   ├── SETUP.md                 # Installation and setup
│   ├── USAGE.md                 # Usage examples and tutorials
│   └── PROVIDERS.md             # Provider implementation guide
├── examples/
│   ├── competitions/            # Example competition outputs
│   └── configurations/          # Various config examples
├── __tests__/
│   ├── providers/
│   │   └── gemini-cli-provider.test.ts
│   └── system/
│       └── multi-provider.test.ts
```

Gemini CLI provider requirements:
- Implement same interface as Claude Code provider
- Handle Gemini-specific command syntax and output parsing
- Add comprehensive error handling for Gemini CLI failures
- Integrate with existing event logging and timeout systems

Final system validation:
1. Multi-provider competitions (Claude vs Gemini)
2. Provider abstraction robustness
3. Performance with different provider combinations
4. Error handling across all providers
5. Complete documentation coverage

Focus on:
- Consistent provider behavior regardless of underlying CLI
- Comprehensive documentation for users and developers
- Production-ready error handling and logging
- Performance optimization and resource management
- Complete test coverage including edge cases

Add final validation covering:
- Multi-provider competition execution
- Provider abstraction consistency
- Complete system documentation accuracy
- Performance benchmarks with all providers
- Error handling in production scenarios

Ensure the system is production-ready with comprehensive documentation, examples, and robust error handling across all providers.
```

---

## Summary

This implementation plan provides 15 carefully structured prompts that build a complete LLM coding competition system. Each prompt:

1. **Builds incrementally** on previous work
2. **Maintains strong testing** throughout
3. **Integrates components** without leaving orphaned code
4. **Follows TDD principles** with tests driving implementation
5. **Handles real-world concerns** like error handling, performance, and usability

The plan progresses logically from foundational data storage through business logic to user interface, ensuring each step is properly tested and integrated before moving to the next level of complexity.