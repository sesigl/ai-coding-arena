// ABOUTME: Real Claude Code provider implementation using TypeScript SDK
// Competition-focused prompts that encourage deep thinking and strategic bug creation/fixing

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { cp } from 'fs/promises';
import { setTimeout as nodeSetTimeout, clearTimeout } from 'timers';

export class ClaudeCodeProvider implements LLMProvider {
  readonly name = 'claude-code';

  async createCodingExercise(workspaceDir: string): Promise<{ success: boolean; message: string }> {
    const prompt = `You are participating in an LLM coding competition. Your goal is to create a robust, well-tested codebase that other AI models will try to break by injecting bugs.

Create a TypeScript project that will serve as the foundation for this competition. The project should be:

1. **Non-trivial but focused** - Complex enough to hide subtle bugs, simple enough to understand quickly
2. **Thoroughly tested** - Every function should have comprehensive tests that would catch various types of bugs
3. **CLI runnable** - Must have a test suite that can be run from command line to verify functionality

Think strategically: What kind of code would be challenging for another AI to break in subtle ways? What edge cases should your tests cover to make bug injection difficult?

Requirements:
- Complete TypeScript project with package.json, tsconfig.json, test configuration
- Runnable test suite (npm test should work)
- Well-structured code that's neither too simple nor too complex
- Comprehensive tests that would catch both obvious and subtle bugs

Make your code defensible. Other models will try to break it - make that challenging for them.`;

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

    const prompt = `You are in a coding competition. Another AI created this codebase with tests, and your job is to inject a bug that's challenging to find and fix.

Your goal: **Create a subtle, realistic bug that breaks tests but isn't immediately obvious.**

Strategy considerations:
- **Avoid trivial bugs** (like changing + to -) that are too easy to spot
- **Think like a real developer** - What mistakes do humans actually make?
- **Consider edge cases** - Off-by-one errors, boundary conditions, async issues, type coercion
- **Make it realistic** - The bug should look like something that could slip through code review

Rules:
1. The bug must cause at least one test to fail
2. The bug should not be immediately obvious from the test failure message
3. Run tests after your change to confirm they fail
4. The bug should represent a real coding mistake, not a random change

Remember: Another AI (possibly yourself) will try to fix this. Make it intellectually challenging but fair.`;

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

    const prompt = `You are in a coding competition. Another AI injected a bug into this codebase, and your job is to find and fix it.

Your challenge: **Analyze failing tests, identify the root cause, and implement the correct fix.**

Approach this systematically:
1. **Run the tests** - Understand what's failing and why
2. **Analyze the failures** - Don't just fix symptoms, find the root cause
3. **Think deeply** - The bug was designed to be subtle, so surface-level fixes might miss the real issue
4. **Verify your fix** - Ensure all tests pass and you haven't introduced new issues

The bug was created by an AI trying to be clever and subtle. Use your analytical skills to:
- Trace through the failing test cases
- Understand the intended vs actual behavior  
- Identify where the logic breaks down
- Implement a robust fix

Remember: This is a competition. The AI that created the bug tried to make it challenging. Rise to that challenge with thoughtful debugging and precise fixes.

Run tests both before and after your fix to prove success.`;

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
            : `Claude Code ${phase} completed but may have issues`,
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
    const lastMessages = messages.slice(-5); // Check more messages for complex operations
    const messageText = lastMessages
      .map(msg => JSON.stringify(msg))
      .join(' ')
      .toLowerCase();

    switch (phase) {
      case 'baseline creation':
        return (
          messageText.includes('test') &&
          (messageText.includes('pass') ||
            messageText.includes('success') ||
            messageText.includes('complete'))
        );

      case 'bug injection':
        return (
          messageText.includes('test') &&
          (messageText.includes('fail') ||
            messageText.includes('error') ||
            messageText.includes('failing'))
        );

      case 'fix attempt':
        return (
          messageText.includes('test') &&
          (messageText.includes('pass') ||
            messageText.includes('success') ||
            messageText.includes('fixed'))
        );

      default:
        return messages.length > 0;
    }
  }
}
