import { describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from '@gamedev-agent/events';
import {
  DEFAULT_RETRY_POLICY,
  MissionStateMachine,
  NoCapabilityFoundError,
  ProgressEstimator,
  ReasoningEventEmitter,
  ReasoningLoop,
} from '@gamedev-agent/ami';
import type {
  Decision,
  GoalNode,
  GoalTree,
  IApprovalGate,
  IGoalDecomposer,
  IMissionMemoryStore,
  IObservationCollector,
  IReasoningEngine,
  IReflectionEngine,
  IRetryStrategyResolver,
  IToolSelector,
  IVerificationEngine,
  MissionGoal,
} from '@gamedev-agent/ami';
import type { StepExecutor } from '@gamedev-agent/workflow';

const MISSION: MissionGoal = {
  id: 'p1',
  missionId: 'm1',
  description: 'Ship the feature',
  acceptanceCriteria: [],
  priority: 5,
};

function goalTree(goalCount: number): GoalTree {
  const nodes = new Map<string, GoalNode>();
  nodes.set('root', {
    id: 'root',
    missionId: 'm1',
    parentId: null,
    description: 'root',
    status: 'pending',
    acceptanceCriteria: [],
    dependencies: [],
    estimatedComplexity: 0,
    attempts: 0,
    highImpact: false,
  });
  for (let i = 0; i < goalCount; i++) {
    nodes.set(`g${i}`, {
      id: `g${i}`,
      missionId: 'm1',
      parentId: 'root',
      description: `goal ${i}`,
      status: 'pending',
      acceptanceCriteria: [],
      dependencies: ['root'],
      estimatedComplexity: 1,
      attempts: 0,
      highImpact: false,
    });
  }
  return { missionId: 'm1', rootId: 'root', nodes };
}

function fakeDecomposer(tree: GoalTree): IGoalDecomposer {
  return { decompose: vi.fn().mockResolvedValue(tree) };
}

function fakeReasoning(): IReasoningEngine {
  return {
    think: vi.fn().mockImplementation(async (ctx: { node: GoalNode }) => ({
      id: `t-${ctx.node.id}`,
      reasoning: `think ${ctx.node.id}`,
      candidateActions: ['write'],
      confidence: 0.9,
    })),
    plan: vi.fn().mockImplementation(async (thought: { reasoning: string }, node: GoalNode) => ({
      id: `plan-${node.id}`,
      goalNodeId: node.id,
      description: thought.reasoning,
      requiredCapabilityKind: 'write-files',
      params: {},
      highImpact: node.highImpact,
    })),
  };
}

function fakeToolSelector(): IToolSelector {
  return {
    select: vi.fn().mockImplementation(async (plan: { id: string }) => ({
      stepPlanId: plan.id,
      capabilityId: 'files.write',
      toolName: 'nova.tool.filesystem',
      params: {},
      excludedCapabilityIds: [],
    })),
  };
}

function fakeCollector(): IObservationCollector {
  return {
    attach: () => ({ dispose: vi.fn() }),
    collect: () => null,
    latest: () => null,
  };
}

function fakeApproval(requires = false): IApprovalGate {
  return {
    requiresApproval: vi.fn().mockReturnValue(requires),
    requestApproval: vi.fn().mockResolvedValue({ requestId: 'r', decision: 'approved' as const, respondedBy: 'test' }),
  };
}

function fakeVerification(): IVerificationEngine {
  return {
    registerStrategy: vi.fn(),
    verify: vi.fn().mockResolvedValue({
      id: 'v',
      observationId: 'o',
      status: 'passed',
      evidence: {},
      strategyResults: [],
    }),
  };
}

function fakeReflection(sequence: Decision[]): IReflectionEngine {
  const queue = [...sequence];
  return {
    reflect: vi.fn().mockImplementation(async () => ({
      decision: queue.shift() ?? { type: 'continue_to_next_goal' },
      memoryRecord: null,
    })),
  };
}

function fakeMemory(): IMissionMemoryStore {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
    summarize: vi.fn().mockResolvedValue(''),
  };
}

function fakeExecutor(impl?: typeof vi.fn): StepExecutor {
  return { execute: impl ?? vi.fn().mockResolvedValue({ ok: true }) } as unknown as StepExecutor;
}

function buildLoop(opts: {
  tree?: GoalTree;
  decomposer?: IGoalDecomposer;
  reasoning?: IReasoningEngine;
  toolSelector?: IToolSelector;
  approval?: IApprovalGate;
  verification?: IVerificationEngine;
  reflection?: IReflectionEngine;
  executor?: StepExecutor;
  wait?: (ms: number) => Promise<void>;
}) {
  const bus = new InMemoryEventBus('test');
  const options = {
    stateMachine: new MissionStateMachine(),
    decomposer: opts.decomposer ?? fakeDecomposer(opts.tree ?? goalTree(1)),
    memory: fakeMemory(),
    reasoning: opts.reasoning ?? fakeReasoning(),
    toolSelector: opts.toolSelector ?? fakeToolSelector(),
    approval: opts.approval ?? fakeApproval(),
    verification: opts.verification ?? fakeVerification(),
    collector: fakeCollector(),
    reflection: opts.reflection ?? fakeReflection([{ type: 'complete_mission' }]),
    retryResolver: { resolve: () => ({ ...DEFAULT_RETRY_POLICY, backoffMs: 0 }) } as IRetryStrategyResolver,
    progress: new ProgressEstimator(),
    emitter: new ReasoningEventEmitter(bus),
    executor: opts.executor ?? fakeExecutor(),
    ...(opts.wait !== undefined ? { wait: opts.wait } : {}),
  };
  return { loop: new ReasoningLoop(options), bus };
}

