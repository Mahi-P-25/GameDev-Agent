import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname } from 'node:path';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { EventBusContract } from '@gamedev-agent/events';
import { ToolManager, asToolId } from '@gamedev-agent/tool-runtime';
import type {
  Json,
  ToolCapability,
  ToolDescriptor,
  ToolHandler,
  ToolHealth,
  ToolId,
  ToolInvocationContext,
  ToolInvocationResult,
} from '@gamedev-agent/tool-runtime';
import type { Task, TaskResult } from './types';

const execFileAsync = promisify(execFile);

// ─── Tool IDs ────────────────────────────────────────────────────────

export const FILESYSTEM_TOOL_ID = 'nova.tool.filesystem' as ToolId;
export const TERMINAL_TOOL_ID = 'nova.tool.terminal' as ToolId;

// ─── Descriptors ─────────────────────────────────────────────────────

function filesystemCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'filesystem',
      name: 'Filesystem',
      description: 'Create, write, and remove files and directories.',
      actions: ['files.create', 'files.write', 'files.remove'],
      permissions: ['fs.read', 'fs.write', 'fs.delete'],
    },
  ];
}

export const filesystemDescriptor: ToolDescriptor = {
  id: asToolId(FILESYSTEM_TOOL_ID),
  name: 'Filesystem',
  description: 'Create directories and write files on the local filesystem.',
  version: '0.1.0',
  category: 'build',
  permissions: ['fs.read', 'fs.write'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: filesystemCapabilities(),
  connection: 'embedded',
  requiredTools: [],
};

function terminalCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'shell',
      name: 'Shell',
      description: 'Run terminal commands.',
      actions: ['terminal.run'],
      permissions: ['process.spawn', 'system.env'],
    },
  ];
}

export const terminalDescriptor: ToolDescriptor = {
  id: asToolId(TERMINAL_TOOL_ID),
  name: 'Terminal',
  description: 'Run terminal commands with timeout and working directory support.',
  version: '0.1.0',
  category: 'shell',
  permissions: ['process.spawn', 'system.env'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: terminalCapabilities(),
  connection: 'embedded',
  requiredTools: [],
};

// ─── Filesystem Handler ──────────────────────────────────────────────

class FilesystemHandler implements ToolHandler {
  private connected = false;

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
        case 'files.create': {
          const path = typeof args?.path === 'string' ? args.path : '';
          const kind = typeof args?.kind === 'string' ? args.kind : 'file';
          if (kind === 'directory') {
            await mkdir(path, { recursive: true });
          } else {
            const content = typeof args?.content === 'string' ? args.content : '';
            const dir = dirname(path);
            if (dir !== '.') {
              await mkdir(dir, { recursive: true });
            }
            await writeFile(path, content, 'utf-8');
          }
          return { ok: true, toolId, action, durationMs: 0, output: { path } };
        }

        case 'files.write': {
          const path = typeof args?.path === 'string' ? args.path : '';
          const content = typeof args?.content === 'string' ? args.content : '';
          const dir = dirname(path);
          if (dir !== '.') {
            await mkdir(dir, { recursive: true });
          }
          await writeFile(path, content, 'utf-8');
          return { ok: true, toolId, action, durationMs: 0, output: null };
        }

        case 'files.remove': {
          const path = typeof args?.path === 'string' ? args.path : '';
          await rm(path, { recursive: true, force: true });
          return { ok: true, toolId, action, durationMs: 0, output: { path } };
        }

        default:
          return { ok: false, toolId, action, durationMs: 0, output: null, error: { code: 'action-not-found', message: `unknown filesystem action: ${action}` } };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, toolId, action, durationMs: 0, output: null, error: { code: 'invocation-error', message } };
    }
  }
}

// ─── Terminal Handler ────────────────────────────────────────────────

