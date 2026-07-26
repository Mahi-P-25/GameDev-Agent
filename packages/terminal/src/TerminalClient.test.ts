import { describe, expect, it, vi } from 'vitest';
import { TerminalClient } from './TerminalClient';
import {
  TerminalCommandRequiredError,
  TerminalSpawnError,
  TerminalTimeoutError,
} from './TerminalErrors';
import {
  TerminalCommandCompleted,
  TerminalCommandFailed,
  TerminalCommandStarted,
  TerminalOutput,
  TerminalProcessStopped,
} from './TerminalEvents';
import type { TerminalActor } from './TerminalTypes';
import { FakeProcess, FakeProcessRunner, TestBus, deterministicId } from './test_helpers';

const ACTOR: TerminalActor = { kind: 'director' };

function makeClient(runner: FakeProcessRunner): { client: TerminalClient; bus: TestBus } {
  const bus = new TestBus();
  const client = new TerminalClient({
    eventBus: bus,
    logger: {
      namespace: 'test',
      trace() {},
      debug() {},
      info() {},
      warn() {},
      error() {},
      fatal() {},
      child: () => makeLogger(),
    },
    runner,
    idGenerator: deterministicId,
    killGraceMs: 10,
  });
  return { client, bus };
}

function makeLogger() {
  return {
    namespace: 'test',
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    fatal() {},
    child: () => makeLogger(),
  } as unknown as import('@gamedev-agent/logging').Logger;
}

