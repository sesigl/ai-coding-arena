// ABOUTME: LLMProvider interface defining the contract for all LLM providers
// Minimal interface for baseline creation workflow

export interface LLMProvider {
  readonly name: string;
  createBaseline(workspaceDir: string): Promise<{ success: boolean; message: string }>;
}
