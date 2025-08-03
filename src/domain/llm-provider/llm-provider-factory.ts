// ABOUTME: Factory for creating and managing available LLM providers
// Returns list of all LLM providers that can be used for coding competitions

import { LLMProvider } from 'domain/llm-provider/llm-provider';

export interface LLMProviderFactory {
  getAvailableProviders(): readonly LLMProvider[];
  getProviderByName(name: string): LLMProvider | undefined;
}
