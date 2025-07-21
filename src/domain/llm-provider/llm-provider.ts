// ABOUTME: LLMProvider interface defining the contract for all LLM providers
// Minimal interface for baseline creation workflow

export interface LLMProvider {
  readonly name: string;
  createCodingExercise(workspaceDir: string): Promise<{ success: boolean; message: string }>;
  injectBug(
    baselineDir: string,
    workspaceDir: string
  ): Promise<{ success: boolean; message: string }>;
  fixAttempt(
    buggyDir: string,
    workspaceDir: string
  ): Promise<{ success: boolean; message: string }>;
}
