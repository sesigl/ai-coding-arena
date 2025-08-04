// ABOUTME: Workspace management service for creating, using and cleaning up isolated directories
// Comprehensive workspace lifecycle management with proper error handling and cleanup guarantees

import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Result, ok, err } from 'neverthrow';

export interface WorkspaceContext {
  readonly workspaceDir: string;
  readonly cleanup: () => Promise<void>;
}

export class WorkspaceService {
  async createWorkspace(prefix: string): Promise<Result<WorkspaceContext, Error>> {
    try {
      const workspaceDir = await this.createWorkspaceDirectory(prefix);

      const context: WorkspaceContext = {
        workspaceDir,
        cleanup: async () => {
          await this.cleanupWorkspace(workspaceDir);
        },
      };

      return ok(context);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async withWorkspace<T>(
    prefix: string,
    operation: (workspaceDir: string) => Promise<T>
  ): Promise<Result<T, Error>> {
    const workspaceResult = await this.createWorkspace(prefix);

    if (workspaceResult.isErr()) {
      return err(workspaceResult.error);
    }

    const { workspaceDir, cleanup } = workspaceResult.value;

    try {
      const result = await operation(workspaceDir);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      await cleanup();
    }
  }

  async withMultipleWorkspaces<T>(
    prefixes: string[],
    operation: (workspaceDirs: string[]) => Promise<T>
  ): Promise<Result<T, Error>> {
    const workspaces: WorkspaceContext[] = [];

    try {
      // Create all workspaces
      for (const prefix of prefixes) {
        const workspaceResult = await this.createWorkspace(prefix);
        if (workspaceResult.isErr()) {
          return err(workspaceResult.error);
        }
        workspaces.push(workspaceResult.value);
      }

      const workspaceDirs = workspaces.map(w => w.workspaceDir);
      const result = await operation(workspaceDirs);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Clean up all workspaces
      await Promise.all(workspaces.map(w => w.cleanup()));
    }
  }

  private async createWorkspaceDirectory(name: string): Promise<string> {
    const workspaceDir = join(tmpdir(), `ai-coding-arena-${name}-${Date.now()}`);
    await mkdir(workspaceDir, { recursive: true });
    return workspaceDir;
  }

  private async cleanupWorkspace(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Workspace might already be gone
    }
  }

  static async createWorkspace(name: string): Promise<string> {
    const workspaceDir = join(tmpdir(), `ai-coding-arena-${name}-${Date.now()}`);
    await mkdir(workspaceDir, { recursive: true });
    return workspaceDir;
  }

  static async cleanupWorkspace(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Workspace might already be gone
    }
  }
}
