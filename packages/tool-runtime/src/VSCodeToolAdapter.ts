import type { Json } from '@gamedev-agent/shared';
import type { VSCodeClient } from '@gamedev-agent/vscode';
import type {
  ToolCapability,
  ToolHandler,
  ToolHealth,
  ToolId,
  ToolInvocationContext,
  ToolInvocationResult,
} from './ToolTypes';
import { asToolId } from './ToolTypes';

/**
 * The **first registered tool**: an adapter that wraps the existing
 * {@link VSCodeClient} behind the Tool Runtime's {@link ToolHandler} contract.
 *
 * This is the reference tool and the template every future tool (Git, Terminal,
 * Browser, Blender, …) follows. Crucially, it **does not modify VS Code
 * behavior** — it only translates the runtime's `action`/`input` calls into the
 * client's existing, audited methods and maps the results back into the
 * runtime's {@link ToolInvocationResult} shape. All ten VS Code capabilities
 * (open workspace, list/read/write/create/rename/delete files, search files,
 * search text, watch) become invokable actions.
 *
 * The adapter owns no domain logic; it is a thin, explicit translation layer.
 */
export const VSCODE_TOOL_ID = 'nova.tool.vscode' as ToolId;

/** The actor the adapter uses when delegating to the client (the runtime itself). */
const RUNTIME_ACTOR = { kind: 'tool-runtime' } as const;

/** The tool descriptor the VS Code integration registers under. */
export const vscodeDescriptor = {
  id: asToolId('nova.tool.vscode'),
  name: 'VS Code',
  description:
    'Open and inspect a workspace through VS Code: open/close, list/read files, search by name and content, and watch for changes.',
  version: '0.1.0',
  category: 'editor',
  permissions: ['fs.read'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: vscodeCapabilities(),
  connection: 'service',
} as const;

/** Build the capability card this adapter advertises to the runtime. */
export function vscodeCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'workspace',
      name: 'Workspace',
      description: 'Open and close a VS Code workspace.',
      actions: ['workspace.open', 'workspace.close'],
      permissions: [],
    },
    {
      id: 'filesystem',
      name: 'Filesystem',
      description: 'List, read, write, create, rename, and delete workspace files.',
      actions: [
        'files.list',
        'files.read',
        'files.write',
        'files.create',
        'files.rename',
        'files.delete',
      ],
      permissions: ['fs.read', 'fs.write', 'fs.delete'],
    },
    {
      id: 'search',
      name: 'Search',
      description: 'Search files by name and file contents by text.',
      actions: ['search.files', 'search.text'],
      permissions: ['fs.read'],
    },
    {
      id: 'watch',
      name: 'Watch',
      description: 'Watch the workspace for filesystem changes.',
      actions: ['watch.start', 'watch.stop'],
      permissions: [],
    },
  ];
}

export class VSCodeToolAdapter implements ToolHandler {
  private connected = false;

  constructor(private readonly client: VSCodeClient) {}

  /** VS Code needs no handshake; "connection" is the runtime's reachability gate. */
  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Healthy when connected; unknown otherwise (the client owns no health API). */
  async health(): Promise<ToolHealth> {
    return this.connected ? 'healthy' : 'unknown';
  }

  capabilities(): ReadonlyArray<ToolCapability> {
    return vscodeCapabilities();
  }

  /** Route a runtime action to the wrapped client method. */
  async invoke(
    action: string,
    input: Json,
    context: ToolInvocationContext,
  ): Promise<ToolInvocationResult> {
    const correlationId = context.correlationId;
    const args = (input ?? null) as Record<string, Json> | null;
    const toolId = VSCODE_TOOL_ID;

    try {
      switch (action) {
        case 'workspace.open': {
          const info = await this.client.openWorkspace(
            String(args?.rootPath),
            RUNTIME_ACTOR,
            correlationId,
          );
          return ok(toolId, action, info as unknown as Json);
        }
        case 'workspace.close': {
          await this.client.closeWorkspace(RUNTIME_ACTOR, correlationId);
          return ok(toolId, action, null);
        }
        case 'files.list': {
          const entries = await this.client.listFiles(
            RUNTIME_ACTOR,
            args?.dirPath !== undefined ? String(args.dirPath) : '',
            correlationId,
          );
          return ok(toolId, action, entries as unknown as Json);
        }
        case 'files.read': {
          const content = await this.client.readFile(
            RUNTIME_ACTOR,
            String(args?.path),
            correlationId,
          );
          return ok(toolId, action, content as unknown as Json);
        }
        case 'files.write': {
          await this.client.writeFile(
            RUNTIME_ACTOR,
            String(args?.path),
            String(args?.content),
            correlationId,
            args?.force !== undefined ? { force: Boolean(args.force) } : undefined,
          );
          return ok(toolId, action, null);
        }
        case 'files.create': {
          const created = await this.client.createFile(
            RUNTIME_ACTOR,
            String(args?.path),
            correlationId,
            {
              ...(args?.kind !== undefined ? { kind: args.kind as 'file' | 'directory' } : {}),
              ...(args?.content !== undefined ? { content: String(args.content) } : {}),
            },
          );
          return ok(toolId, action, created as unknown as Json);
        }
        case 'files.rename': {
          await this.client.renameFile(
            RUNTIME_ACTOR,
            String(args?.from),
            String(args?.to),
            correlationId,
          );
          return ok(toolId, action, null);
        }
        case 'files.delete': {
          await this.client.deleteFile(
            RUNTIME_ACTOR,
            String(args?.path),
            correlationId,
            args?.recursive !== undefined ? { recursive: Boolean(args.recursive) } : undefined,
          );
          return ok(toolId, action, null);
        }
        case 'search.files': {
          const matches = await this.client.searchFiles(
            RUNTIME_ACTOR,
            args ?? undefined,
            correlationId,
          );
          return ok(toolId, action, matches as unknown as Json);
        }
        case 'search.text': {
          const matches = await this.client.searchText(
            RUNTIME_ACTOR,
            String(args?.query),
            args ?? undefined,
            correlationId,
          );
          return ok(toolId, action, matches as unknown as Json);
        }
        case 'watch.start': {
          this.client.startWatch(RUNTIME_ACTOR, correlationId);
          return ok(toolId, action, null);
        }
        case 'watch.stop': {
          this.client.stopWatch(RUNTIME_ACTOR, correlationId, 'tool-runtime');
          return ok(toolId, action, null);
        }
        default:
          return fail(toolId, action, 'action-not-found', `unknown VS Code action: ${action}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(toolId, action, 'invocation-error', message);
    }
  }
}

function ok(toolId: ToolId, action: string, output: Json | null): ToolInvocationResult {
  return { ok: true, toolId, action, durationMs: 0, output, ...(output === null ? {} : {}) };
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
