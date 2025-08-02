// ABOUTME: Real integration tests with Gemini CLI - disabled by default
// Run with: npm run test:integration (requires real Gemini CLI access)

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiCliProvider } from './gemini-cli-provider';
import { createWorkspace, cleanupWorkspace } from 'infrastructure/workspace/workspace';
import { ValidationService } from 'competition/services/validation-service';
import { DebugLogger } from 'utils/debug-logger';
import { SystemPrompts } from 'domain/competition-prompts/system-prompts';

const INTEGRATION_TESTS_ENABLED = process.env.ENABLE_GEMINI_INTEGRATION_TESTS === 'true';

describe.skipIf(!INTEGRATION_TESTS_ENABLED)('GeminiCliProvider Real Integration', () => {
  let provider: GeminiCliProvider;
  let validationService: ValidationService;

  beforeEach(() => {
    provider = new GeminiCliProvider();
    validationService = new ValidationService();
  });

  describe('complete competition workflow', () => {
    it('should run full baseline → bug injection → fix cycle successfully', async () => {
      DebugLogger.logPhaseStart('INTEGRATION_TEST', 'Running complete competition workflow');

      const baselineDir = await createWorkspace('integration-baseline-gemini');
      const buggyDir = await createWorkspace('integration-buggy-gemini');
      const fixDir = await createWorkspace('integration-fix-gemini');

      try {
        // PHASE 1: Create baseline project
        DebugLogger.logPhaseStart('BASELINE_CREATION', 'Creating baseline calculator project');
        const baselinePrompt = SystemPrompts.formatPrompt(SystemPrompts.BASELINE_CREATION);
        await provider.createCodingExercise(baselineDir, baselinePrompt);

        // Validate baseline using ValidationService
        const baselineValidation = await validationService.validatePhase('baseline', baselineDir);
        expect(baselineValidation.isOk()).toBe(true);
        if (baselineValidation.isOk()) {
          expect(baselineValidation.value.success).toBe(true);
        }

        // PHASE 2: Inject bug
        DebugLogger.logPhaseStart('BUG_INJECTION', 'Injecting bug into calculator');
        const bugInjectionPrompt = SystemPrompts.formatPrompt(SystemPrompts.BUG_INJECTION);
        await provider.injectBug(baselineDir, buggyDir, bugInjectionPrompt);

        // Validate bug injection using ValidationService
        const bugValidation = await validationService.validatePhase('bug-injection', buggyDir);
        expect(bugValidation.isOk()).toBe(true);
        if (bugValidation.isOk()) {
          expect(bugValidation.value.success).toBe(true);
        }

        // PHASE 3: Fix the bug
        DebugLogger.logPhaseStart('FIX_ATTEMPT', 'Attempting to fix the bug');
        const fixPrompt = SystemPrompts.formatPrompt(SystemPrompts.FIX_ATTEMPT);
        await provider.fixAttempt(buggyDir, fixDir, fixPrompt);

        // Validate fix using ValidationService
        const fixValidation = await validationService.validatePhase('fix-attempt', fixDir);
        expect(fixValidation.isOk()).toBe(true);
        if (fixValidation.isOk()) {
          expect(fixValidation.value.success).toBe(true);
        }

        DebugLogger.logPhaseEnd(
          'INTEGRATION_TEST',
          true,
          'Complete competition workflow successful'
        );
      } finally {
        await cleanupWorkspace(baselineDir);
        await cleanupWorkspace(buggyDir);
        await cleanupWorkspace(fixDir);
      }
    }, 600000); // 10 minute timeout for complete workflow
  });

  describe('error handling', () => {
    it('should handle copy failures gracefully', async () => {
      const bugResult = await provider.injectBug(
        '/nonexistent/baseline',
        '/tmp/test-bug-fail-gemini',
        'Test prompt'
      );
      expect(bugResult.success).toBe(false);
      expect(bugResult.message).toContain('Failed to copy baseline');

      const fixResult = await provider.fixAttempt(
        '/nonexistent/buggy',
        '/tmp/test-fix-fail-gemini',
        'Test prompt'
      );
      expect(fixResult.success).toBe(false);
      expect(fixResult.message).toContain('Failed to copy buggy code');
    });
  });
});
