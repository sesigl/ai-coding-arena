// ABOUTME: Workspace utilities for creating and managing isolated directories
// Handles temp directory creation and cleanup for competition phases

import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export async function createWorkspace(name: string): Promise<string> {
  const workspaceDir = join(tmpdir(), `ai-coding-arena-${name}-${Date.now()}`);
  await mkdir(workspaceDir, { recursive: true });
  return workspaceDir;
}

export async function cleanupWorkspace(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors - workspace might already be gone
  }
}