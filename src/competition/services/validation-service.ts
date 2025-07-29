// ABOUTME: Validation coordination service for competition phase validation
// Encapsulates all validation logic with proper error handling and reporting

import { MakefileValidator } from 'infrastructure/contract-validator/makefile-validator';
import { Result, ok, err } from 'neverthrow';

export interface ValidationResult {
  readonly success: boolean;
  readonly message: string;
}

export class ValidationService {
  constructor(private readonly makefileValidator: MakefileValidator = new MakefileValidator()) {}

  async validateBaselineSetup(workspaceDir: string): Promise<Result<ValidationResult, Error>> {
    try {
      const result = await this.makefileValidator.validateSetupAndTest(workspaceDir);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async validateBugInjection(workspaceDir: string): Promise<Result<ValidationResult, Error>> {
    try {
      const result = await this.makefileValidator.expectTestFailure(workspaceDir);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async validateFixAttempt(workspaceDir: string): Promise<Result<ValidationResult, Error>> {
    try {
      const result = await this.makefileValidator.validateTestOnly(workspaceDir);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async validatePhase(
    phase: 'baseline' | 'bug-injection' | 'fix-attempt',
    workspaceDir: string
  ): Promise<Result<ValidationResult, Error>> {
    switch (phase) {
      case 'baseline':
        return this.validateBaselineSetup(workspaceDir);
      case 'bug-injection':
        return this.validateBugInjection(workspaceDir);
      case 'fix-attempt':
        return this.validateFixAttempt(workspaceDir);
      default:
        return err(new Error(`Unknown validation phase: ${phase}`));
    }
  }
}
