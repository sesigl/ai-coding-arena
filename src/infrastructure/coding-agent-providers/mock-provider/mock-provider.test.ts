// ABOUTME: Test file for MockProvider implementation following TDD approach
// Tests the basic LLM provider interface and baseline creation workflow

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MockProvider } from './mock-provider';
import { WorkspaceService } from 'infrastructure/workspace/workspace-service';

describe('MockProvider', () => {
  let mockProvider: MockProvider;
  let workspaceDir: string;

  beforeEach(async () => {
    mockProvider = new MockProvider();
    workspaceDir = await WorkspaceService.createWorkspace('mock-test');
  });

  afterEach(async () => {
    await WorkspaceService.cleanupWorkspace(workspaceDir);
  });

  describe('interface compliance', () => {
    it('should have a name property', () => {
      expect(mockProvider.name).toBe('mock-provider');
    });

    it('should have createBaseline method', () => {
      expect(typeof mockProvider.createCodingExercise).toBe('function');
    });
  });

  describe('createBaseline', () => {
    it('should return success true with message', async () => {
      const result = await mockProvider.createCodingExercise(
        workspaceDir,
        'Create a calculator project'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('baseline created');
    });

    it('should create calculator program file', async () => {
      await mockProvider.createCodingExercise(workspaceDir, 'Create a calculator project');

      const programFile = join(workspaceDir, 'src', 'calculator.ts');
      expect(existsSync(programFile)).toBe(true);

      const content = await readFile(programFile, 'utf-8');
      expect(content).toContain('Calculator');
    });

    it('should create test file', async () => {
      await mockProvider.createCodingExercise(workspaceDir, 'Create a calculator project');

      const testFile = join(workspaceDir, 'calculator.test.ts');
      expect(existsSync(testFile)).toBe(true);

      const content = await readFile(testFile, 'utf-8');
      expect(content).toContain('Calculator');
    });

    it('should create complete executable project structure', async () => {
      await mockProvider.createCodingExercise(workspaceDir, 'Create a calculator project');

      expect(existsSync(join(workspaceDir, 'package.json'))).toBe(true);
      expect(existsSync(join(workspaceDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(workspaceDir, 'vitest.config.ts'))).toBe(true);
    });
  });

  describe('injectBug', () => {
    let baselineDir: string;

    beforeEach(async () => {
      baselineDir = await WorkspaceService.createWorkspace('baseline-test');
      await mockProvider.createCodingExercise(baselineDir, 'Create a calculator project');
    });

    afterEach(async () => {
      await WorkspaceService.cleanupWorkspace(baselineDir);
    });

    it('should inject bug and break tests', async () => {
      const buggyDir = await WorkspaceService.createWorkspace('buggy-test');

      const result = await mockProvider.injectBug(
        baselineDir,
        buggyDir,
        'Inject a bug into the calculator'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('bug injected');

      const calculatorFile = join(buggyDir, 'src', 'calculator.ts');
      expect(existsSync(calculatorFile)).toBe(true);

      const content = await readFile(calculatorFile, 'utf-8');
      expect(content).toContain('Calculator');
      expect(content).toContain('return a - b');

      await WorkspaceService.cleanupWorkspace(buggyDir);
    });

    it('should preserve project structure when injecting bug', async () => {
      const buggyDir = await WorkspaceService.createWorkspace('structure-test');

      await mockProvider.injectBug(baselineDir, buggyDir, 'Inject a bug into the calculator');

      expect(existsSync(join(buggyDir, 'package.json'))).toBe(true);
      expect(existsSync(join(buggyDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(buggyDir, 'vitest.config.ts'))).toBe(true);
      expect(existsSync(join(buggyDir, 'calculator.test.ts'))).toBe(true);

      await WorkspaceService.cleanupWorkspace(buggyDir);
    });
  });

  describe('fixAttempt', () => {
    let baselineDir: string;
    let buggyDir: string;

    beforeEach(async () => {
      baselineDir = await WorkspaceService.createWorkspace('baseline-test');
      await mockProvider.createCodingExercise(baselineDir, 'Create a calculator project');

      buggyDir = await WorkspaceService.createWorkspace('buggy-test');
      await mockProvider.injectBug(baselineDir, buggyDir, 'Inject a bug into the calculator');
    });

    afterEach(async () => {
      await WorkspaceService.cleanupWorkspace(baselineDir);
      await WorkspaceService.cleanupWorkspace(buggyDir);
    });

    it('should fix bug and restore correct functionality', async () => {
      const fixDir = await WorkspaceService.createWorkspace('fix-test');

      const result = await mockProvider.fixAttempt(
        buggyDir,
        fixDir,
        'Fix the bug in the calculator'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('fix applied');

      const calculatorFile = join(fixDir, 'src', 'calculator.ts');
      expect(existsSync(calculatorFile)).toBe(true);

      const content = await readFile(calculatorFile, 'utf-8');
      expect(content).toContain('Calculator');
      expect(content).toContain('return a + b;');
      expect(content).not.toContain('return a - b; // BUG: Should be addition');

      await WorkspaceService.cleanupWorkspace(fixDir);
    });

    it('should preserve project structure when fixing bug', async () => {
      const fixDir = await WorkspaceService.createWorkspace('fix-structure-test');

      await mockProvider.fixAttempt(buggyDir, fixDir, 'Fix the bug in the calculator');

      expect(existsSync(join(fixDir, 'package.json'))).toBe(true);
      expect(existsSync(join(fixDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(fixDir, 'vitest.config.ts'))).toBe(true);
      expect(existsSync(join(fixDir, 'calculator.test.ts'))).toBe(true);

      await WorkspaceService.cleanupWorkspace(fixDir);
    });
  });
});

describe('workspace utilities', () => {
  let workspaceDir: string;

  afterEach(async () => {
    if (workspaceDir) {
      await WorkspaceService.cleanupWorkspace(workspaceDir);
    }
  });

  describe('createWorkspace', () => {
    it('should create unique workspace directory', async () => {
      workspaceDir = await WorkspaceService.createWorkspace('test');

      expect(existsSync(workspaceDir)).toBe(true);
      expect(workspaceDir).toContain('ai-coding-arena-test');
    });

    it('should create different directories for different names', async () => {
      const workspace1 = await WorkspaceService.createWorkspace('test1');
      const workspace2 = await WorkspaceService.createWorkspace('test2');

      expect(workspace1).not.toBe(workspace2);
      expect(existsSync(workspace1)).toBe(true);
      expect(existsSync(workspace2)).toBe(true);

      await WorkspaceService.cleanupWorkspace(workspace1);
      await WorkspaceService.cleanupWorkspace(workspace2);
    });
  });

  describe('cleanupWorkspace', () => {
    it('should remove workspace directory', async () => {
      workspaceDir = await WorkspaceService.createWorkspace('cleanup-test');
      expect(existsSync(workspaceDir)).toBe(true);

      await WorkspaceService.cleanupWorkspace(workspaceDir);
      expect(existsSync(workspaceDir)).toBe(false);

      workspaceDir = '';
    });

    it('should not throw error if directory does not exist', async () => {
      await expect(WorkspaceService.cleanupWorkspace('/non/existent/path')).resolves.not.toThrow();
    });
  });
});
