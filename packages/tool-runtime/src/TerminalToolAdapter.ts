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

export const TERMINAL_TOOL_ID = 'nova.tool.terminal' as ToolId;

export function terminalCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'execution',
      name: 'Execution',
      description: 'Run commands and get their output.',
      actions: ['terminal.run'],
      permissions: ['process.spawn'],
    },
    {
      id: 'sessions',
      name: 'Sessions',
      description: 'Start, monitor, and stop long-running terminal sessions.',
      actions: ['terminal.start', 'terminal.stop', 'terminal.output'],
      permissions: ['process.spawn', 'process.kill'],
    },
  ];
}

export const terminalDescriptor = {
  id: asToolId('nova.tool.terminal'),
  name: 'Terminal',
  description: 'Execute shell commands and manage terminal sessions.',
  version: '0.1.0',
  category: 'shell',
  permissions: ['process.spawn', 'process.kill', 'system.env'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: terminalCapabilities(),
  connection: 'embedded',
} as const;

interface SessionEntry {
  readonly id: string;
  readonly command: string;
  readonly startedAt: number;
  output: string[];
}

type ProcessExecutor = {
  exec(
    command: string,
    args: ReadonlyArray<string>,
    options: { cwd: string; timeoutMs?: number },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

export class TerminalToolAdapter implements ToolHandler {
  private connected = false;
  private readonly sessions = new Map<string, SessionEntry>();
  private nextSessionId = 0;

  constructor(
    private readonly executor: ProcessExecutor,
    private readonly workspaceRoot: string,
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.sessions.clear();
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
        case 'terminal.run':
          return this.runCommand(toolId, action, args);

        case 'terminal.start':
          return this.startSession(toolId, action, args);

        case 'terminal.stop':
          return this.stopSession(toolId, action, args);

        case 'terminal.output':
          return this.getSessionOutput(toolId, action, args);

        default:
          return fail(toolId, action, 'action-not-found', `unknown terminal action: ${action}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(toolId, action, 'invocation-error', message);
    }
  }

  private async runCommand(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): Promise<ToolInvocationResult> {
    const command = String(args?.command ?? '');
    const commandArgs = (args?.args as ReadonlyArray<string>) ?? [];
    const cwd = String(args?.cwd ?? this.workspaceRoot);
    const timeoutMs = args?.timeoutMs !== undefined ? Number(args.timeoutMs) : undefined;

    const result = await this.executor.exec(command, commandArgs, {
      cwd,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    });

    return ok(toolId, action, {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    } as Json);
  }

  private startSession(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): ToolInvocationResult {
    const command = String(args?.command ?? '');
    const commandArgs = (args?.args as ReadonlyArray<string>) ?? [];
    const sessionId = `term-${this.nextSessionId++}-${Date.now().toString(36)}`;

    const session: SessionEntry = {
      id: sessionId,
      command: [command, ...commandArgs].join(' '),
      startedAt: Date.now(),
      output: [],
    };
    this.sessions.set(sessionId, session);

    void this.executor
      .exec(command, commandArgs, {
        cwd: String(args?.cwd ?? this.workspaceRoot),
      })
      .then((result) => {
        const s = this.sessions.get(sessionId);
        if (s !== undefined) {
          s.output = [result.stdout, result.stderr];
        }
      })
      .catch(() => {});

    return ok(toolId, action, { sessionId, command: session.command } as Json);
  }

  private stopSession(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): ToolInvocationResult {
    const sessionId = String(args?.processId ?? '');
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return fail(toolId, action, 'session-not-found', `session "${sessionId}" not found`);
    }
    this.sessions.delete(sessionId);
    return ok(toolId, action, { sessionId, stopped: true } as Json);
  }

  private getSessionOutput(
    toolId: ToolId,
    action: string,
    args: Record<string, Json> | null,
  ): ToolInvocationResult {
    const sessionId = String(args?.processId ?? '');
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return fail(toolId, action, 'session-not-found', `session "${sessionId}" not found`);
    }
    return ok(toolId, action, {
      sessionId,
      command: session.command,
      output: session.output.filter(Boolean).join('\n'),
    } as Json);
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