class TerminalHandler implements ToolHandler {
  private connected = false;

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
    return terminalCapabilities();
  }

  async invoke(
    action: string,
    input: Json,
    _context: ToolInvocationContext,
  ): Promise<ToolInvocationResult> {
    const args = (input ?? null) as Record<string, Json> | null;
    const toolId = TERMINAL_TOOL_ID;

    try {
      switch (action) {
        case 'terminal.run': {
          const command = typeof args?.command === 'string' ? args.command : '';
          if (command.length === 0) {
            return { ok: false, toolId, action, durationMs: 0, output: null, error: { code: 'invalid-input', message: 'command is required' } };
          }
          const cmdArgs = Array.isArray(args?.args) ? args.args.map((a) => String(a)) : [];
          const cwd = typeof args?.cwd === 'string' ? args.cwd : undefined;
          const timeoutMs = typeof args?.timeoutMs === 'number' ? args.timeoutMs : undefined;

          const shell = process.platform === 'win32';
          const execOpts: Record<string, unknown> = {
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
            shell,
          };
          if (cwd !== undefined) execOpts.cwd = cwd;
          if (timeoutMs !== undefined) execOpts.timeout = timeoutMs;
          const output = await execFileAsync(command, cmdArgs, execOpts as never);

          return {
            ok: true,
            toolId,
            action,
            durationMs: 0,
            output: { stdout: output.stdout, stderr: output.stderr } as unknown as Json,
          };
        }

        default:
          return { ok: false, toolId, action, durationMs: 0, output: null, error: { code: 'action-not-found', message: `unknown terminal action: ${action}` } };
      }
      } catch (error) {
      const e = error as { stdout?: unknown; stderr?: unknown; code?: number | null; killed?: boolean };
      const toStr = (v: unknown): string => (v instanceof Buffer ? v.toString() : String(v ?? ''));
      const errOut = toStr(e.stderr).trim() || toStr(e.stdout).trim();
      const baseMsg = error instanceof Error ? error.message : String(error);
      const message = errOut ? `${baseMsg}\n${errOut}` : baseMsg;
      return {
        ok: false,
        toolId,
        action,
        durationMs: 0,
        output: { stdout: toStr(e.stdout), stderr: toStr(e.stderr) } as unknown as Json,
        error: { code: e.killed ? 'timed-out' : 'invocation-error', message },
      };
    }
  }
}

// ─── Singleton Factory ───────────────────────────────────────────────

let _manager: ToolManager | null = null;

export async function createNativeToolManager(eventBus?: EventBusContract): Promise<ToolManager> {
  if (_manager !== null) return _manager;

  const bus = eventBus ?? new InMemoryEventBus('nova-v0.1');
  const manager = new ToolManager({
    eventBus: bus,
    platform: process.platform,
    grantedPermissions: ['fs.read', 'fs.write', 'fs.delete', 'process.spawn', 'system.env'],
  });

  manager.register(filesystemDescriptor, new FilesystemHandler());
  manager.register(terminalDescriptor, new TerminalHandler());

  await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
  await manager.connect(TERMINAL_TOOL_ID, { kind: 'director' });

  _manager = manager;
  return manager;
}

export function disposeToolManager(): void {
  if (_manager !== null) {
    _manager.dispose();
    _manager = null;
  }
}

// ─── Execution ────────────────────────────────────────────────────────

export async function executeTask(task: Task, toolManager: ToolManager): Promise<TaskResult> {
  const start = performance.now();

  try {
    const result = await toolManager.invoke({
      toolId: task.toolId as ToolId,
      action: task.action,
      input: task.input as Json,
      actor: { kind: 'nova-v0.1' },
      correlationId: null,
    });

    const durationMs = Math.round(performance.now() - start);

    return {
      taskId: task.id,
      success: result.ok,
      output: result.output as Record<string, unknown> | null,
      durationMs,
      error: result.ok ? null : (result.error?.message ?? 'Unknown error'),
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    return {
      taskId: task.id,
      success: false,
      output: null,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
