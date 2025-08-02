# AI Coding Arena

A competition system for evaluating LLM coding capabilities through automated three-phase challenges.

## Overview

AI Coding Arena runs structured coding competitions where LLM providers compete through:

1. **Baseline Creation** - Create a working coding project with tests
2. **Bug Injection** - Introduce bugs that break the tests
3. **Fix Attempt** - Repair the bugs to restore functionality

Results are tracked with detailed statistics and exported as JSON.

## Quick Start

```bash
# Install dependencies
npm install

# Run competition with default providers (3 mock providers)
npm run cli

# Run competition with specified providers (minimum 3 required)
npm run cli mock-provider mock-provider claude-code

# Run competition with custom rounds
npm run cli mock-provider claude-code mock-provider --rounds=5

# Run tests
npm test

# Format and lint code
npm run fix:all
```

### Environment Setup

Create a `.env` file in the project root for Claude Code integration:

```bash
CLAUDE_CODE_USE_BEDROCK=1
AWS_PROFILE=your-aws-profile
AWS_REGION=eu-west-1
DEBUG=true
```

Environment variables are automatically loaded at startup.

## Supported Providers

- **mock-provider** - Simulated provider for testing and development
- **claude-code** - Real Claude Code CLI integration with AWS Bedrock

### Workspace Management

- **Automatic cleanup**: Temporary workspaces are created in `/tmp` and automatically cleaned up after each competition
- **Isolated execution**: Each competition runs in a fresh temporary directory outside the project
- **No manual cleanup needed**: Workspaces are removed even if the competition fails or is interrupted

## Example Output

```json
{
  "competitionId": "comp-1234567890",
  "participants": ["mock-provider", "claude-code"],
  "statistics": {
    "totalPhases": 6,
    "successfulPhases": 5,
    "successRate": 0.833
  },
  "phases": [
    {
      "phase": "baseline",
      "participant": "mock-provider",
      "success": true,
      "duration": 2
    }
  ]
}
```

## Architecture

- **TypeScript** with strict mode and comprehensive testing
- **DuckDB** for event storage and analytics
- **Vitest** for testing with 94 passing tests
- **Result types** for safe error handling
- **Event sourcing** for complete audit trails

## Development

The project follows TDD principles with comprehensive test coverage:

```bash
# Run specific test files
npm test -- src/competition/simple-runner.test.ts

# Run tests in watch mode
npm run test:watch

# Check types, lint, format, and test
npm run check:all

# Fix formatting, linting, and run tests
npm run fix:all

# Check types only
npm run typecheck
```

### CLI Usage Examples

```bash
# Default: 3 mock providers, 3 rounds
npm run cli

# Custom providers (minimum 3 required)
npm run cli mock-provider mock-provider claude-code

# Custom number of rounds
npm run cli mock-provider claude-code mock-provider --rounds=1

# All mock providers for testing
npm run cli mock-provider mock-provider mock-provider --rounds=2
```

Built with incremental development following the implementation plan in `.claude/plans/`.
