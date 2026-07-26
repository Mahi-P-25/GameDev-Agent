import { capabilityModule } from '@gamedev-agent/capabilities';
import { MemoryConfigSource } from '@gamedev-agent/config';
import { coordinatorModule } from '@gamedev-agent/coordinator';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { Kernel } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { plannerModule } from '@gamedev-agent/planner';
import { producerModule } from '@gamedev-agent/producer';
import { projectModule } from '@gamedev-agent/project';
import type { Disposable } from '@gamedev-agent/shared';
import { STUDIO_API_TOKEN, type StudioApi, studioModule } from '@gamedev-agent/studio-api';
import type {
  StartWorkflowRequest,
  StudioActivity,
  StudioCapability,
  StudioContext,
  StudioCoordinatorStatus,
  StudioHealth,
  StudioHome,
  StudioMission,
  StudioProject,
  StudioProjectSummary,
  StudioWorkflowRun,
  StudioWorkflowTemplate,
  StudioWorkspace,
} from '@gamedev-agent/studio-api';
import { browserTerminalModule } from '@gamedev-agent/terminal';
import { toolRuntimeModule } from '@gamedev-agent/tool-runtime';
import { intelligenceModule } from '@gamedev-agent/intelligence';
import { runtimeModule, RUNTIME_TOKEN, type Runtime } from '@gamedev-agent/runtime';
import { runtimeWorkflowModule } from '@gamedev-agent/studio-api';
import { workflowModule } from '@gamedev-agent/workflow';
import type { StudioApiClient, RuntimeClient, RuntimeAwareness } from './StudioApiClient';

/**
 * Boots the Nova kernel in the browser and resolves a live {@link StudioApi},
 * then adapts it to the {@link StudioApiClient} the UI consumes.
 *
 * This is the *only* place the frontend touches backend packages. The kernel is
 * assembled from the public `KernelModule`s so the dependency direction stays
 * correct: the app boots the kernel, the kernel wires the subsystems, and the UI
 * only ever sees the Studio API façade.
 *
 * Architecture boundary: the Studio React app must never import Node-only
 * backend integrations (`vscode`, `terminal`'s Node runner). Those execute only
 * in the Nova Runtime/backend layer. The browser boots the browser-safe
 * terminal module, which wires the audited façade without pulling
 * `node:child_process`/`fs`/`path` into the bundle. File-system and process
 * execution happen server-side; the UI talks to them exclusively through the
 * Studio API.
 */
async function bootStudioApi(): Promise<{ api: StudioApi; runtime: Runtime | null }> {
  const kernel = new Kernel({
    namespace: 'studio-shell',
    eventBus: new InMemoryEventBus('studio-shell'),
    logger: new RootLogger('studio-shell', [new ConsoleLogSink()]),
    configSources: [new MemoryConfigSource()],
    modules: [
      coordinatorModule,
      capabilityModule,
      producerModule,
      plannerModule,
      projectModule,
      toolRuntimeModule,
      browserTerminalModule,
      workflowModule,
      intelligenceModule,
      runtimeModule,
      studioModule,
      runtimeWorkflowModule,
    ],
  });

  await kernel.boot();
  const api = await kernel.services.resolve<StudioApi>(STUDIO_API_TOKEN);
  const runtime = kernel.services.has(RUNTIME_TOKEN)
    ? await kernel.services.resolve<Runtime>(RUNTIME_TOKEN)
    : null;
  return { api, runtime };
}

/**
 * A {@link StudioApiClient} backed by a live, in-browser {@link StudioApi}.
 * The kernel is booted once at construction; all reads are synchronous views of
 * the façade (the façade itself keeps no async I/O for reads).
 */
export class KernelStudioApiClient implements StudioApiClient {
  ready = false;
  readonly runtime: RuntimeClient;
  private api: StudioApi | null = null;
  private runtimeRef: Runtime | null = null;

  constructor() {
    this.runtime = new KernelRuntimeClient(() => this.runtimeRef);
    void bootStudioApi()
      .then((result) => {
        this.api = result.api;
        this.runtimeRef = result.runtime;
        this.ready = true;
      })
      .catch((error: unknown) => {
        // Surface to the console; the UI renders an empty/placeholder state when
        // `ready` stays false so the shell degrades gracefully.
        console.error('[Nova Studio] Failed to boot Studio API:', error);
      });
  }

