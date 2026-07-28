import type { GitProvider, GitProviderStatus } from '@gamedev-agent/runtime';
import type { Json } from '@gamedev-agent/shared';
import type {
  ToolCapability,
  ToolHandler,
  ToolHealth,
  ToolId,
  ToolInvocationContext,
  ToolInvocationResult,
} from './ToolTypes';
import { asToolId } from './ToolTypes';

export const GIT_TOOL_ID = 'nova.tool.git' as ToolId;

export function gitCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'repository',
      name: 'Repository',
      description: 'Initialize a new git repository.',
      actions: ['git.init'],
      permissions: ['process.spawn'],
    },
    {
      id: 'status',
      name: 'Status',
      description: 'Read the current git repository status.',
      actions: ['git.status'],
      permissions: ['fs.read'],
    },
    {
      id: 'commits',
      name: 'Commits',
      description: 'Create commits by staging all changes and committing.',
      actions: ['git.commit'],
      permissions: ['process.spawn'],
    },
  ];
}

export const gitDescriptor = {
  id: asToolId('nova.tool.git'),
  name: 'Git',
  description: 'Initialize repositories, read status, and create commits.',
  version: '0.1.0',
  category: 'vcs',
  permissions: ['process.spawn', 'fs.read'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: gitCapabilities(),
  connection: 'embedded',
} as const;

export class GitToolAdapter implements ToolHandler {
  private connected = false;

  constructor(private readonly gitProvider: GitProvider) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async health(): Promise<ToolHealth> {
    try {
      const status = this.gitProvider.getStatus();
      return mapProviderHealth(status);
    } catch {
      return 'unknown';
    }
  }

  capabilities(): ReadonlyArray<ToolCapability> {
    return gitCapabilities();
  }

  async invoke(
    action: string,
    input: Json,
    _context: ToolInvocationContext,
  ): Promise<ToolInvocationResult> {
    const args = (input ?? null) as Record<string, Json> | null;
    const toolId = GIT_TOOL_ID;

    try {
      switch (action) {
        case 'git.init': {
          await this.gitProvider.init();
          const status = this.gitProvider.getStatus();
          return ok(toolId, action, {
            repoRoot: status.repoRoot,
            branch: status.branch,
          } as Json);
        }

        case 'git.status': {
          const status = await this.gitProvider.refresh();
          return ok(toolId, action, serializeStatus(status));
        }

        case 'git.commit': {
          const message =
            typeof args?.message === 'string' && args.message.length > 0
              ? args.message
              : 'Nova commit';
          const hash = await this.gitProvider.commit(message);
          return ok(toolId, action, { hash, message } as Json);
        }

        default:
          return fail(toolId, action, 'action-not-found', `unknown git action: ${action}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(toolId, action, 'invocation-error', message);
    }
  }
}

function ok(toolId: ToolId, action: string, output: Json | null): ToolInvocationResult {
  return { ok: true, toolId, action, durationMs: 0, output };
}

function fail(toolId: ToolId, action: string, code: string, message: string): ToolInvocationResult {
  return {
    ok: false,
    toolId,
    action,
    durationMs: 0,
    output: null,
    error: { code, message },
  };
}

function mapProviderHealth(status: GitProviderStatus): ToolHealth {
  switch (status.health) {
    case 'up':
      return 'healthy';
    case 'down':
      return 'unhealthy';
    case 'degraded':
      return 'degraded';
    default:
      return 'unknown';
  }
}

function serializeStatus(status: GitProviderStatus): Json {
  return {
    branch: status.branch,
    dirty: status.dirty,
    repoRoot: status.repoRoot,
    health: status.health,
  } as Json;
}