describe('ReasoningLoop — integration', () => {
  it('completes a 3-goal mission when every goal verifies (continue → isComplete)', async () => {
    const executor = fakeExecutor();
    const reflection = fakeReflection([
      { type: 'continue_to_next_goal' },
      { type: 'continue_to_next_goal' },
      { type: 'continue_to_next_goal' },
    ]);
    const { loop } = buildLoop({ tree: goalTree(3), reflection, executor });
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('completed');
    expect(executor.execute).toHaveBeenCalledTimes(3);
    expect(outcome.decisions.map((d) => d.type)).toEqual([
      'continue_to_next_goal',
      'continue_to_next_goal',
      'continue_to_next_goal',
    ]);
  });

  it('completes a single-goal mission via the complete_mission decision', async () => {
    const { loop, bus } = buildLoop({ tree: goalTree(1) });
    const states: string[] = [];
    bus.subscribe(
      { type: 'mission.reasoning.state.changed', version: 1 },
      (e) => states.push((e.payload as { currentState: string }).currentState),
    );
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('completed');
    expect(states).toContain('completed');
  });

  it('routes through the approval gate and continues when approved', async () => {
    let gated = true;
    const approval = fakeApproval();
    (approval.requiresApproval as ReturnType<typeof vi.fn>).mockImplementation(() => {
      if (gated) {
        gated = false;
        return true;
      }
      return false;
    });
    const { loop, bus } = buildLoop({ tree: goalTree(1), approval });
    const requested: unknown[] = [];
    const resolved: unknown[] = [];
    bus.subscribe({ type: 'mission.reasoning.approval.requested', version: 1 }, (e) => requested.push(e.payload));
    bus.subscribe({ type: 'mission.reasoning.approval.resolved', version: 1 }, (e) => resolved.push(e.payload));
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('completed');
    expect(requested.length).toBe(1);
    expect(resolved.length).toBe(1);
    expect((requested[0] as { request: { stepPlan: { id: string } } }).request.stepPlan.id).toContain('plan-');
  });

  it('fails the mission when approval is rejected', async () => {
    const approval = fakeApproval();
    (approval.requiresApproval as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (approval.requestApproval as ReturnType<typeof vi.fn>).mockResolvedValue({
      requestId: 'r',
      decision: 'rejected',
      respondedBy: 'test',
    });
    const { loop } = buildLoop({ tree: goalTree(1), approval });
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('failed');
    expect(outcome.decisions.at(-1)?.type).toBe('escalate_to_human');
  });

  it('retries once after a failed execution, then continues and completes', async () => {
    let executions = 0;
    const executor = fakeExecutor(
      vi.fn().mockImplementation(async () => {
        executions++;
        return executions === 1 ? { ok: false, error: 'transient' } : { ok: true };
      }),
    );
    const reflection = fakeReflection([
      { type: 'retry' },
      { type: 'continue_to_next_goal' },
    ]);
    const { loop } = buildLoop({ tree: goalTree(1), reflection, executor });
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('completed');
    expect(executor.execute).toHaveBeenCalledTimes(2);
    expect(outcome.decisions.map((d) => d.type)).toEqual(['retry', 'continue_to_next_goal']);
  });

  it('escalates when retries are exhausted', async () => {
    const reflection = fakeReflection([
      { type: 'retry' },
      { type: 'retry' },
      { type: 'escalate_to_human', reason: 'exhausted' },
    ]);
    const { loop } = buildLoop({ tree: goalTree(1), reflection });
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('failed');
    expect(outcome.decisions.filter((d) => d.type === 'retry').length).toBe(2);
    expect(outcome.decisions.at(-1)?.type).toBe('escalate_to_human');
    expect(outcome.reason).toBe('exhausted');
  });

  it('replans a goal (re-thinks) after replan_subgoal, then completes', async () => {
    const reasoning = fakeReasoning();
    const reflection = fakeReflection([
      { type: 'replan_subgoal', reason: 'stale plan' },
      { type: 'continue_to_next_goal' },
    ]);
    const { loop } = buildLoop({ tree: goalTree(1), reflection, reasoning });
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('completed');
    expect(reasoning.think).toHaveBeenCalledTimes(2);
    expect(outcome.decisions.map((d) => d.type)).toEqual(['replan_subgoal', 'continue_to_next_goal']);
  });

  it('fails the mission when no capability resolves', async () => {
    const toolSelector = fakeToolSelector();
    (toolSelector.select as ReturnType<typeof vi.fn>).mockRejectedValue(
      new NoCapabilityFoundError('write-files'),
    );
    const { loop } = buildLoop({ tree: goalTree(1), toolSelector });
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('failed');
    expect(outcome.reason).toContain('no capability found');
  });

  it('marks the goal blocked and reports failure on escalate', async () => {
    const reflection = fakeReflection([{ type: 'escalate_to_human', reason: 'manual review needed' }]);
    const { loop } = buildLoop({ tree: goalTree(1), reflection });
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('failed');
    expect(outcome.goalTree?.nodes.get('g0')?.status).toBe('blocked');
  });

  it('honors cancel() and returns a canceled outcome', async () => {
    let loopRef: ReasoningLoop | undefined;
    const executor = fakeExecutor(
      vi.fn().mockImplementation(async () => {
        loopRef?.cancel();
        return { ok: true };
      }),
    );
    const { loop } = buildLoop({
      tree: goalTree(3),
      reflection: fakeReflection([{ type: 'continue_to_next_goal' }]),
      executor,
    });
    loopRef = loop;
    const outcome = await loop.run(MISSION);
    expect(outcome.state).toBe('canceled');
  });
});
