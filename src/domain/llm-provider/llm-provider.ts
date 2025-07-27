// ABOUTME: LLMProvider interface defining the contract for all LLM providers
// System provides prompts, providers execute tasks using their specific implementation

export interface LLMProvider {
  readonly name: string;

  createCodingExercise(
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }>;

  injectBug(
    baselineDir: string,
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }>;

  fixAttempt(
    buggyDir: string,
    workspaceDir: string,
    prompt: string
  ): Promise<{ success: boolean; message: string }>;
}
