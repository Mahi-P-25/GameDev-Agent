import { agentRuntimeModule } from '@gamedev-agent/agent-runtime';
import { capabilityModule } from '@gamedev-agent/capabilities';
import { MemoryConfigSource } from '@gamedev-agent/config';
import { COORDINATOR_MANAGER_TOKEN, coordinatorModule } from '@gamedev-agent/coordinator';
import type { CoordinatorManager } from '@gamedev-agent/coordinator';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { Kernel } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { MEMORY_MANAGER_TOKEN, memoryModule } from '@gamedev-agent/memory';
import type { MemoryManager } from '@gamedev-agent/memory';
import type { ModelInfo } from '@gamedev-agent/model-providers';
import {
  BUILTIN_PROVIDER_FACTORIES,
  MODEL_PROVIDERS_SERVICE_TOKEN,
  MODEL_PROVIDER_REGISTRY_TOKEN,
  modelProvidersModule,
} from '@gamedev-agent/model-providers';
import { PLANNER_MANAGER_TOKEN, plannerModule } from '@gamedev-agent/planner';
import type { PlannerManager } from '@gamedev-agent/planner';
import { PRODUCER_MANAGER_TOKEN, producerModule } from '@gamedev-agent/producer';
import type { ProducerManager } from '@gamedev-agent/producer';
import { PROJECT_MANAGER_TOKEN, projectModule } from '@gamedev-agent/project';
import type { ProjectManager } from '@gamedev-agent/project';
import { STUDIO_API_TOKEN, studioModule } from '@gamedev-agent/studio-api';
import type { StudioApi } from '@gamedev-agent/studio-api';
import { executionEngineModule } from '@gamedev-agent/execution-engine';
import { toolRuntimeModule } from '@gamedev-agent/tool-runtime';
import { WORKFLOW_MANAGER_TOKEN, workflowModule } from '@gamedev-agent/workflow';
import type { WorkflowManager } from '@gamedev-agent/workflow';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const fakeModelProviders = {
  async generate() {
    return {
      id: 'fake-response-1',
      model: 'fake-model',
      content: 'Step complete. No tool calls needed.',
      toolCalls: [],
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cost: { currency: 'USD' as const, promptCost: 0, completionCost: 0, totalCost: 0 },
      latencyMs: 1,
    };
  },
  findModels(_capabilities: readonly unknown[]): ModelInfo[] {
    return [{
      id: 'fake-model',
      provider: 'openai',
      displayName: 'Fake Model',
      contextWindow: 4096,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'tool_calling'],
      pricing: { promptPerMillion: 0, completionPerMillion: 0, currency: 'USD' },
    }];
  },
  generateStream: async function* () { /* no yield */ },
  listModels: () => [],
  getTotalUsage: () => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
  resetUsage: () => undefined,
  getProvider: () => { throw new Error('No provider configured in test'); },
};

const sharedModules = [
  coordinatorModule,
  capabilityModule,
  producerModule,
  plannerModule,
  projectModule,
  memoryModule,
  agentRuntimeModule,
  toolRuntimeModule,
  workflowModule,
  executionEngineModule,
  studioModule,
] as const;