describe('TerminalClient', () => {
  it('runs a command and captures stdout, stderr, and exit code', async () => {
    const runner = new FakeProcessRunner();
    runner.enqueue(() => new FakeProcess('echo', ['hello stdout', 'line two'], ['warn stderr'], 0));
    const { client, bus } = makeClient(runner);

    const result = await client.runCommand(ACTOR, null, { command: 'echo', args: ['hi'] });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello stdoutline two');
    expect(result.stderr).toBe('warn stderr');
    expect(result.timedOut).toBe(false);
    expect(result.pid).not.toBeNull();

    // Started + output chunks + completed events were published.
    expect(bus.ofType(TerminalCommandStarted.type)).toHaveLength(1);
    expect(bus.ofType(TerminalOutput.type).length).toBeGreaterThanOrEqual(3);
    expect(bus.ofType(TerminalCommandCompleted.type)).toHaveLength(1);

    // Audit records the success.
    expect(client.auditTrail()).toHaveLength(1);
    expect(client.auditTrail()[0]?.ok).toBe(true);
  });

  it('streams output as terminal.output events with stream labels', async () => {
    const runner = new FakeProcessRunner();
    runner.enqueue(() => new FakeProcess('echo', ['out'], ['err'], 0));
    const { client, bus } = makeClient(runner);

    await client.runCommand(ACTOR, null, { command: 'echo' });

    const stdoutEvents = bus
      .ofType(TerminalOutput.type)
      .filter((e) => (e.payload as { stream: string }).stream === 'stdout');
    const stderrEvents = bus
      .ofType(TerminalOutput.type)
      .filter((e) => (e.payload as { stream: string }).stream === 'stderr');
    expect(stdoutEvents).toHaveLength(1);
    expect(stderrEvents).toHaveLength(1);
  });

  it('rejects an empty command', async () => {
    const runner = new FakeProcessRunner();
    const { client } = makeClient(runner);
    await expect(client.runCommand(ACTOR, null, { command: '   ' })).rejects.toBeInstanceOf(
      TerminalCommandRequiredError,
    );
  });

  it('surfaces a spawn failure as TerminalSpawnError and a failed event', async () => {
    const runner = new FakeProcessRunner();
    runner.enqueue(() => {
      const proc = new FakeProcess('missing');
      queueMicrotask(() => proc.fail(new Error('ENOENT')));
      return proc;
    });
    const { client, bus } = makeClient(runner);

    await expect(client.runCommand(ACTOR, null, { command: 'missing' })).rejects.toBeInstanceOf(
      TerminalSpawnError,
    );
    expect(bus.ofType(TerminalCommandFailed.type)).toHaveLength(1);
    expect(client.auditTrail()[0]?.ok).toBe(false);
  });

  it('returns a non-zero exit code in the result without throwing', async () => {
    const runner = new FakeProcessRunner();
    runner.enqueue(() => new FakeProcess('false', [], ['boom'], 1));
    const { client } = makeClient(runner);

    const result = await client.runCommand(ACTOR, null, { command: 'false' });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('boom');
    // Audit marks the run as not-ok for a non-zero exit, but output is preserved.
    expect(client.auditTrail()[0]?.ok).toBe(false);
  });

  it('starts a background process and resolves immediately with an id', () => {
    const runner = new FakeProcessRunner();
    runner.enqueue(() => new FakeProcess('sleep', ['bg'], [], 0));
    const { client, bus } = makeClient(runner);

    const info = client.startProcess(ACTOR, null, { command: 'sleep', background: true });
    expect(info.kind).toBe('background');
    expect(info.running).toBe(true);
    expect(bus.ofType(TerminalCommandStarted.type)).toHaveLength(1);
    expect(client.listProcesses()).toHaveLength(1);
  });

  it('stops a running process (cancel) and emits process-stopped', () => {
    const runner = new FakeProcessRunner();
    const proc = new FakeProcess('sleep', ['bg'], [], 0);
    runner.enqueue(() => proc);
    const { client, bus } = makeClient(runner);

    const info = client.startProcess(ACTOR, null, { command: 'sleep', background: true });
    const stopped = client.stopProcess(ACTOR, null, info.id, 'SIGTERM');

    expect(stopped.running).toBe(false);
    expect(bus.ofType(TerminalProcessStopped.type)).toHaveLength(1);
  });

  it('enforces a timeout, marking the result timed out and killing the process', async () => {
    const runner = new FakeProcessRunner();
    const proc = new FakeProcess('sleep', [], [], 0, false);
    runner.enqueue(() => proc);
    const { client } = makeClient(runner);

    const result = await client.runCommand(ACTOR, null, { command: 'sleep', timeoutMs: 20 });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
    expect(result.signal).toBe('SIGTERM');
  });

  it('reads captured output for a process by id', async () => {
    const runner = new FakeProcessRunner();
    runner.enqueue(() => new FakeProcess('echo', ['captured'], [], 0));
    const { client } = makeClient(runner);

    const info = client.startProcess(ACTOR, null, { command: 'echo', background: true });
    // Give the microtask-driven output a tick to flush.
    await new Promise((r) => setTimeout(r, 10));
    const output = client.getProcessOutput(info.id);
    expect(output.stdout).toContain('captured');
  });

  it('throws when stopping an unknown process id', async () => {
    const runner = new FakeProcessRunner();
    const { client } = makeClient(runner);
    const { TerminalProcessNotFoundError } = await import('./TerminalErrors');
    expect(() => client.stopProcess(ACTOR, null, 'does-not-exist' as never)).toThrow(
      TerminalProcessNotFoundError,
    );
  });

  it('resolves a mission via the coordinator link', async () => {
    const runner = new FakeProcessRunner();
    const spy = vi.fn().mockReturnValue({ missionId: 'm-1' });
    const linked = new TerminalClient({
      eventBus: new TestBus(),
      logger: makeLogger(),
      runner,
      coordinator: { resolveMission: spy },
    });
    expect(linked.resolveMission('c-9' as never)).toEqual({ missionId: 'm-1' });
    expect(spy).toHaveBeenCalledWith('c-9' as never);
  });

  it('audits every execution with actor and command line', async () => {
    const runner = new FakeProcessRunner();
    runner.enqueue(() => new FakeProcess('echo', ['x'], [], 0));
    const { client } = makeClient(runner);

    await client.runCommand({ kind: 'role:dev', id: 'u-7' }, 'corr-2' as never, {
      command: 'echo',
      args: ['x'],
    });
    const record = client.auditTrail()[0];
    expect(record?.actor).toEqual({ kind: 'role:dev', id: 'u-7' });
    expect(record?.correlationId).toBe('corr-2');
    expect(record?.commandLine).toContain('echo');
  });
});

describe('TerminalTimeoutError', () => {
  it('carries the command line and timeout', () => {
    const err = new TerminalTimeoutError('sleep 10', 20);
    expect(err.message).toContain('timed out after 20ms');
    expect(err.commandLine).toBe('sleep 10');
  });
});
