// ABOUTME: Real Claude Code provider implementation using TypeScript SDK
// Competition-focused prompts that encourage deep thinking and strategic bug creation/fixing

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import {
  query,
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-code';
import { cp } from 'fs/promises';
import { setTimeout as nodeSetTimeout, clearTimeout } from 'timers';
import { DebugLogger } from 'utils/debug-logger';

// Type guards for discriminated unions
function isUserOrAssistantMessage(msg: SDKMessage): msg is SDKUserMessage | SDKAssistantMessage {
  return msg.type === 'user' || msg.type === 'assistant';
}

// Type assertion helper for runtime-validated streaming messages
function asStreamingToolMessage(msg: SDKMessage): {
  subtype: string;
  name?: string;
  is_error?: boolean;
  duration_ms?: number;
  output?: unknown;
} | null {
  if (
    msg.type === 'result' &&
    typeof msg === 'object' &&
    msg !== null &&
    'subtype' in msg &&
    typeof (msg as Record<string, unknown>).subtype === 'string'
  ) {
    return msg as {
      subtype: string;
      name?: string;
      is_error?: boolean;
      duration_ms?: number;
      output?: unknown;
    };
  }
  return null;
}

export class ClaudeCodeProvider implements LLMProvider {
  readonly name = 'claude-code';

  async createCodingExercise(
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }> {
    DebugLogger.logPhaseStart('BASELINE_CREATION', `Creating baseline project in ${workspaceDir}`);

    const result = await this.executeQuery(workspaceDir, prompt, 'baseline creation');
    DebugLogger.logPhaseEnd('BASELINE_CREATION', result.success, result.message);
    return result;
  }

  async injectBug(
    baselineDir: string,
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }> {
    DebugLogger.logPhaseStart(
      'BUG_INJECTION',
      `Copying baseline from ${baselineDir} to ${workspaceDir}`
    );

    try {
      await cp(baselineDir, workspaceDir, { recursive: true, force: true });
      DebugLogger.logProgress('BUG_INJECTION', 'Baseline files copied successfully');
    } catch (error) {
      const errorMsg = `Failed to copy baseline: ${error instanceof Error ? error.message : String(error)}`;
      DebugLogger.logPhaseEnd('BUG_INJECTION', false, errorMsg);
      return {
        success: false,
        message: errorMsg,
      };
    }

    DebugLogger.logProgress('BUG_INJECTION', 'Starting bug injection with Claude Code');
    const result = await this.executeQuery(workspaceDir, prompt, 'bug injection');
    DebugLogger.logPhaseEnd('BUG_INJECTION', result.success, result.message);
    return result;
  }

  async fixAttempt(
    buggyDir: string,
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }> {
    DebugLogger.logPhaseStart(
      'FIX_ATTEMPT',
      `Copying buggy code from ${buggyDir} to ${workspaceDir}`
    );

    try {
      await cp(buggyDir, workspaceDir, { recursive: true, force: true });
      DebugLogger.logProgress('FIX_ATTEMPT', 'Buggy files copied successfully');
    } catch (error) {
      const errorMsg = `Failed to copy buggy code: ${error instanceof Error ? error.message : String(error)}`;
      DebugLogger.logPhaseEnd('FIX_ATTEMPT', false, errorMsg);
      return {
        success: false,
        message: errorMsg,
      };
    }

    DebugLogger.logProgress('FIX_ATTEMPT', 'Starting bug fix with Claude Code');
    const result = await this.executeQuery(workspaceDir, prompt, 'fix attempt');
    DebugLogger.logPhaseEnd('FIX_ATTEMPT', result.success, result.message);
    return result;
  }

  private async executeQuery(
    workspaceDir: string,
    prompt: string,
    phase: string
  ): Promise<{ success: boolean; message: string }> {
    const phaseUpper = phase.toUpperCase().replace(' ', '_');

    try {
      const messages: SDKMessage[] = [];
      const abortController = new AbortController();

      const timeout = nodeSetTimeout(() => {
        abortController.abort();
      }, 180000);

      DebugLogger.logProgress(phaseUpper, 'Starting Claude Code conversation', {
        workspaceDir,
        maxTurns: 15,
        timeoutMs: 180000,
      });

      try {
        let messageCount = 0;
        for await (const message of query({
          prompt,
          abortController,
          options: {
            maxTurns: 15, // Allow more turns for deep analysis
            cwd: workspaceDir,
            allowedTools: ['Read', 'Write', 'Bash', 'Edit', 'Glob', 'LS'],
            disallowedTools: [],
          },
        })) {
          messages.push(message);
          messageCount++;

          if (isUserOrAssistantMessage(message)) {
            let hasContent = false;
            let toolCalls: Array<{ name: string; input: unknown }> = [];

            if (message.message && typeof message.message === 'object') {
              if ('content' in message.message && Array.isArray(message.message.content)) {
                const textParts = message.message.content.filter(
                  (c: { type: string; text?: string }) => c.type === 'text'
                );
                const toolUseParts = message.message.content.filter(
                  (c: { type: string; name?: string; input?: unknown }) => c.type === 'tool_use'
                );

                if (textParts.length > 0) {
                  const textContent = textParts
                    .map((c: { text: string }) => c.text)
                    .join(' ')
                    .trim();
                  if (textContent) {
                    hasContent = true;
                    DebugLogger.logContent(
                      phaseUpper,
                      `${message.type}: ${textContent}`,
                      'CLAUDE_CODE'
                    );
                  }
                }

                if (toolUseParts.length > 0) {
                  toolCalls = toolUseParts;
                  toolCalls.forEach(tool => {
                    DebugLogger.logContent(
                      phaseUpper,
                      `🔧 ${tool.name}: ${JSON.stringify(tool.input)}`,
                      'CLAUDE_CODE'
                    );
                  });
                  hasContent = true;
                }
              } else if (
                'content' in message.message &&
                typeof message.message.content === 'string' &&
                message.message.content.trim()
              ) {
                hasContent = true;
                const content = message.message.content.trim();
                DebugLogger.logContent(phaseUpper, `${message.type}: ${content}`, 'CLAUDE_CODE');
              }
            }

            if (!hasContent) {
              DebugLogger.logDot();
            }
          } else {
            const streamingMsg = asStreamingToolMessage(message);
            if (streamingMsg && streamingMsg.subtype === 'tool_use') {
              const toolName = streamingMsg.name || 'unknown';
              DebugLogger.logContent(phaseUpper, `🔧 ${toolName}`, 'CLAUDE_CODE');
            } else if (streamingMsg && streamingMsg.subtype === 'tool_result') {
              const isError = streamingMsg.is_error || false;
              const duration = streamingMsg.duration_ms;
              const status = isError ? '❌' : '✅';
              const timing = duration ? ` (${duration}ms)` : '';

              if (isError) {
                const errorOutput = streamingMsg.output || 'No error details';
                DebugLogger.logContent(
                  phaseUpper,
                  `${status} Error${timing}: ${String(errorOutput)}`,
                  'CLAUDE_CODE'
                );
              } else {
                const output = streamingMsg.output;
                if (output && String(output).trim()) {
                  DebugLogger.logContent(
                    phaseUpper,
                    `${status} Success${timing}: ${String(output)}`,
                    'CLAUDE_CODE'
                  );
                } else {
                  DebugLogger.logContent(phaseUpper, `${status} Success${timing}`, 'CLAUDE_CODE');
                }
              }
            } else {
              DebugLogger.logDot();
            }
          }
        }

        clearTimeout(timeout);

        DebugLogger.logProgress(phaseUpper, `Conversation completed with ${messageCount} messages`);

        const success = this.determineSuccess(messages, phase);

        DebugLogger.logProgress(phaseUpper, `Success determination: ${success}`, {
          totalMessages: messageCount,
          phase,
        });

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
          DebugLogger.logProgress(phaseUpper, 'Conversation timed out after 3 minutes');
          return {
            success: false,
            message: `Claude Code ${phase} timed out after 3 minutes`,
          };
        }

        DebugLogger.logProgress(phaseUpper, 'Conversation error', {
          error: error instanceof Error ? error.message : String(error),
        });
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
    const allMessages = messages
      .map(msg => JSON.stringify(msg))
      .join(' ')
      .toLowerCase();

    switch (phase) {
      case 'baseline creation':
        return (
          allMessages.includes('makefile') &&
          allMessages.includes('setup') &&
          allMessages.includes('test') &&
          (allMessages.includes('created') || allMessages.includes('written'))
        );

      case 'bug injection':
        return (
          allMessages.includes('test') &&
          (allMessages.includes('fail') ||
            allMessages.includes('failing') ||
            allMessages.includes('broken') ||
            allMessages.includes('bug'))
        );

      case 'fix attempt':
        return (
          allMessages.includes('test') &&
          (allMessages.includes('pass') ||
            allMessages.includes('passing') ||
            allMessages.includes('fixed') ||
            allMessages.includes('fix'))
        );

      default:
        return messages.length > 0;
    }
  }
}
