import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type {
  AssemblyMetrics,
  ContextItem,
  ContextPackage,
  ContextPipeline,
  ContextRequest,
} from '@gamedev-agent/context';
import type { CurrentContext } from '@gamedev-agent/context';
import type { MemoryEntryInput, MemoryManager } from '@gamedev-agent/memory';
import type {
  Capability,
  ModelProvidersService,
  ModelRequest,
  ModelResponse,
  TokenUsage,
  ToolCall,
} from '@gamedev-agent/model-providers';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import type {
  StepResult,
  WorkflowStep,
  WorkflowStepContext,
  WorkflowStepId,
} from '@gamedev-agent/workflow';
import { describe, expect, it, vi } from 'vitest';
import { AgentDispatcher } from './AgentDispatcher';
import { ContextAssembler } from './ContextAssembler';
import { ExecutionEngine } from './ExecutionEngine';
import { MemoryRecorder } from './MemoryRecorder';
import { ProgressTracker } from './ProgressTracker';
import { ToolBridge } from './ToolBridge';
import { StepCancelledError, StepTimeoutError } from './errors';
import type { ExecutionStepResult } from './types';

// ─── Noop Logger ───────────────────────────────────────────────────────────

const noopLogger: Logger = {
  namespace: 'test',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

// ─── Factories ─────────────────────────────────────────────────────────────

const aStep = (overrides?: Partial<WorkflowStep>): WorkflowStep => ({
  id: 'step-1' as WorkflowStepId,
  title: 'Generate dialogue system',
  description: 'Create a branching dialogue system with YAML-driven scripts.',
  requiredCapability: 'code-generation',
  requiredRole: 'executor',
  dependsOn: [],
  ...overrides,
});

const aContext = (overrides?: Partial<WorkflowStepContext>): WorkflowStepContext => ({
  executionId: 'exec-1' as any,
  workflowId: 'wf-1' as any,
  projectId: 'proj-1' as any,
  missionId: null,
  attempt: 1,
  metadata: {},
  ...overrides,
});

const makeContextPackage = (overrides?: Partial<ContextPackage>): ContextPackage => ({
  id: 'pkg-1' as any,
  items: [
    { id: 'item-1' as any, content: 'Project context', tokens: 10, priority: 1, relevance: 1, attribution: { source: 'test' as any, origin: 'test', timestamp: 1000 as any }, compressed: false, metadata: {} },
  ],
  totalTokens: 10,
  budget: 100,
  truncated: false,
  sources: ['test' as any],
  assembledAt: 1000 as any,
  version: 1,
  policy: 'executor',
  metrics: {
    totalLatencyMs: 5,
    providerLatency: {},
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    originalTokens: 10,
    compressedTokens: 10,
    compressionRatio: 1,
    itemsCollected: 1,
    itemsEvicted: 0,
    itemsCompressed: 0,
  },
  request: { role: 'executor' as any, purpose: 'codegen' as any, maxTokens: 100 },
  metadata: {},
  ...overrides,
});

const makeResponse = (overrides?: Partial<ModelResponse>): ModelResponse => ({
  id: 'resp-1',
  model: 'gpt-4o',
  content: 'Here is a dialogue system implementation.',
  toolCalls: [],
  finishReason: 'stop',
  usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
  cost: { currency: 'USD', promptCost: 0.0001, completionCost: 0.001, totalCost: 0.0011 },
  latencyMs: 500,
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ContextAssembler', () => {
  it('assembles context from step and workflow context', async () => {
    const pipeline = {
      execute: vi.fn().mockResolvedValue(makeContextPackage()),
    } as unknown as ContextPipeline;
    const contextManager = {
      getCurrentContext: vi.fn().mockResolvedValue({ projectId: 'proj-1' } as CurrentContext),
    } as any;
    const modelProviders = {
      findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o', provider: 'openai' }]),
    } as unknown as ModelProvidersService;

    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders, noopLogger);
    const result = await assembler.assemble(aStep(), aContext());

    expect(result.modelId).toBe('gpt-4o');
    expect(result.messages.length).toBe(2);
    expect(result.messages[0]?.role).toBe('system');
    expect(result.messages[1]?.role).toBe('user');
    expect(result.messages[1]?.content).toContain('Generate dialogue system');
    expect(result.contextPackage.items.length).toBe(1);
    expect(pipeline.execute).toHaveBeenCalledOnce();
  });

  it('maps step requiredCapability to purpose', async () => {
    const pipeline = { execute: vi.fn().mockResolvedValue(makeContextPackage()) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = { findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o' }]) } as unknown as ModelProvidersService;

    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders);
    const step = aStep({ requiredCapability: 'code-review' });
    await assembler.assemble(step, aContext());

    const requestArg = (pipeline.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as ContextRequest;
    expect(requestArg.purpose).toBe('review');
  });

  it('falls back to default model when no match found', async () => {
    const pipeline = { execute: vi.fn().mockResolvedValue(makeContextPackage()) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = { findModels: vi.fn().mockReturnValue([]) } as unknown as ModelProvidersService;

    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders);
    const result = await assembler.assemble(aStep(), aContext());
    expect(result.modelId).toBe('gpt-4o');
  });
});

describe('AgentDispatcher', () => {
  it('dispatches messages and returns response', async () => {
    const agentRuntime = {} as any;
    const modelProviders = {
      generate: vi.fn().mockResolvedValue(makeResponse()),
    } as unknown as ModelProvidersService;

    const dispatcher = new AgentDispatcher(agentRuntime, modelProviders);
    const result = await dispatcher.dispatch(
      [{ role: 'user', content: 'Hello' }],
      undefined,
      undefined,
      undefined,
    );

    expect(result.response.content).toBe('Here is a dialogue system implementation.');
    expect(result.toolCalls).toEqual([]);
  });

  it('rejects on cancellation signal', async () => {
    const agentRuntime = {} as any;
    const modelProviders = { generate: vi.fn() } as unknown as ModelProvidersService;
    const dispatcher = new AgentDispatcher(agentRuntime, modelProviders);

    const controller = new AbortController();
    controller.abort();

    await expect(
      dispatcher.dispatch([{ role: 'user', content: 'x' }], undefined, undefined, controller.signal),
    ).rejects.toThrow(/cancelled/i);
  });
});

describe('MemoryRecorder', () => {
  it('records execution result to memory', async () => {
    const memoryManager = {
      storeEntry: vi.fn().mockResolvedValue({}),
    } as unknown as MemoryManager;

    const recorder = new MemoryRecorder(memoryManager);
    const execResult: ExecutionStepResult = {
      ok: true,
      usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      toolCalls: [],
      rounds: 1,
      totalLatencyMs: 500,
    };

    await recorder.record({
      step: aStep(),
      context: aContext(),
      result: execResult,
      startTime: Date.now(),
    });

    expect(memoryManager.storeEntry).toHaveBeenCalledOnce();
    const input = (memoryManager.storeEntry as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as MemoryEntryInput;
    expect(input.summary).toContain('succeeded');
    expect(input.tier).toBe('project');
    expect(input.category).toBe('execution');
  });
});

describe('ProgressTracker', () => {
  it('emits step-started event', async () => {
    const bus = new InMemoryEventBus('test');
    const tracker = new ProgressTracker(bus, 'exec-1' as any, 'step-1' as any);

    let emitted = false;
    bus.subscribe({ type: 'execution.step-started', version: 1 } as any, () => {
      emitted = true;
    });

    await tracker.stepStarted(1, 'gpt-4o', {} as AssemblyMetrics);
    expect(emitted).toBe(true);
  });

  it('emits step-completed event with usage', async () => {
    const bus = new InMemoryEventBus('test');
    const tracker = new ProgressTracker(bus, 'exec-1' as any, 'step-1' as any);

    let payload: any;
    bus.subscribe({ type: 'execution.step-completed', version: 1 } as any, (e: any) => {
      payload = e.payload;
    });

    await tracker.stepCompleted(1, { ok: true }, { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, [], 2, 1000);
    expect(payload.attempt).toBe(1);
    expect(payload.usage.totalTokens).toBe(30);
    expect(payload.rounds).toBe(2);
    expect(payload.totalLatencyMs).toBe(1000);
  });
});

describe('ExecutionEngine', () => {
  const defaultUsage: TokenUsage = { promptTokens: 50, completionTokens: 100, totalTokens: 150 };

  function makeEngine(
    overrides?: {
      contextItems?: ContextItem[];
      modelResponse?: ModelResponse;
      toolManager?: Partial<ToolManager>;
      memoryManager?: Partial<MemoryManager>;
    },
  ): ExecutionEngine {
    const contextPackage = makeContextPackage({ items: overrides?.contextItems ?? [] });

    const pipeline = {
      execute: vi.fn().mockResolvedValue(contextPackage),
    } as unknown as ContextPipeline;
    const contextManager = {
      getCurrentContext: vi.fn().mockResolvedValue({ projectId: 'proj-1' } as CurrentContext),
    } as any;
    const modelProviders = {
      generate: vi.fn().mockResolvedValue(overrides?.modelResponse ?? makeResponse()),
      findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o', provider: 'openai' }]),
    } as unknown as ModelProvidersService;

    const agentRuntime = {} as any;
    const toolManager = {
      list: vi.fn().mockReturnValue([]),
      invoke: vi.fn(),
      ...overrides?.toolManager,
    } as unknown as ToolManager;
    const memoryManager = {
      storeEntry: vi.fn().mockResolvedValue({}),
      ...overrides?.memoryManager,
    } as unknown as MemoryManager;

    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders, noopLogger);
    const dispatcher = new AgentDispatcher(agentRuntime, modelProviders, noopLogger);
    const recorder = new MemoryRecorder(memoryManager, noopLogger);
    const bus = new InMemoryEventBus('test');

    return new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager,
      memoryRecorder: recorder,
      eventBus: bus,
      logger: noopLogger,
      defaultTimeoutMs: 10_000,
    });
  }

  it('completes a step without tool calls', async () => {
    const engine = makeEngine();
    const result = await engine.execute(aStep(), aContext());
    expect(result.ok).toBe(true);
  });

  it('handles tool calls in a loop', async () => {
    let callCount = 0;
    const toolResponse = (hasTools: boolean): ModelResponse => {
      callCount += 1;
      if (hasTools && callCount === 1) {
        return makeResponse({
          content: 'Calling tools...',
          toolCalls: [
            { id: 'tc-1', type: 'function', function: { name: 'filesystem.read', arguments: '{}' } },
          ],
          finishReason: 'tool_calls',
        });
      }
      return makeResponse({
        content: 'Final result after tools.',
        finishReason: 'stop',
      });
    };

    const toolManager = {
      list: vi.fn().mockReturnValue([
        { descriptor: { id: 'filesystem.read', description: 'Read files', capabilities: [{ id: 'fs', actions: ['read'] }] } },
      ]),
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        toolId: 'filesystem.read',
        action: 'filesystem.read',
        durationMs: 100,
        output: { content: 'file contents' },
      }),
    } as unknown as ToolManager;

    const pipeline = { execute: vi.fn().mockResolvedValue(makeContextPackage()) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = {
      generate: vi.fn().mockImplementation((_req: ModelRequest) => {
        callCount += 1;
        if (callCount <= 1) {
          return Promise.resolve(makeResponse({
            toolCalls: [
              { id: 'tc-1', type: 'function', function: { name: 'fs.read', arguments: '{}' } } as ToolCall,
            ],
            finishReason: 'tool_calls',
          }));
        }
        return Promise.resolve(makeResponse({
          content: 'Final result.',
          finishReason: 'stop',
        }));
      }),
      findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o', provider: 'openai' }]),
    } as unknown as ModelProvidersService;

    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders, noopLogger);
    const dispatcher = new AgentDispatcher({} as any, modelProviders, noopLogger);
    const recorder = new MemoryRecorder({ storeEntry: vi.fn().mockResolvedValue({}) } as any, noopLogger);
    const bus = new InMemoryEventBus('test');

    const engine = new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager,
      memoryRecorder: recorder,
      eventBus: bus,
      logger: noopLogger,
      defaultTimeoutMs: 10_000,
      maxToolRounds: 5,
    });

    const result = await engine.execute(aStep({ requiredCapability: 'code-generation' }), aContext());
    expect(result.ok).toBe(true);
    expect(toolManager.invoke).toHaveBeenCalledOnce();
  });

  it('reports failure when model throws', async () => {
    const pipeline = { execute: vi.fn().mockRejectedValue(new Error('Pipeline failure')) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = { findModels: vi.fn(), generate: vi.fn() } as unknown as ModelProvidersService;
    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders);
    const dispatcher = new AgentDispatcher({} as any, modelProviders);
    const recorder = new MemoryRecorder({ storeEntry: vi.fn() } as any);
    const bus = new InMemoryEventBus('test');

    const engine = new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager: { list: vi.fn() } as any,
      memoryRecorder: recorder,
      eventBus: bus,
      logger: noopLogger,
    });

    const result = await engine.execute(aStep(), aContext());
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('respects step-level timeout', async () => {
    const pipeline = { execute: vi.fn().mockImplementation(() => new Promise(() => {})) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = {
      generate: vi.fn(),
      findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o' }]),
    } as unknown as ModelProvidersService;
    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders);
    const dispatcher = new AgentDispatcher({} as any, modelProviders);
    const recorder = new MemoryRecorder({ storeEntry: vi.fn() } as any);
    const bus = new InMemoryEventBus('test');

    const engine = new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager: { list: vi.fn() } as any,
      memoryRecorder: recorder,
      eventBus: bus,
      defaultTimeoutMs: 50,
      logger: noopLogger,
    });

    const result = await engine.execute(aStep(), aContext());
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles cancellation mid-execution', async () => {
    const pipeline = {
      execute: vi.fn().mockRejectedValue(new StepCancelledError('step-1')),
    } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = { findModels: vi.fn(), generate: vi.fn() } as unknown as ModelProvidersService;
    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders);
    const dispatcher = new AgentDispatcher({} as any, modelProviders);
    const recorder = new MemoryRecorder({ storeEntry: vi.fn() } as any);
    const bus = new InMemoryEventBus('test');

    const engine = new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager: { list: vi.fn() } as any,
      memoryRecorder: recorder,
      eventBus: bus,
      logger: noopLogger,
    });

    const result = await engine.execute(aStep(), aContext());
    expect(result.ok).toBe(false);
  });

  it('uses step metadata timeout when available', async () => {
    const pipeline = { execute: vi.fn().mockImplementation(() => new Promise(() => {})) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = {
      generate: vi.fn(),
      findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o' }]),
    } as unknown as ModelProvidersService;
    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders);
    const dispatcher = new AgentDispatcher({} as any, modelProviders);
    const recorder = new MemoryRecorder({ storeEntry: vi.fn() } as any);
    const bus = new InMemoryEventBus('test');

    const engine = new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager: { list: vi.fn() } as any,
      memoryRecorder: recorder,
      eventBus: bus,
      defaultTimeoutMs: 120_000,
      logger: noopLogger,
    });

    const step = aStep({ metadata: { timeoutMs: 50 } });
    const result = await engine.execute(step, aContext());
    expect(result.ok).toBe(false);
  });

  it('emits execution events throughout lifecycle', async () => {
    const bus = new InMemoryEventBus('test');
    const started: any[] = [];
    const completed: any[] = [];
    bus.subscribe({ type: 'execution.step-started', version: 1 } as any, (e: any) => started.push(e.payload));
    bus.subscribe({ type: 'execution.step-completed', version: 1 } as any, (e: any) => completed.push(e.payload));

    const pipeline = { execute: vi.fn().mockResolvedValue(makeContextPackage()) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = {
      generate: vi.fn().mockResolvedValue(makeResponse()),
      findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o', provider: 'openai' }]),
    } as unknown as ModelProvidersService;
    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders, noopLogger);
    const dispatcher = new AgentDispatcher({} as any, modelProviders, noopLogger);
    const recorder = new MemoryRecorder({ storeEntry: vi.fn() } as any, noopLogger);
    const engine = new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager: { list: vi.fn().mockReturnValue([]) } as any,
      memoryRecorder: recorder,
      eventBus: bus,
      logger: noopLogger,
    });

    await engine.execute(aStep(), aContext());

    expect(started.length).toBe(1);
    expect(completed.length).toBe(1);
    expect(completed[0]?.result?.ok).toBe(true);
  });

  it('limits tool call rounds', async () => {
    const pipeline = { execute: vi.fn().mockResolvedValue(makeContextPackage()) } as unknown as ContextPipeline;
    const contextManager = { getCurrentContext: vi.fn().mockResolvedValue({} as CurrentContext) } as any;
    const modelProviders = {
      generate: vi.fn().mockResolvedValue(makeResponse({
        content: 'Calling tool...',
        toolCalls: [
          { id: 'tc-1', type: 'function', function: { name: 'test', arguments: '{}' } } as ToolCall,
        ],
        finishReason: 'tool_calls',
      })),
      findModels: vi.fn().mockReturnValue([{ id: 'gpt-4o', provider: 'openai' }]),
    } as unknown as ModelProvidersService;

    let storeEntryCalled = false;

    const assembler = new ContextAssembler(pipeline, contextManager, modelProviders, noopLogger);
    const dispatcher = new AgentDispatcher({} as any, modelProviders, noopLogger);
    const recorder = new MemoryRecorder({ storeEntry: vi.fn().mockImplementation(() => { storeEntryCalled = true; }) } as any, noopLogger);
    const bus = new InMemoryEventBus('test');
    const toolManager = {
      list: vi.fn().mockReturnValue([
        { descriptor: { id: 'test', description: 'test', capabilities: [{ id: 't', actions: ['run'] }] } },
      ]),
      invoke: vi.fn().mockResolvedValue({ ok: true, output: '{}', durationMs: 10 }),
    } as unknown as ToolManager;

    const engine = new ExecutionEngine({
      contextAssembler: assembler,
      agentDispatcher: dispatcher,
      toolManager,
      memoryRecorder: recorder,
      eventBus: bus,
      logger: noopLogger,
      maxToolRounds: 1,
    });

    const result = await engine.execute(aStep({ requiredCapability: 'code-generation' }), aContext());
    expect(result.ok).toBe(true);
  });
});

describe('ToolBridge', () => {
  it('invokes a single tool', async () => {
    const toolManager = {
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        toolId: 'fs.read',
        action: 'read',
        durationMs: 50,
        output: { content: 'data' },
      }),
    } as unknown as ToolManager;
    const bus = new InMemoryEventBus('test');
    const bridge = new ToolBridge(
      toolManager,
      bus,
      'exec-1',
      'step-1',
      1,
      noopLogger,
    );

    const toolCalls: ToolCall[] = [
      { id: 'tc-1', type: 'function', function: { name: 'fs.read', arguments: '{}' } },
    ];

    const results = await bridge.invokeAll(toolCalls);
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
  });
});
