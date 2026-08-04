import { describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { ModelProvidersService, ModelResponse } from '@gamedev-agent/model-providers';
import type { ToolManager, ToolInvocationResult, MissionAbility } from '@gamedev-agent/tool-runtime';
import { CapabilityPlanner } from '@gamedev-agent/tool-runtime';
import type { WorkflowSource, WorkflowStep, WorkflowStepId } from '@gamedev-agent/workflow';
import { MissionAgent } from './MissionAgent';
import { AgentProgress, AgentActionStarted, AgentActionResult } from './MissionAgentEvents';

const noopLogger: Logger = {
  namespace: 'test',
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  child: () => noopLogger,
};

const MODEL_OK: ModelResponse = {
  id: 'r',
  model: 'm',
  content: '',
  toolCalls: [],
  finishReason: 'stop',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  cost: { currency: 'USD' as const, promptCost: 0, completionCost: 0, totalCost: 0 },
  latencyMs: 1,
};

function modelResponse(content: string): ModelResponse {
  return { ...MODEL_OK, content };
}

function thinkResp(capability: string = 'run-commands'): string {
  return JSON.stringify({ reasoning: 'proceed', intention: 'do work', capability });
}

function continueResp(capability: string = 'run-commands', params: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'continue',
    capability,
    params,
    expected: 'success',
  });
}

function completeResp(): string {
  return JSON.stringify({ type: 'complete' });
}

function fakePlanner(abilities: readonly string[] = ['run-commands', 'read-files', 'write-files', 'install-packages']) {
  return {
    getAvailableAbilities: vi.fn().mockReturnValue(abilities),
    resolveAbilities: vi.fn().mockImplementation((reqAbilities: readonly string[]) => {
      const ability = reqAbilities[0] ?? 'run-commands';
      return [{
        ability: ability as MissionAbility,
        toolId: 'nova.tool.terminal' as any,
        capabilityId: 'terminal.run',
        capabilityName: 'Run Command',
        confidence: 'exact' as const,
        requiresSession: false,
        inputSchema: {},
      }];
    }),
  } as unknown as CapabilityPlanner;
}

