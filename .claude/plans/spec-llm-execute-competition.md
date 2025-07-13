# LLM Coding Competition System Specification

## Overview

A core competition system that orchestrates coding competitions between Large Language Models (LLMs) using an event-sourced architecture with DuckDB for persistence. The system supports manual execution of competitions where LLMs create coding tasks, inject bugs, and attempt fixes in a structured round-robin format.

## Architecture

### Event-Sourced Design

- All interactions stored as events in DuckDB
- No duplicate data storage - only raw event data
- Statistics computed on-demand from events
- Flexible for future projections and analysis

### Directory Structure

```
competitions/
└── competition-{timestamp}/
    ├── config.json
    ├── round-1/
    │   ├── {participant-1}/     # baseline creator workspace
    │   ├── {participant-2}/     # bug injector & fixer workspace
    │   └── artifacts/           # final code states, diffs, logs
    ├── round-2/
    │   ├── {participant-2}/     # now baseline creator
    │   ├── {participant-1}/     # now bug injector & fixer
    │   └── artifacts/
    └── results.json
```

## LLM Provider Abstraction

### Interface Definition

```typescript
interface LLMProvider {
  readonly id: string;
  readonly name: string;

  createBaseline(
    prompt: string,
    workspaceDir: string,
    timeoutSeconds: number
  ): Promise<BaselineResult>;
  injectBug(baselineDir: string, workspaceDir: string, timeoutSeconds: number): Promise<BugResult>;
  fixCode(buggyCodeDir: string, workspaceDir: string, timeoutSeconds: number): Promise<FixResult>;
}
```

### Implementation Strategy

- Each LLM (Claude Code, Gemini CLI) implements the interface
- Real CLI commands executed within isolated directories
- All CLI input/output captured as events
- Providers fail fast on any error

## Competition Configuration

### Manual Execution

- Triggered via CLI command (no scheduling initially)
- Configuration specified via JSON or CLI parameters

### Configuration Schema

```json
{
  "participants": ["claude-code", "gemini-cli"],
  "rounds": 2,
  "timeouts": {
    "baseline_creation_seconds": 300,
    "bug_injection_seconds": 180,
    "fix_attempt_seconds": 240
  }
}
```

### Validation

- All specified participants must have valid implementations
- System fails fast if any provider is unavailable

## Game Mechanics

### Round Structure

1. **Baseline Creation**: One LLM creates a coding task with 100% test coverage
2. **Bug Injection**: Another LLM introduces exactly one defect causing test failures
3. **Fix Attempt**: Remaining LLM(s) attempt to restore tests to green
4. **Rotation**: Participants rotate roles for subsequent rounds

### Task Requirements

- **Fully flexible coding tasks**: Algorithms, data structures, any programming challenge
- **Strategic selection**: Baseline creator chooses tasks they're confident with
- **100% test coverage**: Required for baseline acceptance
- **Test immutability**: Tests must never be modified during bug injection or fixing

### Scoring System

- **Successful fix**: +1 point to fixer
- **Unfixed bug**: +1 point to bug creator
- **Invalid baseline**: -1 point to baseline creator
- **Timeout/failure**: Competition fails fast

## Data Storage

### Event Schema (DuckDB)

```sql
CREATE TABLE events (
  id BIGINT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  competition_id TEXT NOT NULL,
  round_id INTEGER,
  participant_id TEXT,
  event_type TEXT NOT NULL,
  phase TEXT, -- 'baseline' | 'bug_injection' | 'fix_attempt'
  data JSON NOT NULL, -- All event details
  success BOOLEAN,
  duration_seconds INTEGER
);

-- Indexes for efficient querying
CREATE INDEX idx_events_competition ON events(competition_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_participant ON events(participant_id);
```

### Event Types

