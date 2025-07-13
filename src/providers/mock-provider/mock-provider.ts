// ABOUTME: Mock LLM provider implementation using template directory approach
// Copies baseline template with executable project structure and automation

import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { cp } from 'fs/promises';
import { join, dirname } from 'path';

export class MockProvider implements LLMProvider {
  readonly name = 'mock-provider';

  async createBaseline(workspaceDir: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the template directory path
      const currentDir = dirname(__filename);
      const templateDir = join(currentDir, 'baseline');

      // Copy the entire template directory to workspace
      await cp(templateDir, workspaceDir, {
        recursive: true,
        force: true,
      });

      return {
        success: true,
        message: 'Mock baseline created successfully with complete executable project structure',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create baseline: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
