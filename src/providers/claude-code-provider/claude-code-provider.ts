// ABOUTME: Real Claude Code provider implementation using TypeScript SDK
// Competition-focused prompts that encourage deep thinking and strategic bug creation/fixing

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { cp } from 'fs/promises';
import { setTimeout as nodeSetTimeout, clearTimeout } from 'timers';

export class ClaudeCodeProvider implements LLMProvider {
  readonly name = 'claude-code';

  async createCodingExercise(workspaceDir: string): Promise<{ success: boolean; message: string }> {
    const prompt = `Create a complete TypeScript project with the following requirements:

1. **Create these files:**
   - package.json with necessary dependencies (typescript, vitest, @types/node)
   - tsconfig.json with strict TypeScript configuration
   - src/calculator.ts with a Calculator class containing methods: add, subtract, multiply, divide
   - src/calculator.test.ts with comprehensive tests for all methods
   - vitest.config.ts for test configuration

2. **Project must be fully functional:**
   - All files must be created and properly configured
   - Tests must pass when running "npm test"
   - Include edge case tests (division by zero, negative numbers, etc.)

3. **Make it robust:**
   - Well-tested with comprehensive test coverage
   - Proper error handling
   - TypeScript strict mode enabled

This is for a coding competition where other AIs will try to inject bugs. Make your tests thorough to catch potential issues.

Create all necessary files now.`;

    return this.executeQuery(workspaceDir, prompt, 'baseline creation');
  }

  async injectBug(
    baselineDir: string,
    workspaceDir: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await cp(baselineDir, workspaceDir, { recursive: true, force: true });
    } catch (error) {
      return {
        success: false,
        message: `Failed to copy baseline: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const prompt = `You need to inject a subtle bug into this calculator project that will cause tests to fail.

**Your task:**
1. Examine the existing code and tests
2. Introduce ONE realistic bug that breaks at least one test
3. Run the tests to verify they fail after your change
4. The bug should be subtle but realistic (like an off-by-one error, wrong operator, boundary condition issue)

**Examples of good bugs:**
- Change multiplication to use addition in a loop
- Introduce precision errors in division
- Handle edge cases incorrectly (like division by zero)
- Swap greater-than/less-than comparisons

**Requirements:**
- Tests must fail after the bug injection
- The bug should look like a real programming mistake
- Don't make it too obvious - it should require some analysis to find

Inject the bug now and run tests to confirm they fail.`;

    return this.executeQuery(workspaceDir, prompt, 'bug injection');
  }

  async fixAttempt(
    buggyDir: string,
    workspaceDir: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await cp(buggyDir, workspaceDir, { recursive: true, force: true });
    } catch (error) {
      return {
        success: false,
        message: `Failed to copy buggy code: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const prompt = `You need to find and fix the bug in this calculator project to make all tests pass.

**Your task:**
1. Run the tests first to see what's failing
2. Examine the test failures to understand what's wrong
3. Look at the calculator code to find the bug
4. Fix the bug in the source code
5. Run the tests again to confirm they all pass

**Debugging approach:**
- Check the test output carefully - what's the expected vs actual result?
- Look at the calculator methods - which one is causing the failure?
- Compare the failing method with the test expectations
- Make the minimal fix needed to restore correct behavior

**Requirements:**
- All tests must pass after your fix
- Don't change the tests, only fix the source code
- Make sure your fix handles all the edge cases the tests cover

Fix the bug now and verify all tests pass.`;

    return this.executeQuery(workspaceDir, prompt, 'fix attempt');
  }

  private async executeQuery(
    workspaceDir: string,
    prompt: string,
    phase: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const messages: SDKMessage[] = [];
      const abortController = new AbortController();

      const timeout = nodeSetTimeout(() => {
        abortController.abort();
      }, 180000); // 3 minutes for complex thinking

      try {
        for await (const message of query({
          prompt,
          abortController,
          options: {
            maxTurns: 15, // Allow more turns for deep analysis
            cwd: workspaceDir,
          },
        })) {
          messages.push(message);
        }

        clearTimeout(timeout);

        const success = this.determineSuccess(messages, phase);

        return {
          success,
          message: success
            ? `Claude Code ${phase} completed successfully`
            : `Claude Code ${phase} completed but may have issues. Messages: ${messages
                .slice(-2)
                .map(m => JSON.stringify(m))
                .join(', ')}`,
        };
      } catch (error) {
        clearTimeout(timeout);

        if (abortController.signal.aborted) {
          return {
            success: false,
            message: `Claude Code ${phase} timed out after 3 minutes`,
          };
        }

        throw error;
      }
    } catch (error) {
      return {
        success: false,
        message: `Claude Code ${phase} failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private determineSuccess(messages: SDKMessage[], phase: string): boolean {
    // More conservative success detection - require substantial evidence
    const allMessages = messages
      .map(msg => JSON.stringify(msg))
      .join(' ')
      .toLowerCase();

    switch (phase) {
      case 'baseline creation':
        // Look for strong indicators of file creation
        return (
          allMessages.includes('package.json') &&
          allMessages.includes('created') &&
          (allMessages.includes('test') || allMessages.includes('vitest'))
        );

      case 'bug injection':
        // Look for explicit test failure mentions
        return (
          allMessages.includes('test') &&
          (allMessages.includes('fail') ||
            allMessages.includes('failing') ||
            allMessages.includes('broken'))
        );

      case 'fix attempt':
        // Look for test restoration
        return (
          allMessages.includes('test') &&
          (allMessages.includes('pass') ||
            allMessages.includes('passing') ||
            allMessages.includes('fixed'))
        );

      default:
        return messages.length > 0;
    }
  }
}
