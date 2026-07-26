import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
import type { Json } from '@gamedev-agent/shared';
import { describe, expect, it, vi } from 'vitest';
import { ToolManager } from './ToolManager';
import type {
  ToolCapability,
  ToolDescriptor,
  ToolHandler,
  ToolId,
  ToolInvocationContext,
  ToolInvocationResult,
} from './ToolTypes';
import { asToolId } from './ToolTypes';

/** In-memory EventBus double: records every published event, no-op subscribe. */
function makeBus(): EventBusContract & { published: Array<{ type: string; payload: unknown }> } {
  const published: Array<{ type: string; payload: unknown }> = [];
  return {
    published,
    async publish<T>(definition: EventDefinition<T>, payload: T): Promise<void> {
      published.push({ type: definition.type, payload });
    },
    subscribe: () => () => {},
    on: () => () => {},
    off: () => {},
    dispose: () => {},
  } as unknown as EventBusContract & { published: Array<{ type: string; payload: unknown }> };
}

/** A minimal handler double whose behavior is driven by the test. */
class StubHandler implements ToolHandler {
  connected = false;
  healthState: 'unknown' | 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  calls: Array<{ action: string; input: unknown }> = [];
  failNext = false;

  async connect(): Promise<void> {
    this.connected = true;
  }
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  isConnected(): boolean {
    return this.connected;
  }
  async health(): Promise<'unknown' | 'healthy' | 'degraded' | 'unhealthy'> {
    return this.healthState;
  }
  capabilities(): ReadonlyArray<ToolCapability> {
    return [
      {
        id: 'fs',
        name: 'Filesystem',
        description: 'read/write',
        actions: ['files.read', 'files.write'],
        permissions: ['fs.read', 'fs.write'],
      },
    ];
  }
  async invoke(
    action: string,
    input: Json,
    _context: ToolInvocationContext,
  ): Promise<ToolInvocationResult> {
    this.calls.push({ action, input });
    if (this.failNext) {
      return {
        ok: false,
        toolId: 'stub' as ToolId,
        action,
        durationMs: 0,
        output: null,
        error: { code: 'boom', message: 'kaboom' },
      };
    }
    return {
      ok: true,
      toolId: 'stub' as ToolId,
      action,
      durationMs: 0,
      output: { echoed: action } as Json,
    };
  }
}

