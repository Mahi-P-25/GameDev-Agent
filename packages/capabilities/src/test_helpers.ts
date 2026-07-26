import type { Envelope, EventBusContract, EventHandler } from '@gamedev-agent/events';
import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../src/Capability';
import type { RequiredTool } from '../src/CapabilityDescriptor';
import type { CapabilityContext as CapabilityContextContract } from '../src/CapabilityDescriptor';
import { type CapabilityDescriptor, asCapabilityId } from '../src/CapabilityDescriptor';
import type { ToolProbe } from '../src/ToolProbe';

/** Minimal in-memory Event Bus double; records every emitted envelope. */
export class FakeEventBus implements EventBusContract {
  private readonly handlers = new Map<string, Array<EventHandler<unknown>>>();
  private readonly recorded: Array<{ type: string; payload: unknown }> = [];

  async publish<T>(definition: { readonly type: string }, payload: T): Promise<void> {
    this.recorded.push({ type: definition.type, payload });
    const list = this.handlers.get(definition.type);
    if (list !== undefined) {
      for (const handler of list) {
        await handler({
          definition: definition as never,
          metadata: {} as Envelope<T>['metadata'],
          payload,
        });
      }
    }
  }

  subscribe<T>(
    definition: { readonly type: string },
    handler: EventHandler<T>,
  ): { dispose(): void } {
    const list = this.handlers.get(definition.type) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(definition.type, list);
    return { dispose: () => {} };
  }

  once(): { dispose(): void } {
    return { dispose: () => {} };
  }

  unsubscribe(): void {}

  replay(): Array<Envelope<unknown>> {
    return [];
  }

  history(): ReadonlyArray<Envelope<unknown>> {
    return [];
  }

  clearHistory(): void {}

  use(): void {}

  metrics() {
    return {
      published: this.recorded.length,
      delivered: 0,
      dropped: 0,
      historySize: 0,
      subscriberCount: 0,
      failedHandlers: 0,
      lastPublishMicros: 0,
    };
  }

  dispose(): void {
    this.handlers.clear();
  }

  /** Test helper: all payloads emitted for a given event type, in order. */
  emitted<T>(type: string): Array<T> {
    return this.recorded.filter((r) => r.type === type).map((r) => r.payload as T);
  }

  /** Test helper: ordered list of every emitted event type. */
  get types(): ReadonlyArray<string> {
    return this.recorded.map((r) => r.type);
  }

  get publishCount(): number {
    return this.recorded.length;
  }
}

/**
 * Deterministic tool probe. By default all tools are available; `unavailable`
 * lets tests simulate a missing external dependency.
 */
export class FakeToolProbe implements ToolProbe {
  private readonly unavailable = new Set<string>();

  block(tool: string): void {
    this.unavailable.add(tool);
  }

  allow(tool: string): void {
    this.unavailable.delete(tool);
  }

  async isAvailable(tool: RequiredTool): Promise<boolean> {
    return !this.unavailable.has(tool.name);
  }

  async reason(tool: RequiredTool): Promise<string | undefined> {
    return this.unavailable.has(tool.name) ? `simulated missing: ${tool.name}` : undefined;
  }
}

/** A trivial capability used to exercise the manager/registry without built-ins. */
export function makeTestDescriptor(
  overrides: Partial<CapabilityDescriptor> = {},
): CapabilityDescriptor {
  return {
    id: asCapabilityId('nova.capability.test'),
    name: 'Test',
    description: 'A test capability.',
    version: '0.1.0',
    category: 'shell',
    permissions: ['process.spawn'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    requiredTools: [],
    inputs: [{ name: 'value', type: 'string', required: true }],
    outputs: [{ name: 'echo', type: 'string', required: true }],
    ...overrides,
  };
}

/** A test capability that echoes its input and records progress. */
export class EchoCapability extends BaseCapability {
  constructor(descriptor: CapabilityDescriptor = makeTestDescriptor()) {
    super(descriptor);
  }

  protected async run(context: CapabilityContextContract): Promise<Json> {
    context.reportProgress(50, 'halfway');
    context.reportProgress(100, 'done');
    return { echo: (context.input as { value: Json }).value };
  }
}
