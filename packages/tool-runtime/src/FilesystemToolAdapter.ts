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

export const FILESYSTEM_TOOL_ID = 'nova.tool.filesystem' as ToolId;

export function filesystemCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'files',
      name: 'Files',
      description: 'Read, write, create, rename, delete, and list files on the local filesystem.',
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
  ];
}

export const filesystemDescriptor = {
  id: asToolId('nova.tool.filesystem'),
  name: 'Filesystem',
  description: 'Direct filesystem operations: read, write, search, and manage files.',
  version: '0.1.0',
  category: 'editor',
  permissions: ['fs.read', 'fs.write', 'fs.delete'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: filesystemCapabilities(),
  connection: 'embedded',
} as const;

export type FSImplementation = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createFile(path: string, content?: string): Promise<void>;
  deleteFile(path: string, recursive?: boolean): Promise<void>;
  renameFile(from: string, to: string): Promise<void>;
  listFiles(
    dirPath: string,
  ): Promise<ReadonlyArray<{ name: string; path: string; isDirectory: boolean }>>;
  searchFiles(pattern: string): Promise<ReadonlyArray<string>>;
  searchText(
    query: string,
    pathPattern?: string,
  ): Promise<ReadonlyArray<{ path: string; line: number; match: string }>>;
};

export class FilesystemToolAdapter implements ToolHandler {
  private connected = false;

  constructor(private readonly fs: FSImplementation) {}

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
    return this.connected ? 'healthy' : 'unknown';
  }

  capabilities(): ReadonlyArray<ToolCapability> {
    return filesystemCapabilities();
  }

  async invoke(
    action: string,
    input: Json,
    _context: ToolInvocationContext,
  ): Promise<ToolInvocationResult> {
    const args = (input ?? null) as Record<string, Json> | null;
    const toolId = FILESYSTEM_TOOL_ID;

    try {
      switch (action) {
        case 'files.list':
          return this.listFiles(toolId, action, args);
        case 'files.read':
          return this.readFile(toolId, action, args);
        case 'files.write':
          return this.writeFile(toolId, action, args);
        case 'files.create':
          return this.createFile(toolId, action, args);
        case 'files.rename':
          return this.renameFile(toolId, action, args);
        case 'files.delete':
          return this.deleteFile(toolId, action, args);
        case 'search.files':
          return this.searchFiles(toolId, action, args);
        case 'search.text':
          return this.searchText(toolId, action, args);
        default:
          return fail(toolId, action, 'action-not-found', `unknown filesystem action: ${action}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(toolId, action, 'invocation-error', message);
    }
  }

  private async listFiles(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const dirPath = String(args?.dirPath ?? '');
    const entries = await this.fs.listFiles(dirPath);
    return ok(toolId, action, entries as unknown as Json);
  }

  private async readFile(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const path = String(args?.path ?? '');
    const content = await this.fs.readFile(path);
    return ok(toolId, action, { path, content } as Json);
  }

  private async writeFile(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const path = String(args?.path ?? '');
    const content = String(args?.content ?? '');
    await this.fs.writeFile(path, content);
    return ok(toolId, action, { path } as Json);
  }

  private async createFile(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const path = String(args?.path ?? '');
    const content = args?.content !== undefined ? String(args.content) : undefined;
    await this.fs.createFile(path, content);
    return ok(toolId, action, { path } as Json);
  }

  private async renameFile(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const from = String(args?.from ?? '');
    const to = String(args?.to ?? '');
    await this.fs.renameFile(from, to);
    return ok(toolId, action, { from, to } as Json);
  }

  private async deleteFile(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const path = String(args?.path ?? '');
    const recursive = args?.recursive === true;
    await this.fs.deleteFile(path, recursive);
    return ok(toolId, action, { path } as Json);
  }

  private async searchFiles(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const pattern = String(args?.pattern ?? '');
    const matches = await this.fs.searchFiles(pattern);
    return ok(toolId, action, { pattern, matches } as unknown as Json);
  }

  private async searchText(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const query = String(args?.query ?? '');
    const pathPattern = args?.pathPattern !== undefined ? String(args.pathPattern) : undefined;
    const matches = await this.fs.searchText(query, pathPattern);
    return ok(toolId, action, { query, matches } as unknown as Json);
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
