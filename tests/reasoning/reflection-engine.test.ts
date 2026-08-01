import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RETRY_POLICY } from '@gamedev-agent/ami';
import { ReflectionEngine } from '@gamedev-agent/ami';
import type { IRetryStrategyResolver } from '@gamedev-agent/ami';
import type { IMissionMemoryStore, MemoryQuery, MemoryRecord } from '@gamedev-agent/ami';
import type { GoalNode, ReasoningContext, VerificationResult } from '@gamedev-agent/ami';

function node(overrides?: Partial<GoalNode>): GoalNode {
  return {
    id: 'g1',
    missionId: 'm1',
    parentId: null,
    description: 'Create the weapon script',
    status: 'pending',
    acceptanceCriteria: [],
    dependencies: [],
    estimatedComplexity: 2,
    attempts: 0,
    highImpact: false,
    ...overrides,
  };
}

function context(nodeOverride?: Partial<GoalNode>, projectContextOverride?: Partial<ReasoningContext['projectContext']>): ReasoningContext {
  return {
    missionId: 'm1',
    node: node(nodeOverride),
    memorySummary: '',
    priorFailures: [],
    projectContext: { projectId: 'p1', ...projectContextOverride },
  };
}

function verification(status: VerificationResult['status']): VerificationResult {
  return {
    id: 'v1',
    observationId: 'o1',
    status,
    evidence: {},
    strategyResults: status === 'passed' || status === 'partial' ? [{ strategyKind: 'file-state', passed: true, detail: 'x' }] : [],
  };
}

const noopMemory: IMissionMemoryStore = {
  write: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  summarize: vi.fn().mockResolvedValue(''),
};

const defaultResolver: IRetryStrategyResolver = {
  resolve: vi.fn().mockReturnValue(DEFAULT_RETRY_POLICY),
};

