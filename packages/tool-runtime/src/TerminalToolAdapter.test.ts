import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
import { describe, expect, it } from 'vitest';
import { TERMINAL_TOOL_ID, TerminalToolAdapter, terminalDescriptor } from './TerminalToolAdapter';
import { ToolManager } from './ToolManager';
import { asToolId } from './ToolTypes';

function makeBus(): EventBusContract & { published: Array<{ type: string; payload: unknown }> } {
  const published: Array<{ type: string; payload: unknown }> = [];
  return {
    published,
    async publish<T>(definition: EventDefinition<T>, payload: T): Promise<void> {
      published.push({ type: definition.type, payload });
    },
    subscribe: () => ({ dispose: () => {} }),
    once: () => ({ dispose: () => {} }),
    unsubscribe: () => {},
    replay: () => [],
    history: () => [],
    clearHistory: () => {},
    use: () => {},
    metrics: () => ({
      published: 0,
      delivered: 0,
      dropped: 0,
      historySize: 0,
      subscriberCount: 0,
      failedHandlers: 0,
      lastPublishMicros: 0,
    }),
    dispose: () => {},
  } as unknown as EventBusContract & { published: Array<{ type: string; payload: unknown }> };
}

describe('TerminalToolAdapter descriptor', () => {
  it('has the correct tool id', () => {
    expect(terminalDescriptor.id).toBe(asToolId('nova.tool.terminal'));
  });

  it('categorises as shell', () => {
    expect(terminalDescriptor.category).toBe('shell');
  });

  it('declares process.spawn and process.kill permissions', () => {
    expect(terminalDescriptor.permissions).toContain('process.spawn');
    expect(terminalDescriptor.permissions).toContain('process.kill');
  });

  it('exposes capabilities with terminal actions', () => {
    const caps = terminalDescriptor.capabilities;
    const allActions = caps.flatMap((c) => c.actions);
    expect(allActions).toContain('terminal.run');
    expect(allActions).toContain('terminal.start');
    expect(allActions).toContain('terminal.stop');
    expect(allActions).toContain('terminal.output');
  });
});

describe('TerminalToolAdapter execution', () => {
  it('runs a command and returns output', async () => {
    const bus = makeBus();
    const executor = {
      exec: async (_cmd: string, _args: ReadonlyArray<string>, _opts: any) => ({
        exitCode: 0,
        stdout: 'hello world',
        stderr: '',
      }),
    };
    const adapter = new TerminalToolAdapter(executor, '/test');
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['process.spawn'],
    });
    manager.register(terminalDescriptor, adapter);
    await manager.connect(TERMINAL_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: TERMINAL_TOOL_ID,
      action: 'terminal.run',
      input: { command: 'echo', args: ['hello world'] },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect((result.output as any)?.stdout).toBe('hello world');
    expect((result.output as any)?.exitCode).toBe(0);
  });

  it('returns action-not-found for unknown actions', async () => {
    const bus = makeBus();
    const executor = { exec: async () => ({ exitCode: 0, stdout: '', stderr: '' }) };
    const adapter = new TerminalToolAdapter(executor, '/test');
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['process.spawn'],
    });
    manager.register(terminalDescriptor, adapter);
    await manager.connect(TERMINAL_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: TERMINAL_TOOL_ID,
      action: 'terminal.invalid',
      input: {},
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('action-not-found');
  });

  it('starts a session and retrieves output', async () => {
    const bus = makeBus();
    const executor = {
      exec: async (_cmd: string, _args: ReadonlyArray<string>, _opts: any) => ({
        exitCode: 0,
        stdout: 'session output',
        stderr: '',
      }),
    };
    const adapter = new TerminalToolAdapter(executor, '/test');
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['process.spawn', 'process.kill'],
    });
    manager.register(terminalDescriptor, adapter);
    await manager.connect(TERMINAL_TOOL_ID, { kind: 'director' });

    const startResult = await manager.invoke({
      toolId: TERMINAL_TOOL_ID,
      action: 'terminal.start',
      input: { command: 'sleep', args: ['1'] },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(startResult.ok).toBe(true);
    const sessionId = (startResult.output as any)?.sessionId;
    expect(sessionId).toBeDefined();

    // Small delay to let the async command finish
    await new Promise((r) => setTimeout(r, 10));

    const outputResult = await manager.invoke({
      toolId: TERMINAL_TOOL_ID,
      action: 'terminal.output',
      input: { processId: sessionId },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(outputResult.ok).toBe(true);
    expect((outputResult.output as any)?.output).toBe('session output');
  });
});
