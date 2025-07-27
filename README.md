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

# Run single-participant competition
npm run cli ./workspace mock-provider

# Run multi-participant competition
npm run cli ./workspace mock-provider claude-code

# Run tests
npm test

# Format and lint code
npm run fix:all
```

## Supported Providers

- **mock-provider** - Simulated provider for testing
- **claude-code** - Real Claude Code CLI integration

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

# Check types
npm run typecheck
```

Built with incremental development following the implementation plan in `.claude/plans/`.
