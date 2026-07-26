import type { Json } from '@gamedev-agent/shared';
import type {
  ToolCapability,
  ToolHandler,
  ToolHealth,
  ToolId,
  ToolInvocationContext,
  ToolInvocationResult,
} from '@gamedev-agent/tool-runtime';
import { asToolId } from '@gamedev-agent/tool-runtime';
import type { TerminalClient } from './TerminalClient';
import type { TerminalRunOptions } from './TerminalTypes';

/**
 * The **second registered tool**: an adapter that wraps the {@link TerminalClient}
 * behind the Tool Runtime's {@link ToolHandler} contract.
 *
 * Like the VS Code adapter, it is a thin, explicit translation layer: it owns no
 * domain logic, performs no process spawning itself, and never modifies the
 * client's behavior. It maps the runtime's dotted `action` strings to the
 * client's audited methods and translates results/errors into the runtime's
 * {@link ToolInvocationResult} shape. Every real execution still flows through
 * the client, which audits it and publishes `terminal.*` events.
 *
 * Safety is preserved end-to-end: the adapter only acts when the Tool Runtime
 * routes an explicitly-requested, permission-checked invocation to it. No
 * command runs unless the caller asked for it.
 */
export const TERMINAL_TOOL_ID = 'nova.tool.terminal' as ToolId;

/** The actor the adapter uses when delegating to the client (the runtime itself). */
const RUNTIME_ACTOR = { kind: 'tool-runtime' } as const;

/** Build the capability cards this adapter advertises to the runtime. */
export function terminalCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'shell',
      name: 'Shell',
      description: 'Run terminal commands in the foreground or background.',
      actions: ['terminal.run', 'terminal.start'],
      permissions: ['process.spawn', 'system.env'],
    },
    {
      id: 'process-control',
      name: 'Process Control',
      description: 'Cancel running terminal processes.',
      actions: ['terminal.stop'],
      permissions: ['process.kill'],
    },
    {
      id: 'output',
      name: 'Process Output',
      description: 'Read captured stdout/stderr of a process.',
      actions: ['terminal.output'],
      permissions: [],
    },
  ];
}

/** The tool descriptor the Terminal integration registers under. */
export const terminalDescriptor = {
  id: asToolId('nova.tool.terminal'),
  name: 'Terminal',
  description:
    'Safely execute terminal commands under explicit user approval: run, stream output, cancel, working directory, environment variables, foreground/background processes, exit codes, and timeouts.',
  version: '0.1.0',
  category: 'shell',
  permissions: ['process.spawn', 'process.kill', 'system.env'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: terminalCapabilities(),
  connection: 'process',
} as const;

export class TerminalToolAdapter implements ToolHandler {
  private connected = false;

  constructor(private readonly client: TerminalClient) {}

  /** The terminal needs no handshake; "connection" is the runtime's reachability gate. */
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
    return terminalCapabilities();
  }

  /** Route a runtime action to the wrapped client method. */
  async invoke(
    action: string,
    input: Json,
    context: ToolInvocationContext,
  ): Promise<ToolInvocationResult> {
    const correlationId = context.correlationId;
    const args = (input ?? null) as Record<string, Json> | null;
    const toolId = TERMINAL_TOOL_ID;

    try {
      switch (action) {
        case 'terminal.run': {
          const result = await this.client.runCommand(
            RUNTIME_ACTOR,
            correlationId,
            parseRunOptions(args),
          );
          return ok(toolId, action, result as unknown as Json);
        }
        case 'terminal.start': {
          const info = this.client.startProcess(
            RUNTIME_ACTOR,
            correlationId,
            parseRunOptions(args),
          );
          return ok(toolId, action, info as unknown as Json);
        }
        case 'terminal.stop': {
          const processId = String(args?.processId);
          const info = this.client.stopProcess(
            RUNTIME_ACTOR,
            correlationId,
            processId as never,
            args?.signal !== undefined ? String(args.signal) : undefined,
          );
          return ok(toolId, action, info as unknown as Json);
        }
        case 'terminal.output': {
          const processId = String(args?.processId);
          const output = this.client.getProcessOutput(processId as never);
          return ok(toolId, action, output as unknown as Json);
        }
        default:
          return fail(toolId, action, 'action-not-found', `unknown terminal action: ${action}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(toolId, action, 'invocation-error', message);
    }
  }
}

/** Coerce raw tool input into a {@link TerminalRunOptions}. */
function parseRunOptions(args: Record<string, Json> | null): TerminalRunOptions {
  if (args === null) {
    throw new Error('terminal command options are required');
  }
  const command = typeof args.command === 'string' ? args.command : '';
  const rawArgs = args.args;
  const options: TerminalRunOptions = {
    command,
    ...(Array.isArray(rawArgs) ? { args: rawArgs.map((a) => String(a)) } : {}),
    ...(typeof args.cwd === 'string' ? { cwd: args.cwd } : {}),
    ...(isRecord(args.env) ? { env: recordToStrings(args.env) } : {}),
    ...(typeof args.timeoutMs === 'number' ? { timeoutMs: args.timeoutMs } : {}),
    ...(args.background === true ? { background: true } : {}),
  };
  return options;
}

function isRecord(value: Json | undefined): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordToStrings(record: Record<string, Json>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
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