describe('ReflectionEngine — decision matrix', () => {
  it('passed → success-pattern memory + continue_to_next_goal when more goals remain', async () => {
    const memory: IMissionMemoryStore = {
      write: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      summarize: vi.fn().mockResolvedValue(''),
    };
    const engine = new ReflectionEngine(defaultResolver, memory);
    const { decision, memoryRecord } = await engine.reflect(
      { ...context(), projectContext: { remainingReadyGoals: 2 } },
      verification('passed'),
    );
    expect(decision).toEqual({ type: 'continue_to_next_goal' });
    expect(memoryRecord?.kind).toBe('success-pattern');
    expect(memory.write).toHaveBeenCalledTimes(1);
  });

  it('passed on the last ready goal → complete_mission', async () => {
    const engine = new ReflectionEngine(defaultResolver, new InMemoryStore());
    const { decision } = await engine.reflect(
      { ...context(), projectContext: { remainingReadyGoals: 1 } },
      verification('passed'),
    );
    expect(decision).toEqual({ type: 'complete_mission' });
  });

  it('passed with no remainingReadyGoals signal → continue_to_next_goal (never guesses complete)', async () => {
    const engine = new ReflectionEngine(defaultResolver, new InMemoryStore());
    const { decision } = await engine.reflect(context(), verification('passed'));
    expect(decision.type).toBe('continue_to_next_goal');
  });

  it('inconclusive → escalate_to_human and writes nothing', async () => {
    const memory: IMissionMemoryStore = {
      write: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      summarize: vi.fn().mockResolvedValue(''),
    };
    const engine = new ReflectionEngine(defaultResolver, memory);
    const { decision, memoryRecord } = await engine.reflect(context(), verification('inconclusive'));
    expect(decision.type).toBe('escalate_to_human');
    expect(memoryRecord).toBeNull();
    expect(memory.write).not.toHaveBeenCalled();
  });

  it('first failure → retry (no alternation on attempt 1)', async () => {
    const engine = new ReflectionEngine(defaultResolver, new InMemoryStore());
    const { decision } = await engine.reflect(context(), verification('failed'));
    expect(decision).toEqual({ type: 'retry' });
  });

  it('second failure → retry_alternate_tool (alternate allowed, attempt > 1)', async () => {
    const engine = new ReflectionEngine(defaultResolver, new InMemoryStore());
    const { decision } = await engine.reflect(
      context({ attempts: 1 }),
      verification('failed'),
    );
    expect(decision).toEqual({ type: 'retry_alternate_tool' });
  });

  it('failure with alternateToolAllowed=false → plain retry on later attempts', async () => {
    const resolver: IRetryStrategyResolver = {
      resolve: () => ({ ...DEFAULT_RETRY_POLICY, alternateToolAllowed: false }),
    };
    const engine = new ReflectionEngine(resolver, new InMemoryStore());
    const { decision } = await engine.reflect(
      context({ attempts: 1 }),
      verification('failed'),
    );
    expect(decision).toEqual({ type: 'retry' });
  });

  it('failure after retries exhausted → replan_subgoal', async () => {
    const engine = new ReflectionEngine(defaultResolver, new InMemoryStore());
    const { decision } = await engine.reflect(
      context({ attempts: 2 }),
      verification('failed'),
    );
    expect(decision.type).toBe('replan_subgoal');
  });

  it('failure when a replan is already in progress → escalate_to_human', async () => {
    const engine = new ReflectionEngine(defaultResolver, new InMemoryStore());
    const { decision } = await engine.reflect(
      context({ attempts: 3, status: 'replan' }),
      verification('failed'),
    );
    expect(decision.type).toBe('escalate_to_human');
  });

  it('partial → retry, and the failure record is tagged [partial]', async () => {
    const store = new InMemoryStore();
    const engine = new ReflectionEngine(defaultResolver, store);
    const { decision, memoryRecord } = await engine.reflect(
      context(),
      verification('partial'),
    );
    expect(decision).toEqual({ type: 'retry' });
    expect(memoryRecord?.content).toContain('[partial]');
    expect(memoryRecord?.kind).toBe('failure');
  });

  it('failed → failure memory record carries capability evidence', async () => {
    const store = new InMemoryStore();
    const engine = new ReflectionEngine(defaultResolver, store);
    await engine.reflect(
      { ...context(), priorFailures: [{ kind: 'failure', message: 'boom', capabilityId: 'files.write', attempt: 1 }] },
      verification('failed'),
    );
    const records = await store.query({});
    expect(records[0]?.kind).toBe('failure');
    expect(records[0]?.evidence?.capabilityId).toBe('files.write');
  });

  it('writes memory records with mission-scoped metadata', async () => {
    const store = new InMemoryStore();
    const engine = new ReflectionEngine(defaultResolver, store);
    const { memoryRecord } = await engine.reflect(context(), verification('passed'));
    expect(memoryRecord).toMatchObject({
      missionId: 'm1',
      projectId: 'p1',
      scope: 'mission',
      goalNodeId: 'g1',
    });
    expect(typeof memoryRecord?.createdAt).toBe('string');
  });

  it('memory failures accumulate (write called per reflect)', async () => {
    const store = new InMemoryStore();
    const engine = new ReflectionEngine(defaultResolver, store);
    await engine.reflect(context(), verification('failed'));
    await engine.reflect(context({ attempts: 1 }), verification('failed'));
    const records = await store.query({ kind: 'failure' });
    expect(records.length).toBe(2);
  });

  it('resolve() is consulted for the capability kind being retried', async () => {
    const resolver: IRetryStrategyResolver = {
      resolve: vi.fn().mockReturnValue({ ...DEFAULT_RETRY_POLICY, maxAttempts: 5 }),
    };
    const engine = new ReflectionEngine(resolver, new InMemoryStore());
    await engine.reflect(
      { ...context(), priorFailures: [{ kind: 'failure', message: 'x', capabilityId: 'files.write', attempt: 1 }] },
      verification('failed'),
    );
    expect(resolver.resolve).toHaveBeenCalledWith('files.write');
  });
});

/** Tiny concrete store so tests assert real persistence, not the mock. */
class InMemoryStore implements IMissionMemoryStore {
  private readonly records: MemoryRecord[] = [];
  write(record: MemoryRecord): Promise<void> {
    this.records.push(record);
    return Promise.resolve();
  }
  async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    return this.records.filter((r) => {
      if (query.missionId !== undefined && r.missionId !== query.missionId) return false;
      if (query.kind !== undefined && r.kind !== query.kind) return false;
      return true;
    });
  }
  summarize(_missionId: string): Promise<string> {
    return Promise.resolve('');
  }
}
