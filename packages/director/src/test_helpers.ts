import type { Envelope, EventBusContract, EventHandler } from '@gamedev-agent/events';
import type { Clock, IdGenerator } from '@gamedev-agent/events';
import type {
  AgentRequirement,
  DecisionEntry,
  Dependency,
  ExecutionOrder,
  Goal,
  Milestone,
  MissionRequest,
  StrategyBlueprint,
} from './DirectorTypes';

export class FixedClock implements Clock {
  constructor(private nowValue = 1_700_000_000_000) {}
  now(): number {
    return this.nowValue;
  }
  set(value: number): void {
    this.nowValue = value;
  }
}

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

  emitted<T>(type: string): Array<T> {
    return this.recorded.filter((r) => r.type === type).map((r) => r.payload as T);
  }

  get types(): ReadonlyArray<string> {
    return this.recorded.map((r) => r.type);
  }

  get publishCount(): number {
    return this.recorded.length;
  }
}

export function makeMissionRequest(overrides: Partial<MissionRequest> = {}): MissionRequest {
  return {
    title: 'Build the boss fight',
    description: 'Design and implement the final boss encounter.',
    ...overrides,
  };
}

export function makeBlueprint(overrides: Partial<StrategyBlueprint> = {}): StrategyBlueprint {
  const milestone: Milestone = {
    id: 'ms-1',
    title: 'Design boss mechanics',
    description: 'Design the boss attack patterns and phases',
    requiredCapabilities: ['gameplay-engineering'],
    dependsOn: [],
  };
  const agent: AgentRequirement = {
    role: 'gameplay-engineer',
    capabilities: ['gameplay-engineering'],
    count: 1,
  };
  const dep: Dependency = {
    from: 'ms-1',
    to: 'ms-2',
    type: 'requires',
  };
  const order: ExecutionOrder = {
    steps: [{ milestoneId: 'ms-1', agentRole: 'gameplay-engineer', order: 1 }],
  };
  const decision: DecisionEntry = {
    id: 'dec-1',
    timestamp: 1000 as never,
    type: 'milestone',
    description: 'Chosen milestone breakdown',
    rationale: 'Standard gameplay development workflow',
  };
  return {
    milestones: [milestone],
    agents: [agent],
    dependencies: [dep],
    order,
    decisionLog: [decision],
    confidence: 0.85,
    ...overrides,
  };
}

/**
 * A test director implementation that always handles any goal and returns
 * a deterministic blueprint.
 */
export class TestDirectorImpl {
  readonly name = 'test-director';
  readonly description = 'A test director for unit tests';

  canHandle(_goal: Goal): boolean {
    return true;
  }

  formulate(_goal: Goal): StrategyBlueprint {
    return makeBlueprint();
  }
}

/**
 * A selective director that only handles goals with specific text in the title.
 */
export class SelectiveDirectorImpl {
  readonly name = 'selective-director';
  readonly description = 'Only handles goals mentioning "art"';

  canHandle(goal: Goal): boolean {
    return goal.title.toLowerCase().includes('art');
  }

  formulate(_goal: Goal): StrategyBlueprint {
    return makeBlueprint({ confidence: 0.95 });
  }
}
