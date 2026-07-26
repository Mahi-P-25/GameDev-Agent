import type { Envelope, EventBusContract, EventHandler } from '@gamedev-agent/events';
import type { Clock, IdGenerator } from '@gamedev-agent/events';
import type {
  CapabilityEstimate,
  Dependency,
  GoalAnalysis,
  GoalId,
  Milestone,
  MissionProposal,
  ProposalId,
  ProposedMission,
  ProposedMissionId,
  RoleEstimate,
} from '@gamedev-agent/producer';
import type { ProjectId } from '@gamedev-agent/project';

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
 * An in-memory EventBus double implementing only the surface the Planner uses
 * ({@link publish}/{@link subscribe}/{@link once}/{@link unsubscribe}). Records
 * every published envelope so assertions can inspect emitted events precisely,
 * keeping tests framework-free and fast — the same double other packages use.
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

/** Default role estimate used by node builders. */
function defaultRole(role = 'gameplay-engineer'): RoleEstimate {
  return { role, capabilities: [], rationale: 'estimated' };
}

/** Default capability estimate used by node builders. */
function defaultCapability(capability = 'vehicle-physics'): CapabilityEstimate {
  return { capability, confidence: 0.8 };
}

export interface NodeOverride {
  readonly id: string;
  readonly title?: string;
  readonly brief?: string;
  readonly priority?: 'low' | 'medium' | 'high' | 'critical';
  readonly complexity?: 'trivial' | 'small' | 'moderate' | 'large' | 'epic';
  readonly order?: number;
  readonly objectiveId?: string | null;
  readonly milestoneId?: string | null;
  readonly parentId?: string | null;
  readonly requiredRoles?: ReadonlyArray<RoleEstimate>;
  readonly requiredCapabilities?: ReadonlyArray<CapabilityEstimate>;
}

/** Build a single {@link ProposedMission} with sensible defaults. */
export function makeNode(override: NodeOverride): ProposedMission {
  return {
    id: override.id as ProposedMissionId,
    parentId: override.parentId !== undefined ? (override.parentId as ProposedMissionId) : null,
    title: override.title ?? `Mission ${override.id}`,
    brief: override.brief ?? `Brief for ${override.id}`,
    priority: override.priority ?? 'medium',
    complexity: override.complexity ?? 'moderate',
    order: override.order ?? 0,
    objectiveId: override.objectiveId !== undefined ? (override.objectiveId as never) : null,
    milestoneId: override.milestoneId !== undefined ? (override.milestoneId as never) : null,
    requiredRoles: override.requiredRoles ?? [defaultRole()],
    requiredCapabilities: override.requiredCapabilities ?? [defaultCapability()],
  };
}

export interface ProposalOverride {
  readonly id?: string;
  readonly goalId?: string;
  readonly projectId?: string;
  readonly nodes?: ReadonlyArray<ProposedMission>;
  readonly dependencies?: ReadonlyArray<Dependency>;
  readonly milestones?: ReadonlyArray<Milestone>;
}

/**
 * Build a valid {@link MissionProposal} with two independent nodes and no
 * dependencies unless overriden. Useful as the happy-path fixture for planning.
 */
export function makeMissionProposal(override: ProposalOverride = {}): MissionProposal {
  const nodes = override.nodes ?? [
    makeNode({ id: 'a', order: 0, milestoneId: 'm1', objectiveId: 'o1' }),
    makeNode({ id: 'b', order: 1, milestoneId: 'm1', objectiveId: 'o1' }),
  ];
  const milestones = override.milestones ?? [
    {
      id: 'm1' as never,
      title: 'Foundation',
      description: 'Foundational work.',
      order: 0,
      objectiveIds: ['o1' as never],
    },
  ];
  const executionOrder = nodes.map((n) => n.id);
  const ts = 1_700_000_000_000 as never;
  return {
    id: (override.id ?? 'prop-1') as ProposalId,
    goalId: (override.goalId ?? 'goal-1') as GoalId,
    projectId: (override.projectId ?? 'project-1') as ProjectId,
    analysis: {
      goalId: (override.goalId ?? 'goal-1') as GoalId,
      objectives: [],
      milestones,
      requiredRoles: [],
      estimatedCapabilities: [],
      summary: 'analysis',
      analysedAt: ts,
    } as GoalAnalysis,
    missionTree: {
      goalId: (override.goalId ?? 'goal-1') as GoalId,
      nodes,
      rootIds: nodes.map((n) => n.id),
      dependencies: override.dependencies ?? [],
      executionOrder,
      generatedAt: ts,
    },
    approvalPackage: {
      goalId: (override.goalId ?? 'goal-1') as GoalId,
      proposalId: (override.id ?? 'prop-1') as ProposalId,
      title: 'Proposal',
      summary: 'summary',
      missionCount: nodes.length,
      milestoneCount: milestones.length,
      objectiveCount: 0,
      requiredRoles: [],
      estimatedCapabilities: [],
      estimatedComplexity: 'moderate',
      preparedAt: ts,
    },
    createdAt: ts,
  };
}