  getWorkspace(): StudioWorkspace {
    if (this.api === null) {
      return { projectCount: 0, missionCount: 0, dependencies: [], ready: false };
    }
    return this.api.getWorkspace();
  }
  listProjects(): ReadonlyArray<StudioProjectSummary> {
    return this.api === null ? [] : this.api.listProjects();
  }
  getProject(id: string): StudioProject {
    if (this.api === null) {
      throw new Error(`Project not found: ${id}`);
    }
    return this.api.getProject(id);
  }
  listMissions(): ReadonlyArray<StudioMission> {
    return this.api === null ? [] : this.api.listMissions();
  }
  getMission(id: string): StudioMission {
    if (this.api === null) {
      throw new Error(`Mission not found: ${id}`);
    }
    return this.api.getMission(id);
  }
  listCapabilities(): ReadonlyArray<StudioCapability> {
    return this.api === null ? [] : this.api.listCapabilities();
  }
  getHealth(): StudioHealth {
    if (this.api === null) {
      return { total: 0, healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
    }
    return this.api.getHealth();
  }
  getCoordinatorStatus(): StudioCoordinatorStatus {
    if (this.api === null) {
      return { total: 0, byStatus: {}, active: 0, terminal: 0 };
    }
    return this.api.getCoordinatorStatus();
  }
  getContext(): StudioContext {
    if (this.api === null) {
      return {
        onboarding: true,
        workspaceId: null,
        projectId: null,
        goalId: null,
        missionId: null,
        workflowId: null,
        workflowExecutionId: null,
        activeFile: null,
        branch: null,
        recentFiles: [],
        recentWorkflows: [],
        updatedAt: 0,
      };
    }
    return this.api.getContext();
  }
  async setActiveProject(id: string): Promise<StudioContext> {
    if (this.api === null) {
      throw new Error('Studio API is not ready');
    }
    return this.api.setActiveProject(id);
  }
  async setActiveFile(file: string): Promise<StudioContext> {
    if (this.api === null) {
      throw new Error('Studio API is not ready');
    }
    return this.api.setActiveFile(file);
  }
  async resetContext(): Promise<StudioContext> {
    if (this.api === null) {
      throw new Error('Studio API is not ready');
    }
    return this.api.resetContext();
  }
  getActivity(limit = 50): ReadonlyArray<StudioActivity> {
    return this.api === null ? [] : this.api.getActivity(limit);
  }
  getStudioHome(): StudioHome {
    if (this.api === null) {
      return {
        goal: { goalId: null, title: null, status: null, proposalId: null },
        missionStatus: { total: 0, byStatus: {}, active: 0, terminal: 0 },
        plannerStatus: { planCount: 0, lastPlan: null },
        workflowStatus: { executionCount: 0, current: null, phases: [] },
        coordinatorStatus: { total: 0, byStatus: {}, active: 0, terminal: 0 },
        context: this.getContext(),
        activity: [],
      };
    }
    return this.api.getStudioHome();
  }
  onActivity(handler: (activity: StudioActivity) => void): Disposable {
    if (this.api === null) {
      return { dispose() {} };
    }
    return this.api.onActivity(handler);
  }

  listWorkflowTemplates(): ReadonlyArray<StudioWorkflowTemplate> {
    if (this.api === null) {
      return [];
    }
    return this.api.listWorkflowTemplates();
  }
  async startWorkflow(request: StartWorkflowRequest): Promise<StudioWorkflowRun> {
    if (this.api === null) {
      throw new Error('Studio API is not ready');
    }
    return this.api.startWorkflow(request);
  }
  async cancelWorkflow(id: string): Promise<StudioWorkflowRun> {
    if (this.api === null) {
      throw new Error('Studio API is not ready');
    }
    return this.api.cancelWorkflow(id);
  }
  listWorkflowRuns(): ReadonlyArray<StudioWorkflowRun> {
    if (this.api === null) {
      return [];
    }
    return this.api.listWorkflowRuns();
  }
  getWorkflowRun(id: string): StudioWorkflowRun {
    if (this.api === null) {
      throw new Error(`Workflow run not found: ${id}`);
    }
    return this.api.getWorkflowRun(id);
  }
  listWorkflowHistory(limit = 20): ReadonlyArray<StudioWorkflowRun> {
    if (this.api === null) {
      return [];
    }
    return this.api.listWorkflowHistory(limit);
  }
}

/**
 * Adapts the resolved {@link Runtime} to the UI-facing {@link RuntimeClient}.
 * Reads are truthful provider state; mutating actions delegate to the Runtime and
 * therefore become real Studio Events. When the browser-safe Runtime is in place
 * (no Node executor) those actions throw — the UI must route them to the Nova
 * backend, never fake them.
 */
class KernelRuntimeClient implements RuntimeClient {
  private readonly getRuntime: () => Runtime | null;

  constructor(getRuntime: () => Runtime | null) {
    this.getRuntime = getRuntime;
  }

  private current(): Runtime {
    const runtime = this.getRuntime();
    if (runtime === null) {
      throw new Error('Runtime is not ready');
    }
    return runtime;
  }

  async getAwareness(): Promise<RuntimeAwareness> {
    return this.current().awareness();
  }

  async refresh(): Promise<void> {
    await this.current().refreshAll();
  }

  async runTests(): Promise<{ passed: number; failed: number; total: number } | null> {
    try {
      const result = await this.current().runTests();
      return { passed: result.passed, failed: result.failed, total: result.total };
    } catch {
      return null;
    }
  }

  async restartBuild(): Promise<{ failed: boolean } | null> {
    try {
      const result = await this.current().restartBuild();
      return { failed: result.failed };
    } catch {
      return null;
    }
  }

  async getModifiedFiles(): Promise<ReadonlyArray<string>> {
    const git = this.current().git;
    await git.refresh();
    return git.getModifiedFiles();
  }

  async openTerminal(command: string, args: ReadonlyArray<string> = []): Promise<void> {
    await this.current().openTerminal(command, args);
  }
}
