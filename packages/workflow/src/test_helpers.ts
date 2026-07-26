import type { Envelope, EventBusContract, EventHandler } from '@gamedev-agent/events';
import type { Clock, IdGenerator } from '@gamedev-agent/events';
import type {
  WorkflowDefinition,
  WorkflowExecutionMode,
  WorkflowStep,
  WorkflowStepId,
} from './WorkflowDefinition';

/** A fixed clock for deterministic timestamps in tests. */
export class FixedClock implements Clock {
  constructor(private nowValue = 1_700_000_000_000) {}
  now(): number {
    return this.nowValue;
  }
  set(value: number): void {
    this.nowValue = value;
  }
}

/** A deterministic id generator producing `id-1`, `id-2`, ... in call order. */
export class SequenceIdGenerator implements IdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

interface Recorded {
  readonly type: string;
  readonly payload: unknown;
}

/**
 * An in-memory EventBus double implementing only the surface the Workflow Engine
 * uses. Records every published envelope so assertions can inspect emitted
 * events precisely, keeping tests framework-free and fast.
 */
export class FakeEventBus implements EventBusContract {
  private readonly handlers = new Map<string, Array<EventHandler<unknown>>>();
  private readonly recorded: Array<Recorded> = [];

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

  /** Test helper: count of all published events. */
  get publishCount(): number {
    return this.recorded.length;
  }
}

const step = (id: string, dependsOn: ReadonlyArray<string> = []): WorkflowStep => ({
  id: id as WorkflowStepId,
  title: `Step ${id}`,
  description: `Description for ${id}`,
  dependsOn: dependsOn.map((d) => d as WorkflowStepId),
});
export { step };

/** Build a linear workflow definition (a → b → c). */
export function linearDefinition(
  id = 'wf-linear',
  mode: WorkflowExecutionMode = 'sequential',
): WorkflowDefinition {
  return {
    id: id as WorkflowDefinition['id'],
    name: 'Linear Workflow',
    description: 'A → B → C',
    version: '1.0.0',
    mode,
    failFast: true,
    steps: [step('a'), step('b', ['a']), step('c', ['b'])],
  };
}

/** Build a diamond workflow (a → {b,c} → d). */
export function diamondDefinition(id = 'wf-diamond'): WorkflowDefinition {
  return {
    id: id as WorkflowDefinition['id'],
    name: 'Diamond Workflow',
    description: 'a fans out to b and c, both feed d',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [step('a'), step('b', ['a']), step('c', ['a']), step('d', ['b', 'c'])],
  };
}

/** Build a cyclic definition (invalid for planning). */
export function cyclicDefinition(id = 'wf-cycle'): WorkflowDefinition {
  return {
    id: id as WorkflowDefinition['id'],
    name: 'Cyclic Workflow',
    description: 'should fail validation',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [step('a', ['b']), step('b', ['a'])],
  };
}

/** A step executor double that succeeds or fails per configured step id. */
export class FakeExecutor {
  /** Step ids that should fail (first attempt). */
  public failing = new Set<string>();
  public attempts = new Map<string, number>();

  async execute(s: WorkflowStep): Promise<{ ok: boolean; error?: string }> {
    const count = (this.attempts.get(s.id) ?? 0) + 1;
    this.attempts.set(s.id, count);
    if (this.failing.has(s.id)) {
      return { ok: false, error: `forced failure for ${s.id}` };
    }
    return { ok: true };
  }
}
