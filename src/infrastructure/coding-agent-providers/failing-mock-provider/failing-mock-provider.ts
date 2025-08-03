// ABOUTME: Failing mock provider for testing error scenarios
// Always returns failure for all operations to test error handling paths

import { LLMProvider } from 'domain/llm-provider/llm-provider';

export class FailingMockProvider implements LLMProvider {
  readonly name = 'failing-mock-provider';

  async createCodingExercise(): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'Baseline creation failed for testing',
    };
  }

  async injectBug(): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'Bug injection failed for testing',
    };
  }

  async fixAttempt(): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'Fix attempt failed for testing',
    };
  }
}
