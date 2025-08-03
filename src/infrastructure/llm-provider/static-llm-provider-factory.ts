// ABOUTME: Static LLM provider factory that returns predefined set of coding competition providers
// Instantiates all available providers at construction time for immediate availability

import { LLMProviderFactory } from 'domain/llm-provider/llm-provider-factory';
import { LLMProvider } from 'domain/llm-provider/llm-provider';
import { MockProvider } from 'infrastructure/coding-agent-providers/mock-provider/mock-provider';
import { ClaudeCodeProvider } from 'infrastructure/coding-agent-providers/claude-code-provider/claude-code-provider';
import { GeminiCliProvider } from 'infrastructure/coding-agent-providers/gemini-cli-provider/gemini-cli-provider';

export class StaticLLMProviderFactory implements LLMProviderFactory {
  private readonly providers: readonly LLMProvider[];

  constructor() {
    this.providers = [new MockProvider(), new ClaudeCodeProvider(), new GeminiCliProvider()];
  }

  getAvailableProviders(): readonly LLMProvider[] {
    return this.providers;
  }

  getProviderByName(name: string): LLMProvider | undefined {
    return this.providers.find(provider => provider.name === name);
  }
}
