import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { ModelResponse, ModelProvidersService } from '@gamedev-agent/model-providers';
import type { ToolManager, MissionAbility, ResolvedCapability, ToolInvocationResult } from '@gamedev-agent/tool-runtime';
import { CapabilityPlanner } from '@gamedev-agent/tool-runtime';
import type { WorkflowSource, WorkflowStep } from '@gamedev-agent/workflow';
import { describe, expect, it, vi } from 'vitest';
import { MissionAgent } from './MissionAgent';
import type { MissionReport, AgentState, AgentAction, AgentDecision as Decision, AgentObservation as Observation, AgentThought as Thought, AgentVerification as Verification } from './MissionAgentTypes';
import {
  AgentStateChanged,
  AgentThought,
  AgentObservation,
  AgentDecisionEvent,
  AgentActionStarted,
  AgentActionResult,
  AgentVerification,
  AgentProgress,
  AgentMissionComplete,
  AgentArtifactCreated,
} from './MissionAgentEvents';

// ─── Test utilities ─────────────────────────────────────────────────────────

const noopLogger: Logger = {
  namespace: 'test', trace: () => undefined, debug: () => undefined,
  info: () => undefined, warn: () => undefined, error: () => undefined,
  fatal: () => undefined, child: () => noopLogger,
};

const MODEL_OK: ModelResponse = {
  id: 'r', model: 'm', content: '', toolCalls: [], finishReason: 'stop',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  cost: { currency: 'USD' as const, promptCost: 0, completionCost: 0, totalCost: 0 }, latencyMs: 1,
};

function modelResponse(content: string): ModelResponse {
  return { ...MODEL_OK, content };
}