- `competition_started`
- `round_started`
- `baseline_creation_started`
- `cli_command_executed`
- `file_created`
- `file_modified`
- `file_deleted`
- `tests_executed`
- `baseline_completed`
- `bug_injection_started`
- `bug_injection_completed`
- `fix_attempt_started`
- `fix_attempt_completed`
- `round_completed`
- `competition_completed`

### Storage Configuration

- **Local development**: DuckDB file in project directory
- **Production ready**: S3 storage support (not implemented initially)

## Competition Results

### On-Demand Statistics

Results computed by processing events, not stored separately.

### Output Format (JSON)

```json
{
  "competition_summary": {
    "competition_id": "competition-20250113-143052",
    "participants": ["claude-code", "gemini-cli"],
    "total_rounds": 2,
    "start_time": "2025-01-13T14:30:52Z",
    "end_time": "2025-01-13T15:15:32Z",
    "duration_minutes": 45,
    "status": "completed"
  },
  "leaderboard": [
    {
      "participant": "claude-code",
      "score": 3,
      "rank": 1
    },
    {
      "participant": "gemini-cli",
      "score": 1,
      "rank": 2
    }
  ],
  "individual_stats": {
    "claude-code": {
      "baselines_created": 1,
      "baselines_success_rate": 1.0,
      "bugs_injected": 1,
      "fixes_attempted": 1,
      "fixes_successful": 1,
      "fix_success_rate": 1.0,
      "avg_fix_time_seconds": 120,
      "avg_baseline_time_seconds": 280
    },
    "gemini-cli": {
      "baselines_created": 1,
      "baselines_success_rate": 1.0,
      "bugs_injected": 1,
      "fixes_attempted": 1,
      "fixes_successful": 0,
      "fix_success_rate": 0.0,
      "avg_fix_time_seconds": null,
      "avg_baseline_time_seconds": 195
    }
  },
  "round_details": [
    {
      "round": 1,
      "baseline_creator": "claude-code",
      "bug_injector": "gemini-cli",
      "fixer": "gemini-cli",
      "outcome": "bug_creator_wins",
      "winner": "gemini-cli"
    },
    {
      "round": 2,
      "baseline_creator": "gemini-cli",
      "bug_injector": "claude-code",
      "fixer": "claude-code",
      "outcome": "fixer_wins",
      "winner": "claude-code"
    }
  ]
}
```

## Error Handling

### Fail-Fast Strategy

- Any LLM failure causes immediate competition termination
- No retry mechanisms initially
- Clear error reporting with event trail
- Edge cases handled by failing fast to keep system simple

### Failure Scenarios

- Provider implementation not found
- Timeout exceeded during any phase
- Invalid baseline (tests fail or coverage < 100%)
- CLI command execution failure
- File system operations failure

## Implementation Priorities

### Phase 1: Core System

1. Event storage with DuckDB
2. LLM provider interface and abstractions
3. Directory management and isolation
4. Basic competition runner (manual execution)
5. Claude Code and Gemini CLI implementations

### Phase 2: Competition Logic

1. Round-robin orchestration
2. Test execution and validation
3. File diff capture and storage
4. Timeout handling

### Phase 3: Results and Analysis

1. Event processing for statistics
2. JSON results generation
3. Competition history tracking

### Future Enhancements (Not In Scope)

- Scheduled competitions
- Web interface/dashboard
- Advanced statistics and visualizations
- Multi-language support beyond initial implementations
- S3 storage integration
- Retry mechanisms and error recovery

## Technical Requirements

### Dependencies

- Node.js 20+ (LTS)
- TypeScript 5.x (strict mode)
- DuckDB (via npm package)
- Real CLI tools: `claude` command for Claude Code, equivalent for Gemini

### Development Environment

- Local DuckDB file for development
- Isolated directory structure in `/tmp` or configurable location
- Manual testing via CLI commands

### Quality Assurance

- TDD approach for all core functionality
- Unit tests for event processing
- Integration tests for LLM provider implementations
- End-to-end tests for complete competition flows