describe('Full Pipeline E2E — Submit Goal → Execution Engine → Completion', () => {
  let kernel: Kernel;
  let api: StudioApi;
  let workflow: WorkflowManager;
  let memory: MemoryManager;
  let producer: ProducerManager;
  let planner: PlannerManager;
  let projects: ProjectManager;
  let coordinator: CoordinatorManager;

  async function settle(maxWaitMs = 10_000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    for (;;) {
      const executions = workflow.list();
      if (executions.length > 0) {
        const first = executions[0];
        if (first.state === 'completed') return;
        if (first.state === 'failed') throw new Error(`Workflow failed: ${first.failureReason ?? 'unknown'}`);
      }
      if (Date.now() >= deadline) throw new Error('Pipeline did not complete within timeout');
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  async function resolveManagers(): Promise<void> {
    api = await kernel.services.resolve<StudioApi>(STUDIO_API_TOKEN);
    workflow = await kernel.services.resolve<WorkflowManager>(WORKFLOW_MANAGER_TOKEN);
    memory = await kernel.services.resolve<MemoryManager>(MEMORY_MANAGER_TOKEN);
    producer = await kernel.services.resolve<ProducerManager>(PRODUCER_MANAGER_TOKEN);
    planner = await kernel.services.resolve<PlannerManager>(PLANNER_MANAGER_TOKEN);
    projects = await kernel.services.resolve<ProjectManager>(PROJECT_MANAGER_TOKEN);
    coordinator = await kernel.services.resolve<CoordinatorManager>(COORDINATOR_MANAGER_TOKEN);
  }

  async function verifyPipeline(goalId: string, projectId: string): Promise<void> {
    const goal = producer.find(goalId);
    expect(goal).toBeDefined();
    expect(goal!.status).toBe('approved');
    expect(goal!.proposal).toBeDefined();

    const proposalId = goal!.proposal!.id;
    const plan = planner.findByProposal(proposalId as never);
    expect(plan).toBeDefined();
    expect(plan!.phases.length).toBeGreaterThan(0);

    const missions = coordinator.list();
    expect(missions.length).toBeGreaterThan(0);
    const mission = missions[0];
    expect(['ready', 'running', 'executing', 'completed']).toContain(mission.status);

    const executions = workflow.list();
    expect(executions.length).toBeGreaterThan(0);
    const execution = executions[0];
    expect(execution.state).toBe('completed');
    expect(execution.progress).toBe(100);
    expect(execution.steps.size).toBeGreaterThan(0);
    for (const [, record] of execution.steps) {
      expect(record.state).toBe('succeeded');
    }

    const memoryEntries = await memory.listByNamespace(`project/${projectId}`);
    const executionEntries = memoryEntries.filter((e) => e.category === 'execution');
    expect(executionEntries.length).toBeGreaterThan(0);
    for (const entry of executionEntries) {
      expect(entry.summary).toMatch(/succeeded/);
    }

    const home = api.getStudioHome();
    expect(home.goal).toBeDefined();
    expect(home.goal.title).toBe('Create a Unity third-person controller');
    expect(home.goal.goalId).toBe(goalId);
    expect(home.goal.status).toBe('approved');
    expect(home.plannerStatus.planCount).toBe(1);
    expect(home.plannerStatus.lastPlan?.phaseCount).toBeGreaterThan(0);
    expect(home.workflowStatus.executionCount).toBe(1);
    expect(home.workflowStatus.current?.state).toBe('completed');
    expect(home.coordinatorStatus.total).toBeGreaterThan(0);

    const kinds = home.activity.map((a) => a.kind);
    expect(kinds).toContain('goal.submitted');
    expect(kinds).toContain('plan.created');
    expect(kinds).toContain('workflow.completed');
  }

  afterEach(async () => {
    await kernel.dispose();
  });

  // ─── Fake provider (CI-safe, always runs) ──────────────────────────────

  beforeEach(async () => {
    kernel = new Kernel({
      namespace: 'full-pipeline-e2e',
      eventBus: new InMemoryEventBus('full-pipeline-e2e'),
      logger: new RootLogger('full-pipeline-e2e', [new ConsoleLogSink()]),
      configSources: [new MemoryConfigSource()],
      modules: [
        {
          name: 'nova.test.fake-model-providers',
          async register(k: Kernel): Promise<void> {
            k.registerService({
              token: MODEL_PROVIDERS_SERVICE_TOKEN,
              singleton: true,
              factory: () => fakeModelProviders,
            });
          },
        },
        ...sharedModules,
      ],
    });
    await kernel.boot();
    await resolveManagers();
  });

  it('traces the full pipeline: goal → plan → mission → workflow → execution engine → memory', async () => {
    const project = await projects.create({
      name: 'Unity-Controller',
      rootPath: '/tmp/unity-controller',
    } as never);

    const { goalId } = await api.submitGoal({
      projectId: project.id,
      title: 'Create a Unity third-person controller',
      description: 'Build a complete third-person player controller for Unity with movement, camera, and animations.',
    });
    expect(goalId).toBeDefined();

    await settle();

    await verifyPipeline(goalId, project.id);
  }, 30_000);

  // ─── Real AI provider (requires OPENROUTER_API_KEY) ────────────────────

  const apiKey = process.env.OPENROUTER_API_KEY;

  it.runIf(!!apiKey)(
    'traces the full pipeline with a real OpenRouter model: goal → plan → mission → workflow → execution engine → memory',
    async () => {
      kernel = new Kernel({
        namespace: 'full-pipeline-e2e-real',
        eventBus: new InMemoryEventBus('full-pipeline-e2e-real'),
        logger: new RootLogger('full-pipeline-e2e-real', [new ConsoleLogSink()]),
        configSources: [new MemoryConfigSource()],
        modules: [
          modelProvidersModule,
          ...sharedModules,
        ],
      });
      await kernel.boot();

      // Register built-in provider factories so the ProviderRegistry can
      // create real provider instances (OpenRouter, OpenAI, etc.).
      const providerRegistry = await kernel.services.resolve(MODEL_PROVIDER_REGISTRY_TOKEN);
      for (const factory of BUILTIN_PROVIDER_FACTORIES) {
        providerRegistry.register(factory);
      }

      // Pre-configure a real OpenRouter provider with the user's API key.
      // Using openrouter/auto to let OpenRouter route to a fast, inexpensive
      // model suitable for development.
      const modelService = await kernel.services.resolve(MODEL_PROVIDERS_SERVICE_TOKEN);
      modelService.getProvider('openrouter', {
        apiKey: apiKey,
        defaultModel: 'openrouter/auto',
      });

      await resolveManagers();

      const project = await projects.create({
        name: 'Unity-Controller',
        rootPath: '/tmp/unity-controller',
      } as never);

      const { goalId } = await api.submitGoal({
        projectId: project.id,
        title: 'Create a Unity third-person controller',
        description: 'Build a complete third-person player controller for Unity with movement, camera, and animations.',
      });
      expect(goalId).toBeDefined();

      await settle(120_000);

      await verifyPipeline(goalId, project.id);

      // Verify the real model's response was recorded in memory entries
      const realEntries = await memory.listByNamespace(`project/${project.id}`);
      const realExecutionEntries = realEntries.filter((e) => e.category === 'execution');
      expect(realExecutionEntries.length).toBeGreaterThan(0);
      for (const entry of realExecutionEntries) {
        expect(typeof entry.summary).toBe('string');
        expect(entry.summary).toMatch(/succeeded/);
      }
    },
    120_000,
  );
});