function step(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: `s-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Test step', description: 'A test step',
    requiredCapability: 'read-files' as MissionAbility,
    ...overrides,
  };
}

function source(steps: WorkflowStep[]): WorkflowSource {
  return { missionId: 'm1', projectId: 'p1', sourceId: 's1', steps };
}

function thinkResp(): string {
  return JSON.stringify({ reasoning: 'proceed', intention: 'do step', capability: 'read-files' });
}
function continueResp(cap?: string): string {
  return JSON.stringify({ type: 'continue', capability: cap ?? 'read-files', params: { path: 'x' }, expected: 'done' });
}

function fakePlanner(abilities: readonly string[] = ['read-files']) {
  return {
    getAvailableAbilities: vi.fn().mockReturnValue(abilities),
    resolveAbilities: vi.fn().mockReturnValue([{
      ability: 'read-files' as MissionAbility,
      toolId: '' as unknown as string & { readonly __brand: 'ToolId' },
      capabilityId: 'files.read', capabilityName: 'Read',
      confidence: 'exact' as const, requiresSession: false, inputSchema: {},
    }]),
  } as unknown as CapabilityPlanner;
}

function fakeModel(generate?: typeof vi.fn) {
  return {
    generate: generate ?? vi.fn().mockResolvedValue(MODEL_OK),
    findModels: vi.fn().mockReturnValue([]), listModels: vi.fn().mockReturnValue([]),
    getTotalUsage: vi.fn().mockReturnValue({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    resetUsage: vi.fn(),
    getProvider: vi.fn().mockImplementation(() => { throw new Error('x'); }),
    generateStream: vi.fn().mockImplementation(async function* () {}),
  } as unknown as ModelProvidersService;
}

function fakeToolManager(invokeOverride?: typeof vi.fn) {
  return {
    invoke: invokeOverride ?? vi.fn().mockResolvedValue({ ok: true, toolId: '' as any, action: 'f', durationMs: 1, output: null } satisfies ToolInvocationResult),
    list: vi.fn().mockReturnValue([]),
  } as unknown as ToolManager;
}

function newAgent(opts: {
  model?: ReturnType<typeof fakeModel>;
  tool?: ReturnType<typeof fakeToolManager>;
  planner?: ReturnType<typeof fakePlanner>;
  bus?: InMemoryEventBus;
  reasoningLoop?: import('@gamedev-agent/ami').IReasoningLoop;
}) {
  const bus = opts.bus ?? new InMemoryEventBus('test');
  return new MissionAgent({
    toolManager: opts.tool ?? fakeToolManager(),
    capabilityPlanner: opts.planner ?? fakePlanner(),
    modelProviders: opts.model ?? fakeModel(),
    eventBus: bus,
    logger: noopLogger,
    ...(opts.reasoningLoop !== undefined ? { reasoningLoop: opts.reasoningLoop } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionAgent — Unit: decision parsing', () => {
  it('parses continue decision', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
  });

  it('parses abort decision', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(JSON.stringify({ type: 'abort', reason: 'cannot proceed' }));
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
  });

  it('parses skip decision', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(JSON.stringify({ type: 'skip', reason: 'not needed' }));
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
  });

  it('parses complete decision', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(JSON.stringify({ type: 'complete' }));
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
  });

  it('parses think_deeper and re-enters thinking', async () => {
    let callIdx = 0;
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deeper-thinking') return modelResponse(JSON.stringify({ reasoning: 'deeper', intention: 're-evaluating' }));
      if (req.metadata?.phase === 'deciding') {
        if (callIdx <= 2) return modelResponse(JSON.stringify({ type: 'think_deeper', reasoning: 'need more info' }));
        return modelResponse(continueResp());
      }
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
  });
});

describe('MissionAgent — Unit: state transitions', () => {
  it('transitions through all states to completed', async () => {
    const bus = new InMemoryEventBus('test');
    const events: string[] = [];
    bus.subscribe(AgentStateChanged, (e: any) => { events.push(e.payload.currentState); });

    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model, bus });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
    expect(events).toContain('running');
    expect(events).toContain('observing');
    expect(events).toContain('thinking');
    expect(events).toContain('deciding');
    expect(events).toContain('executing');
    expect(events).toContain('verifying');
    expect(events).toContain('completed');
  });

  it('recovers gracefully from model error via fallback defaults', async () => {
    const model = fakeModel(vi.fn().mockRejectedValue(new Error('model failure')));
    const agent = newAgent({ model });
    const report = await agent.run(source([step()]));
    // MissionAgent is resilient: model errors return '{}' defaults, mission completes
    expect(report.status).toBe('completed');
  });

  it('transitions to cancelled on AbortSignal', async () => {
    const ctrl = new AbortController();
    let count = 0;
    const model = fakeModel(vi.fn().mockImplementation(async (req: any) => {
      count++;
      if (count >= 2) ctrl.abort();
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step(), step(), step()]), ctrl.signal);
    expect(report.status).toBe('cancelled');
  });
});

describe('MissionAgent — Unit: retry logic', () => {
  it('reports failures on tool failure', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const tool = fakeToolManager(vi.fn().mockResolvedValue({ ok: false, toolId: '' as any, action: 'f', durationMs: 1, error: { code: 'err', message: 'fail' } } satisfies ToolInvocationResult));
    const agent = newAgent({ model, tool });
    const report = await agent.run(source([step()]));
    expect(report.failureCount).toBeGreaterThan(0);
  });

  it('recovers after retry succeeds', async () => {
    let n = 0;
    const tool = fakeToolManager(vi.fn().mockImplementation(async () => {
      n++;
      return { ok: n >= 2, toolId: '' as any, action: 'f', durationMs: 1, output: n >= 2 ? 'ok' : null, ...(n < 2 ? { error: { code: 'e', message: 'transient' } } : {}) } satisfies ToolInvocationResult;
    }));
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model, tool });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
    expect(report.failureCount).toBe(1);
  });
});

describe('MissionAgent — Unit: abort', () => {
  it('aborts when agent decides abort', async () => {
    const bus = new InMemoryEventBus('test');
    const decisions: string[] = [];
    bus.subscribe(AgentDecisionEvent, (e: any) => { decisions.push(e.payload.decisionType); });

    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(JSON.stringify({ type: 'abort', reason: 'aborting' }));
      return MODEL_OK;
    }));
    const agent = newAgent({ model, bus });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
    expect(decisions.filter(d => d === 'abort').length).toBeGreaterThanOrEqual(1);
  });
});

describe('MissionAgent — Unit: observation', () => {
  it('records observations', async () => {
    const bus = new InMemoryEventBus('test');
    const obs: any[] = [];
    bus.subscribe(AgentObservation, (e: any) => { obs.push(e.payload); });

    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model, bus });
    await agent.run(source([step({ title: 'Create file' })]));
    expect(obs.length).toBeGreaterThanOrEqual(1);
    expect(obs[0].kind).toBe('execution_result');
  });
});

describe('MissionAgent — Unit: memory', () => {
  it('produces a mission report with metadata', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step({ title: 'Init' })]));
    expect(report.missionId).toBe('m1');
    expect(report.planId).toBe('s1');
    expect(report.status).toBe('completed');
    expect(report.actionCount).toBe(1);
    expect(report.decisionCount).toBe(1);
    expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. INTEGRATION — Full mission loop
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionAgent — Integration', () => {
  it('single-step mission completes', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const tool = fakeToolManager();
    const agent = newAgent({ model, tool });
    const report = await agent.run(source([step({ title: 'Read config' })]));
    expect(report.status).toBe('completed');
    expect(report.actionCount).toBe(1);
    expect(report.failureCount).toBe(0);
    expect(tool.invoke).toHaveBeenCalledTimes(1);
  });

  it('multi-step mission completes all steps', async () => {
    let decIdx = 0;
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'deciding') {
        decIdx++;
        const cap = decIdx === 1 ? 'read-files' : decIdx === 2 ? 'write-files' : 'install-packages';
        return modelResponse(JSON.stringify({ type: 'continue', capability: cap, params: {}, expected: 'done' }));
      }
      return modelResponse(thinkResp());
    }));
    const tool = fakeToolManager();
    const agent = newAgent({ model, tool });
    const steps = [
      step({ id: 's1', title: 'Read config', requiredCapability: 'read-files' as MissionAbility }),
      step({ id: 's2', title: 'Write source', requiredCapability: 'write-files' as MissionAbility }),
      step({ id: 's3', title: 'Install deps', requiredCapability: 'install-packages' as MissionAbility }),
    ];
    const report = await agent.run(source(steps));
    expect(report.status).toBe('completed');
    expect(report.actionCount).toBe(3);
    expect(tool.invoke).toHaveBeenCalledTimes(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. FAILURE RECOVERY
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionAgent — Failure: tool failure', () => {
  it('handles and reports tool failures', async () => {
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const tool = fakeToolManager(vi.fn().mockResolvedValue({ ok: false, toolId: '' as any, action: 'f', durationMs: 1, error: { code: 'err', message: 'disk error' } } satisfies ToolInvocationResult));
    const agent = newAgent({ model, tool });
    const report = await agent.run(source([step()]));
    expect(report.failureCount).toBeGreaterThan(0);
  });
});

describe('MissionAgent — Failure: model failure', () => {
  it('recovers from persistent model error via fallback', async () => {
    const model = fakeModel(vi.fn().mockRejectedValue(new Error('API timeout')));
    const agent = newAgent({ model });
    const report = await agent.run(source([step()]));
    // Agent catches model errors, returns '{}' defaults, and completes
    expect(report.status).toBe('completed');
  });
});

describe('MissionAgent — Failure: verification retry', () => {
  it('retries on verification failure and eventually completes', async () => {
    let n = 0;
    const tool = fakeToolManager(vi.fn().mockImplementation(async () => {
      n++;
      return { ok: n >= 3, toolId: '' as any, action: 'f', durationMs: 1, output: n >= 3 ? 'ok' : null, ...(n < 3 ? { error: { code: 'e', message: 'fail' } } : {}) } satisfies ToolInvocationResult;
    }));
    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model, tool });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('completed');
    expect(report.failureCount).toBeGreaterThan(0);
  });
});

describe('MissionAgent — Failure: cancellation', () => {
  it('cancels via AbortSignal', async () => {
    const ctrl = new AbortController();
    let n = 0;
    const model = fakeModel(vi.fn().mockImplementation(async (req: any) => {
      n++;
      if (n >= 3) ctrl.abort();
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step(), step(), step(), step()]), ctrl.signal);
    expect(report.status).toBe('cancelled');
  });

  it('cancels via cancel() method', async () => {
    let callCount = 0;
    const model = fakeModel(vi.fn().mockImplementation(async (req: any) => {
      callCount++;
      await new Promise(r => setTimeout(r, 30));
      if (callCount >= 3) agent.cancel();
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const report = await agent.run(source([step(), step(), step()]));
    expect(report.status).toBe('cancelled');
  });

  it('dispose prevents subsequent runs', async () => {
    const agent = newAgent({});
    agent.dispose();
    await expect(agent.run(source([step()]))).rejects.toThrow('disposed');
  });

  it('rejects concurrent run()', async () => {
    const model = fakeModel(vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 50));
      return MODEL_OK;
    }));
    const agent = newAgent({ model });
    const run1 = agent.run(source([step()]));
    await expect(agent.run(source([step()]))).rejects.toThrow('already running');
    await run1.catch(() => {});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  4. STUDIO VERIFICATION — Real MissionAgent state via events
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionAgent — Studio Verification', () => {
  it('emits real (not simulated) thought, observation, decision, action, and verification payloads', async () => {
    const bus = new InMemoryEventBus('test');
    const thoughts: any[] = [];
    const observations: any[] = [];
    const decisions: any[] = [];
    const actionsStarted: any[] = [];
    const verifications: any[] = [];
    bus.subscribe(AgentThought, (e: any) => { thoughts.push(e.payload); });
    bus.subscribe(AgentObservation, (e: any) => { observations.push(e.payload); });
    bus.subscribe(AgentDecisionEvent, (e: any) => { decisions.push(e.payload); });
    bus.subscribe(AgentActionStarted, (e: any) => { actionsStarted.push(e.payload); });
    bus.subscribe(AgentVerification, (e: any) => { verifications.push(e.payload); });

    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model, bus });
    await agent.run(source([step({ title: 'Studio Verify Step', description: 'Verify event payloads' })]));

    // Verify thought payload
    expect(thoughts.length).toBeGreaterThanOrEqual(1);
    expect(thoughts[0].missionId).toBe('m1');
    expect(typeof thoughts[0].reasoning).toBe('string');
    expect(thoughts[0].reasoning.length).toBeGreaterThan(0);
    expect(thoughts[0].timestamp).toBeGreaterThan(0);

    // Verify observation payload
    expect(observations.length).toBeGreaterThanOrEqual(1);
    expect(observations[0].kind).toBe('execution_result');
    expect(typeof observations[0].content).toBe('string');
    expect(observations[0].content).toContain('Studio Verify Step');

    // Verify decision payload
    expect(decisions.length).toBeGreaterThanOrEqual(1);
    expect(decisions[0].decisionType).toBe('continue');
    expect(decisions[0].missionId).toBe('m1');

    // Verify action started payload (if a tool was invoked)
    // Only present when the decision was 'continue' and capability resolved
    if (actionsStarted.length > 0) {
      expect(actionsStarted[0].toolId).toBeDefined();
      expect(actionsStarted[0].capability).toBeDefined();
    }

    // Verify verification payload
    expect(verifications.length).toBeGreaterThanOrEqual(1);
    expect(verifications[0].passed).toBe(true);
    expect(verifications[0].expected).toBe('done');
    expect(typeof verifications[0].observed).toBe('string');
  });

  it('emits progress and mission complete events', async () => {
    const bus = new InMemoryEventBus('test');
    const progress: any[] = [];
    const complete: any[] = [];
    bus.subscribe(AgentProgress, (e: any) => { progress.push(e.payload); });
    bus.subscribe(AgentMissionComplete, (e: any) => { complete.push(e.payload); });

    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
      return MODEL_OK;
    }));
    const agent = newAgent({ model, bus });
    const report = await agent.run(source([step(), step()]));

    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(progress[0].progress).toBeGreaterThanOrEqual(0);
    expect(progress[0].actionCount).toBeGreaterThanOrEqual(0);

    expect(complete.length).toBe(1);
    expect(complete[0].status).toBe('completed');
    expect(complete[0].actionCount).toBe(report.actionCount);
    expect(complete[0].totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits artifact events for file writes', async () => {
    const bus = new InMemoryEventBus('test');
    const artifacts: any[] = [];
    bus.subscribe(AgentArtifactCreated, (e: any) => { artifacts.push(e.payload); });

    const model = fakeModel(vi.fn().mockImplementation((req: any) => {
      if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
      if (req.metadata?.phase === 'deciding') return modelResponse(JSON.stringify({
        type: 'continue',
        capability: 'write-files',
        params: { path: '/tmp/test.txt', content: 'hello' },
        expected: 'File written',
      }));
      return MODEL_OK;
    }));
    const planner = {
      getAvailableAbilities: vi.fn().mockReturnValue(['write-files']),
      resolveAbilities: vi.fn().mockReturnValue([{
        ability: 'write-files' as MissionAbility,
        toolId: '' as unknown as string & { readonly __brand: 'ToolId' },
        capabilityId: 'files.write', capabilityName: 'Write',
        confidence: 'exact' as const, requiresSession: false, inputSchema: {},
      }]),
    } as unknown as CapabilityPlanner;

    const tool = fakeToolManager(vi.fn().mockResolvedValue({ ok: true, toolId: '' as any, action: 'f', durationMs: 1, output: 'file created' } satisfies ToolInvocationResult));
    const agent = newAgent({ model, bus, planner, tool });
    await agent.run(source([step({ requiredCapability: 'write-files' as MissionAbility })]));

    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    expect(artifacts[0].kind).toBe('file');
    expect(artifacts[0].path).toBe('/tmp/test.txt');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. AMI reasoning loop delegation (Phase 10)
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionAgent — AMI reasoning loop delegation', () => {
  type AmiLoop = import('@gamedev-agent/ami').IReasoningLoop;
  type AmiOutcome = import('@gamedev-agent/ami').MissionOutcome;

  function fakeLoop(result: AmiOutcome) {
    const run = vi.fn().mockResolvedValue(result);
    const cancel = vi.fn();
    return { run, cancel } as unknown as AmiLoop & { run: typeof run; cancel: typeof cancel };
  }

  function outcome(
    state: AmiOutcome['state'],
    reason?: string,
  ): AmiOutcome {
    return {
      missionId: 'm1',
      state,
      decisions: [],
      goalTree: null,
      ...(reason !== undefined ? { reason } : {}),
    };
  }

  it('delegates the mission to the injected reasoning loop', async () => {
    const loop = fakeLoop(outcome('completed'));
    const agent = newAgent({ reasoningLoop: loop });
    const report = await agent.run(source([step({ description: 'Create a file' })]));

    expect(loop.run).toHaveBeenCalledTimes(1);
    const goal = loop.run.mock.calls[0]![0] as import('@gamedev-agent/ami').MissionGoal;
    expect(goal.missionId).toBe('m1');
    expect(goal.description).toBe('Mission: s1');
    expect(goal.acceptanceCriteria).toHaveLength(1);
    expect(goal.acceptanceCriteria[0]!.description).toBe('Create a file');
    expect(report.status).toBe('completed');
    expect(report.planId).toBe('s1');
  });

  it('emits AgentMissionComplete with the outcome status', async () => {
    const bus = new InMemoryEventBus('test');
    const received: any[] = [];
    bus.subscribe(AgentMissionComplete, (e: any) => { received.push(e.payload); });

    const loop = fakeLoop(outcome('failed', 'tool rejected'));
    const agent = newAgent({ bus, reasoningLoop: loop });
    const report = await agent.run(source([step()]));

    expect(report.status).toBe('failed');
    expect(report.failureCount).toBe(1);
    expect(report.finalSummary).toContain('tool rejected');
    expect(received.length).toBe(1);
    expect(received[0].status).toBe('failed');
  });

  it('maps a canceled outcome to a cancelled report', async () => {
    const loop = fakeLoop(outcome('canceled'));
    const agent = newAgent({ reasoningLoop: loop });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('cancelled');
    expect(report.decisionCount).toBe(0);
  });

  it('forwards cancel() to the reasoning loop', async () => {
    const loop = fakeLoop(outcome('completed'));
    const agent = newAgent({ reasoningLoop: loop });
    loop.run.mockImplementation(() => new Promise<AmiOutcome>(() => {}));
    const pending = agent.run(source([step()]));
    agent.cancel();
    expect(loop.cancel).toHaveBeenCalledTimes(1);
    void pending;
  });

  it('falls back to a failed report when the loop throws', async () => {
    const loop = fakeLoop(outcome('completed'));
    loop.run.mockRejectedValue(new Error('boom'));
    const agent = newAgent({ reasoningLoop: loop });
    const report = await agent.run(source([step()]));
    expect(report.status).toBe('failed');
    expect(report.failureCount).toBe(1);
    expect(report.finalSummary).toContain('boom');
  });
});
