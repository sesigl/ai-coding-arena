// ABOUTME: Test file for MockProvider implementation following TDD approach
// Tests the basic LLM provider interface and baseline creation workflow

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MockProvider } from './mock-provider';
import { cleanupWorkspace, createWorkspace } from 'infrastructure/workspace/workspace';

describe('MockProvider', () => {
  let mockProvider: MockProvider;
  let workspaceDir: string;

  beforeEach(async () => {
    mockProvider = new MockProvider();
    workspaceDir = await createWorkspace('mock-test');
  });

  afterEach(async () => {
    await cleanupWorkspace(workspaceDir);
  });

  describe('interface compliance', () => {
    it('should have a name property', () => {
      expect(mockProvider.name).toBe('mock-provider');
    });

    it('should have createBaseline method', () => {
      expect(typeof mockProvider.createBaseline).toBe('function');
    });
  });

  describe('createBaseline', () => {
    it('should return success true with message', async () => {
      const result = await mockProvider.createBaseline(workspaceDir);

      expect(result.success).toBe(true);
      expect(result.message).toContain('baseline created');
    });

    it('should create calculator program file', async () => {
      await mockProvider.createBaseline(workspaceDir);

      const programFile = join(workspaceDir, 'src', 'calculator.ts');
      expect(existsSync(programFile)).toBe(true);

      const content = await readFile(programFile, 'utf-8');
      expect(content).toContain('Calculator');
    });

    it('should create test file', async () => {
      await mockProvider.createBaseline(workspaceDir);

      const testFile = join(workspaceDir, 'calculator.test.ts');
      expect(existsSync(testFile)).toBe(true);

      const content = await readFile(testFile, 'utf-8');
      expect(content).toContain('Calculator');
    });

    it('should create complete executable project structure', async () => {
      await mockProvider.createBaseline(workspaceDir);

      expect(existsSync(join(workspaceDir, 'package.json'))).toBe(true);
      expect(existsSync(join(workspaceDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(workspaceDir, 'vitest.config.ts'))).toBe(true);
    });
  });

  describe('injectBug', () => {
    let baselineDir: string;

    beforeEach(async () => {
      baselineDir = await createWorkspace('baseline-test');
      await mockProvider.createBaseline(baselineDir);
    });

    afterEach(async () => {
      await cleanupWorkspace(baselineDir);
    });

    it('should inject bug and break tests', async () => {
      const buggyDir = await createWorkspace('buggy-test');

      const result = await mockProvider.injectBug(baselineDir, buggyDir);

      expect(result.success).toBe(true);
      expect(result.message).toContain('bug injected');

      const calculatorFile = join(buggyDir, 'src', 'calculator.ts');
      expect(existsSync(calculatorFile)).toBe(true);

      const content = await readFile(calculatorFile, 'utf-8');
      expect(content).toContain('Calculator');
      expect(content).toContain('return a - b'); // Bug: subtraction instead of addition

      await cleanupWorkspace(buggyDir);
    });

    it('should preserve project structure when injecting bug', async () => {
      const buggyDir = await createWorkspace('structure-test');

      await mockProvider.injectBug(baselineDir, buggyDir);

      expect(existsSync(join(buggyDir, 'package.json'))).toBe(true);
      expect(existsSync(join(buggyDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(buggyDir, 'vitest.config.ts'))).toBe(true);
      expect(existsSync(join(buggyDir, 'calculator.test.ts'))).toBe(true);

      await cleanupWorkspace(buggyDir);
    });
  });
});

describe('workspace utilities', () => {
  let workspaceDir: string;

  afterEach(async () => {
    if (workspaceDir) {
      await cleanupWorkspace(workspaceDir);
    }
  });

  describe('createWorkspace', () => {
    it('should create unique workspace directory', async () => {
      workspaceDir = await createWorkspace('test');

      expect(existsSync(workspaceDir)).toBe(true);
      expect(workspaceDir).toContain('ai-coding-arena-test');
    });

    it('should create different directories for different names', async () => {
      const workspace1 = await createWorkspace('test1');
      const workspace2 = await createWorkspace('test2');

      expect(workspace1).not.toBe(workspace2);
      expect(existsSync(workspace1)).toBe(true);
      expect(existsSync(workspace2)).toBe(true);

      await cleanupWorkspace(workspace1);
      await cleanupWorkspace(workspace2);
    });
  });

  describe('cleanupWorkspace', () => {
    it('should remove workspace directory', async () => {
      workspaceDir = await createWorkspace('cleanup-test');
      expect(existsSync(workspaceDir)).toBe(true);

      await cleanupWorkspace(workspaceDir);
      expect(existsSync(workspaceDir)).toBe(false);

      workspaceDir = '';
    });

    it('should not throw error if directory does not exist', async () => {
      await expect(cleanupWorkspace('/non/existent/path')).resolves.not.toThrow();
    });
  });
});
