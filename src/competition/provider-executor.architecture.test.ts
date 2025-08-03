// ABOUTME: Architecture tests ensuring provider methods are only called via ProviderExecutor
// Enforces that no direct calls to LLMProvider interface methods occur outside ProviderExecutor

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { promisify } from 'util';

describe('Provider Architecture Rules', () => {
  it('should ensure no direct calls to LLMProvider interface methods', async () => {
    const globAsync = promisify(glob);
    const sourceFiles = await globAsync('src/**/*.ts', {
      ignore: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/provider-executor.ts', // The single centralized executor
        '**/llm-provider.ts', // Interface definition - contains method signatures
        '**/infrastructure/coding-agent-providers/**/*.ts', // Provider implementations - they implement the interface
      ],
    });

    const violations: string[] = [];
    const providerMethods = ['createCodingExercise', 'injectBug', 'fixAttempt'];

    for (const file of sourceFiles) {
      const content = await readFile(file, 'utf-8');

      for (const method of providerMethods) {
        if (content.includes(`${method}(`)) {
          violations.push(`${file}: Direct call to ${method}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
