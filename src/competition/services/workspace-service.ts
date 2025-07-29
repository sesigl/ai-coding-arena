// ABOUTME: Workspace lifecycle service handling creation, cleanup and resource management
// Encapsulates workspace operations with proper error handling and cleanup guarantees

import { createWorkspace, cleanupWorkspace } from 'infrastructure/workspace/workspace';
import { Result, ok, err } from 'neverthrow';

export interface WorkspaceContext {
  readonly workspaceDir: string;
  readonly cleanup: () => Promise<void>;
}

export class WorkspaceService {
  async createWorkspace(prefix: string): Promise<Result<WorkspaceContext, Error>> {
    try {
      const workspaceDir = await createWorkspace(prefix);

      const context: WorkspaceContext = {
        workspaceDir,
        cleanup: async () => {
          await cleanupWorkspace(workspaceDir);
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
}