function stubDescriptor(id = 'nova.tool.stub'): ToolDescriptor {
  return {
    id: asToolId(id),
    name: 'Stub Tool',
    description: 'A test tool',
    version: '1.0.0',
    category: 'editor',
    permissions: ['fs.read', 'fs.write'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    capabilities: [
      {
        id: 'fs',
        name: 'Filesystem',
        description: 'read/write',
        actions: ['files.read', 'files.write'],
        permissions: ['fs.read', 'fs.write'],
      },
    ],
    connection: 'embedded',
  };
}

describe('ToolManager', () => {
  it('registers a tool, advertises, and emits tool.registered', () => {
    const bus = makeBus();
    const manager = new ToolManager({ eventBus: bus, platform: 'win32' });
    const handler = new StubHandler();
    manager.register(stubDescriptor(), handler);

    expect(manager.list()).toHaveLength(1);
    expect(manager.get(asToolId('nova.tool.stub'))).toBeDefined();
    expect(bus.published.some((e) => e.type === 'tool.registered')).toBe(true);
    expect(manager.auditTrail().some((a) => a.kind === 'tool.registered')).toBe(true);
  });

  it('rejects duplicate registration', () => {
    const bus = makeBus();
    const manager = new ToolManager({ eventBus: bus, platform: 'win32' });
    manager.register(stubDescriptor(), new StubHandler());
    expect(() => manager.register(stubDescriptor(), new StubHandler())).toThrow();
  });

  it('rejects tools unsupported on the host platform', () => {
    const bus = makeBus();
    const manager = new ToolManager({ eventBus: bus, platform: 'web' });
    expect(() => manager.register(stubDescriptor(), new StubHandler())).toThrow();
  });

  it('drives the connection lifecycle and emits tool.connection-changed', async () => {
    const bus = makeBus();
    const manager = new ToolManager({ eventBus: bus, platform: 'win32' });
    manager.register(stubDescriptor(), new StubHandler());

    await manager.connect(asToolId('nova.tool.stub'), { kind: 'director' });
    expect(manager.isConnected(asToolId('nova.tool.stub'))).toBe(true);
    const connectEvents = bus.published.filter((e) => e.type === 'tool.connection-changed');
    expect(connectEvents.at(-1)?.payload).toMatchObject({ state: 'connected' });

    await manager.disconnect(asToolId('nova.tool.stub'), { kind: 'director' });
    expect(manager.isConnected(asToolId('nova.tool.stub'))).toBe(false);
  });

  it('invokes a connected tool and records success', async () => {
    const bus = makeBus();
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write'],
    });
    const handler = new StubHandler();
    manager.register(stubDescriptor(), handler);
    await manager.connect(asToolId('nova.tool.stub'), { kind: 'director' });

    const result = await manager.invoke({
      toolId: asToolId('nova.tool.stub'),
      action: 'files.read',
      input: { path: 'x' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ echoed: 'files.read' });
    expect(handler.calls).toHaveLength(1);
    expect(bus.published.some((e) => e.type === 'tool.invocation-succeeded')).toBe(true);
  });

  it('denies invocation when a permission is missing', async () => {
    const bus = makeBus();
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read'],
    });
    const handler = new StubHandler();
    manager.register(stubDescriptor(), handler);
    await manager.connect(asToolId('nova.tool.stub'), { kind: 'director' });

    const result = await manager.invoke({
      toolId: asToolId('nova.tool.stub'),
      action: 'files.write',
      input: {},
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('permission-denied');
    expect(bus.published.some((e) => e.type === 'tool.permission-denied')).toBe(true);
  });

  it('refuses to invoke a disconnected tool', async () => {
    const bus = makeBus();
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write'],
    });
    manager.register(stubDescriptor(), new StubHandler());
    const result = await manager.invoke({
      toolId: asToolId('nova.tool.stub'),
      action: 'files.read',
      input: {},
      actor: { kind: 'director' },
      correlationId: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('not-connected');
  });

  it('reports failure events when the handler returns a failure', async () => {
    const bus = makeBus();
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write'],
    });
    const handler = new StubHandler();
    handler.failNext = true;
    manager.register(stubDescriptor(), handler);
    await manager.connect(asToolId('nova.tool.stub'), { kind: 'director' });

    const result = await manager.invoke({
      toolId: asToolId('nova.tool.stub'),
      action: 'files.read',
      input: {},
      actor: { kind: 'director' },
      correlationId: null,
    });
    expect(result.ok).toBe(false);
    expect(bus.published.some((e) => e.type === 'tool.invocation-failed')).toBe(true);
  });

  it('assesses health and emits tool.health-changed on change', async () => {
    const bus = makeBus();
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      healthCheckIntervalMs: 10,
    });
    const handler = new StubHandler();
    manager.register(stubDescriptor(), handler);
    await manager.connect(asToolId('nova.tool.stub'), { kind: 'director' });

    handler.healthState = 'degraded';
    const health = await manager.assessHealth(asToolId('nova.tool.stub'));
    expect(health).toBe('degraded');
    expect(bus.published.some((e) => e.type === 'tool.health-changed')).toBe(true);
  });

  it('unregisters a tool and withdraws its capability', () => {
    const bus = makeBus();
    const withdraw = vi.fn();
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      capabilities: { advertise: vi.fn(), withdraw },
    });
    manager.register(stubDescriptor(), new StubHandler());
    manager.unregister(asToolId('nova.tool.stub'));
    expect(manager.list()).toHaveLength(0);
    expect(withdraw).toHaveBeenCalledWith(asToolId('nova.tool.stub'));
    expect(bus.published.some((e) => e.type === 'tool.unregistered')).toBe(true);
  });
});
