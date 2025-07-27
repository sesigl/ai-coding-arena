// ABOUTME: System-level prompts for LLM coding competition phases
// Technology-agnostic prompts focused on competitive challenge and standardized contract

export interface SystemPromptConfig {
  readonly taskDescription: string;
  readonly competitiveChallenge: string;
  readonly contract: string;
  readonly requirements: string[];
  readonly validationProcess: string;
}

export class SystemPrompts {
  static readonly MAKEFILE_CONTRACT = `
**STANDARDIZED CONTRACT:**
Your project MUST include a Makefile with these exact targets:

- **make setup** - Install dependencies and prepare the project for execution
- **make test** - Run all tests and return exit code 0 for success, non-zero for failure

The system will use only these commands to validate your work - no manual intervention allowed.
`.trim();

  static readonly BASELINE_CREATION: SystemPromptConfig = {
    taskDescription: `
Create a software project that demonstrates your coding capabilities.

**YOUR MISSION:** Build a working application with comprehensive tests that showcases programming skill.

**TIME LIMIT:** You have exactly 5 minutes to complete this task. Work efficiently and focus on creating a functional project with tests that pass.
`.trim(),

    competitiveChallenge: `
**COMPETITIVE CHALLENGE:**
This is a competition against other LLMs. Your goal is to create a project that:
- Demonstrates superior code quality and architecture
- Includes comprehensive testing that other LLMs might miss
- Shows attention to edge cases and error handling
- Uses programming patterns that require deep understanding
- Creates a foundation that will be difficult for other LLMs to break or fix

Think strategically: what kind of code would challenge another LLM's ability to understand and modify it correctly?
`.trim(),

    contract: SystemPrompts.MAKEFILE_CONTRACT,

    requirements: [
      'Choose any programming language and application type you prefer',
      'Create a non-trivial application (avoid simple "hello world" programs)',
      'Include comprehensive unit tests with good coverage',
      'Add proper error handling and edge case management',
      'Use clean architecture and coding patterns',
      'Ensure the project builds and all tests pass',
      'Document your design decisions if they add competitive advantage',
    ],

    validationProcess: `
**VALIDATION:**
The system will run: \`make setup && make test\`
Success requires both commands to complete with exit code 0.

**TIMEOUT:** Task will be terminated if not completed within 5 minutes.
`.trim(),
  };

  static readonly BUG_INJECTION: SystemPromptConfig = {
    taskDescription: `
Inject a subtle bug into the existing project that will challenge other LLMs to find and fix.

**YOUR MISSION:** Introduce a realistic programming error that requires skill to identify and resolve.

**TIME LIMIT:** You have exactly 3 minutes to complete this task. Work efficiently and focus on introducing a meaningful bug.
`.trim(),

    competitiveChallenge: `
**COMPETITIVE CHALLENGE:**
You're competing against other LLMs who will try to fix your bug. Your goal is to:
- Create a bug that looks like a genuine programming mistake
- Make it subtle enough to require careful analysis
- Choose a bug type that tests deep understanding of the codebase
- Avoid obvious errors that any LLM could spot immediately
- Consider bugs that involve business logic, not just syntax

Strategic thinking: What kind of mistake would a skilled programmer make that requires expertise to identify?
`.trim(),

    contract: SystemPrompts.MAKEFILE_CONTRACT,

    requirements: [
      'Introduce exactly ONE realistic programming bug',
      'The bug must cause test failures (make test should fail)',
      'Bug should look like an authentic programming mistake',
      'Modify only source code - never change tests',
      'Consider subtle logic errors, boundary conditions, or algorithmic mistakes',
      'Make it challenging but not impossible to debug',
    ],

    validationProcess: `
**VALIDATION:**
The system will run: \`make test\`
Success requires the command to FAIL (exit code != 0) with clear test failure output.

**TIMEOUT:** Task will be terminated if not completed within 3 minutes.
`.trim(),
  };

  static readonly FIX_ATTEMPT: SystemPromptConfig = {
    taskDescription: `
Analyze the failing project and fix the bug to restore full functionality.

**YOUR MISSION:** Demonstrate superior debugging skills by identifying and fixing the introduced error.

**TIME LIMIT:** You have exactly 3 minutes to complete this task. Work efficiently to identify and fix the bug.
`.trim(),

    competitiveChallenge: `
**COMPETITIVE CHALLENGE:**
Another LLM has introduced a bug designed to challenge your debugging abilities. Your goal is to:
- Systematically analyze the test failures to understand the problem
- Use sophisticated debugging techniques to locate the root cause
- Apply the minimal fix that restores functionality without breaking anything else
- Demonstrate deeper understanding than simple trial-and-error approaches

This tests your ability to understand complex codebases and apply precise fixes under pressure.
`.trim(),

    contract: SystemPrompts.MAKEFILE_CONTRACT,

    requirements: [
      'First run tests to understand what is failing',
      'Analyze failure patterns and error messages systematically',
      'Locate the root cause through code analysis',
      'Apply the minimal fix necessary to restore functionality',
      'Verify all tests pass after your fix',
      'Modify only source code - never change tests',
    ],

    validationProcess: `
**VALIDATION:**
The system will run: \`make test\`
Success requires all tests to PASS (exit code 0) with no failures.

**TIMEOUT:** Task will be terminated if not completed within 3 minutes.
`.trim(),
  };

  static formatPrompt(config: SystemPromptConfig): string {
    return `
${config.taskDescription}

${config.competitiveChallenge}

${config.contract}

**REQUIREMENTS:**
${config.requirements.map(req => `- ${req}`).join('\n')}

${config.validationProcess}

**BEGIN:** Start immediately. Create/modify files as needed and ensure the contract is fulfilled.
`.trim();
  }
}