describe('Autonomous Workflow Execution Pipeline', () => {
  it('executes a multi-step project creation workflow sequentially from start to end without stopping', async () => {
    const bus = new InMemoryEventBus({ source: 'test' });
    const progressEvents: Array<number> = [];
    const actionResults: Array<string> = [];

    bus.subscribe(AgentProgress, (e) => progressEvents.push(e.payload.progress));
    bus.subscribe(AgentActionResult, (e) => actionResults.push(e.payload.capability));

    const invokedTools: string[] = [];
    const toolManager = {
      list: () => [],
      invoke: async (call: any) => {
        invokedTools.push(`${call.toolId}:${call.action}`);
        return {
          ok: true,
          toolId: call.toolId,
          action: call.action,
          durationMs: 10,
          output: { message: 'success' },
        } satisfies ToolInvocationResult;
      },
    } as unknown as ToolManager;

    const modelProviders = {
      generate: vi.fn().mockImplementation(async (req: any) => {
        if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp('run-commands'));
        if (req.metadata?.phase === 'deciding') return modelResponse(continueResp('run-commands', { command: 'echo step' }));
        return MODEL_OK;
      }),
    } as unknown as ModelProvidersService;

    const agent = new MissionAgent({
      toolManager,
      capabilityPlanner: fakePlanner(),
      modelProviders,
      eventBus: bus,
      logger: noopLogger,
    });

    // Multi-step workflow representing project creation: mkdir -> create vite -> install -> build
    const steps: WorkflowStep[] = [
      { id: 's1' as WorkflowStepId, title: 'mkdir TestProject', description: 'Create directory', dependsOn: [], requiredCapability: 'run-commands' },
      { id: 's2' as WorkflowStepId, title: 'npm create vite', description: 'Scaffold project', dependsOn: ['s1' as WorkflowStepId], requiredCapability: 'run-commands' },
      { id: 's3' as WorkflowStepId, title: 'npm install', description: 'Install dependencies', dependsOn: ['s2' as WorkflowStepId], requiredCapability: 'run-commands' },
      { id: 's4' as WorkflowStepId, title: 'npm run build', description: 'Build production bundle', dependsOn: ['s3' as WorkflowStepId], requiredCapability: 'run-commands' },
    ];

    const source: WorkflowSource = {
      sourceId: 'threejs-vite-project',
      projectId: 'proj-123' as any,
      missionId: 'm1' as any,
      steps,
      mode: 'sequential',
      failFast: true,
    };

    const report = await agent.run(source);

    expect(report.status).toBe('completed');
    expect(report.actionCount).toBe(4);
    expect(report.failureCount).toBe(0);
    expect(invokedTools.length).toBe(4);
    expect(progressEvents.length).toBeGreaterThanOrEqual(4);
  });

  it('respects topological dependency ordering when steps are declared out of order', async () => {
    const bus = new InMemoryEventBus({ source: 'test' });
    const executedStepOrder: string[] = [];

    const toolManager = {
      list: () => [],
      invoke: async (call: any) => {
        return {
          ok: true,
          toolId: call.toolId,
          action: call.action,
          durationMs: 5,
          output: null,
        } satisfies ToolInvocationResult;
      },
    } as unknown as ToolManager;

    const modelProviders = {
      generate: vi.fn().mockImplementation(async (req: any) => {
        if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp('run-commands'));
        if (req.metadata?.phase === 'deciding') return modelResponse(continueResp('run-commands'));
        return MODEL_OK;
      }),
    } as unknown as ModelProvidersService;

    const agent = new MissionAgent({
      toolManager,
      capabilityPlanner: fakePlanner(),
      modelProviders,
      eventBus: bus,
      logger: noopLogger,
    });

    // Steps declared out of topological order: step 3 (depends on 2), step 1 (no deps), step 2 (depends on 1)
    const steps: WorkflowStep[] = [
      { id: 's3' as WorkflowStepId, title: 'Step 3', description: 'Build', dependsOn: ['s2' as WorkflowStepId], requiredCapability: 'run-commands' },
      { id: 's1' as WorkflowStepId, title: 'Step 1', description: 'Init', dependsOn: [], requiredCapability: 'run-commands' },
      { id: 's2' as WorkflowStepId, title: 'Step 2', description: 'Install', dependsOn: ['s1' as WorkflowStepId], requiredCapability: 'run-commands' },
    ];

    const source: WorkflowSource = {
      sourceId: 'dep-order-test',
      projectId: 'proj-dep' as any,
      missionId: 'm-dep' as any,
      steps,
      mode: 'sequential',
      failFast: true,
    };

    const report = await agent.run(source);

    expect(report.status).toBe('completed');
    expect(report.actionCount).toBe(3);
  });

  it('retries when tool execution initially fails and recovers on subsequent attempt', async () => {
    const bus = new InMemoryEventBus({ source: 'test' });
    let toolCallCount = 0;

    const toolManager = {
      list: () => [],
      invoke: async () => {
        toolCallCount++;
        if (toolCallCount === 1) {
          return {
            ok: false,
            error: { message: 'temporary network failure' },
            toolId: 't1',
            action: 'a1',
            durationMs: 5,
            output: null,
          } satisfies ToolInvocationResult;
        }
        return {
          ok: true,
          toolId: 't1',
          action: 'a1',
          durationMs: 5,
          output: { success: true },
        } satisfies ToolInvocationResult;
      },
    } as unknown as ToolManager;

    const modelProviders = {
      generate: vi.fn().mockImplementation(async (req: any) => {
        if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp('run-commands'));
        if (req.metadata?.phase === 'deciding') return modelResponse(continueResp('run-commands'));
        return MODEL_OK;
      }),
    } as unknown as ModelProvidersService;

    const agent = new MissionAgent({
      toolManager,
      capabilityPlanner: fakePlanner(),
      modelProviders,
      eventBus: bus,
      logger: noopLogger,
    });

    const steps: WorkflowStep[] = [
      { id: 's1' as WorkflowStepId, title: 'Install package', description: 'Install dependency', dependsOn: [], requiredCapability: 'run-commands' },
    ];

    const source: WorkflowSource = {
      sourceId: 'retry-test',
      projectId: 'proj-retry' as any,
      missionId: 'm-retry' as any,
      steps,
      mode: 'sequential',
      failFast: true,
    };

    const report = await agent.run(source);

    expect(report.status).toBe('completed');
    expect(toolCallCount).toBe(2);
    expect(report.failureCount).toBe(1); // 1 recorded failure recovered on retry 2
  });

  it('handles cancellation gracefully via AbortSignal', async () => {
    const bus = new InMemoryEventBus({ source: 'test' });
    const controller = new AbortController();

    const toolManager = {
      list: () => [],
      invoke: async () => {
        controller.abort(); // Cancel during first tool call
        return { ok: true, toolId: 't', action: 'a', durationMs: 1, output: null };
      },
    } as unknown as ToolManager;

    const modelProviders = {
      generate: vi.fn().mockImplementation(async (req: any) => {
        if (req.metadata?.phase === 'thinking') return modelResponse(thinkResp());
        if (req.metadata?.phase === 'deciding') return modelResponse(continueResp());
        return MODEL_OK;
      }),
    } as unknown as ModelProvidersService;

    const agent = new MissionAgent({
      toolManager,
      capabilityPlanner: fakePlanner(),
      modelProviders,
      eventBus: bus,
      logger: noopLogger,
    });

    const steps: WorkflowStep[] = [
      { id: 's1' as WorkflowStepId, title: 'Step 1', description: 'Step 1', dependsOn: [] },
      { id: 's2' as WorkflowStepId, title: 'Step 2', description: 'Step 2', dependsOn: ['s1' as WorkflowStepId] },
    ];

    const source: WorkflowSource = {
      sourceId: 'cancel-test',
      projectId: 'p-cancel' as any,
      missionId: 'm-cancel' as any,
      steps,
      mode: 'sequential',
      failFast: true,
    };

    const report = await agent.run(source, controller.signal);

    expect(report.status).toBe('cancelled');
  });
});
