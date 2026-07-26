import { MissionSubmitted } from '@gamedev-agent/coordinator';
import type { EventBusContract } from '@gamedev-agent/events';
import type { EventDefinition } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { GoalApproved, GoalSubmitted, MissionProposalReady } from '@gamedev-agent/producer';
import { ProjectCreated, ProjectDeleted, ProjectOpened } from '@gamedev-agent/project';
import type { Disposable } from '@gamedev-agent/shared';
import { WorkflowCreated, WorkflowStarted } from '@gamedev-agent/workflow';
import { WorkspaceCreated, WorkspaceOpened } from '@gamedev-agent/workspace';
import { ContextNotFoundError } from './ContextErrors';
import {
  ContextActiveFileChanged,
  ContextBranchChanged,
  ContextChanged,
  ContextGoalChanged,
  ContextInitialized,
  ContextMissionChanged,
  ContextProjectChanged,
  ContextRecentFileAdded,
  ContextRecentWorkflowAdded,
  ContextReset,
  ContextWorkflowChanged,
  ContextWorkspaceChanged,
} from './ContextEvents';
import { ContextFactory } from './ContextFactory';
import { ContextHistory } from './ContextHistory';
import { ContextRegistry } from './ContextRegistry';
import type { ContextInit, CurrentContext } from './ContextTypes';

/**
 * Options for constructing the {@link ContextManager}.
 *
 * Cross-subsystem existence checks are injected (never imported) so the manager
 * can validate references against the Workspace, Projects, Producer, Coordinator,
 * and Workflow subsystems without depending on their internals — exactly the
 * public-token boundary the architecture mandates.
 */
export interface ContextManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly factory?: ContextFactory;
  readonly registry?: ContextRegistry;
  readonly history?: ContextHistory;
  /** Returns `true` when the workspace is known to the Workspace subsystem. */
  readonly workspaceExists?: ((id: string) => boolean) | undefined;
  /** Returns `true` when the project is known to the Project subsystem. */
  readonly projectExists?: ((id: string) => boolean) | undefined;
  /** Returns `true` when the goal is known to the Producer. */
  readonly goalExists?: ((id: string) => boolean) | undefined;
  /** Returns `true` when the mission is known to the Coordinator. */
  readonly missionExists?: ((id: string) => boolean) | undefined;
  /** Returns `true` when the workflow definition is known to the Workflow engine. */
  readonly workflowExists?: ((id: string) => boolean) | undefined;
}

/**
 * The Context Engine orchestrator. It is the single point of integration between
 * the domain (factory + registry + history) and Nova's shared infrastructure
 * (the Event Bus and Logger) and the other subsystems it observes.
 *
 * Responsibilities:
 *  - Hold the live {@link CurrentContext} singleton and expose it everywhere.
 *  - Apply explicit context changes (set project, file, branch, …) and emit typed
 *    events for each, plus a consolidated {@link ContextChanged} snapshot.
 *  - React to subsystem events (project opened, goal submitted, mission/ workflow
 *    created) so the context stays current without the Creative Director repeating
 *    themselves.
 *  - Validate every reference against the owning subsystem via injected checks.
 *
 * The manager depends on abstractions and injected predicates only. It is
 * `Disposable` so it can be registered into the kernel's DI container.
 */
export class ContextManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly factory: ContextFactory;
  private readonly registry: ContextRegistry;
  private readonly history: ContextHistory;
  private readonly workspaceExists: ((id: string) => boolean) | undefined;
  private readonly projectExists: ((id: string) => boolean) | undefined;
  private readonly goalExists: ((id: string) => boolean) | undefined;
  private readonly missionExists: ((id: string) => boolean) | undefined;
  private readonly workflowExists: ((id: string) => boolean) | undefined;
  private readonly disposers: Array<Disposable> = [];
  private started = false;
  private disposed = false;

  constructor(options: ContextManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.context', [new ConsoleLogSink()]);
    this.factory = options.factory ?? new ContextFactory();
    this.registry = options.registry ?? new ContextRegistry();
    this.history = options.history ?? new ContextHistory();
    this.workspaceExists = options.workspaceExists;
    this.projectExists = options.projectExists;
    this.goalExists = options.goalExists;
    this.missionExists = options.missionExists;
    this.workflowExists = options.workflowExists;
  }

  // --- lifecycle -------------------------------------------------------------

  /**
   * Subscribe to the subsystem event streams. Must be called once the kernel has
   * reached the `running` stage so the bus is fully wired. Idempotent.
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.subscribe(WorkspaceCreated, (p) => {
      this.setWorkspaceSilently(p.workspaceId);
    });
    this.subscribe(WorkspaceOpened, (p) => {
      this.setWorkspaceSilently(p.workspaceId);
    });
    this.subscribe(ProjectCreated, (p) => {
      this.setProjectSilently(p.projectId);
    });
    this.subscribe(ProjectOpened, (p) => {
      this.setProjectSilently(p.projectId);
    });
    this.subscribe(ProjectDeleted, (p) => {
      const current = this.currentOrInit();
      if (current.projectId === p.projectId) {
        void this.setProject(null);
      }
    });
    this.subscribe(GoalSubmitted, (p) => {
      this.setGoalSilently(p.goalId);
    });
    this.subscribe(GoalApproved, (p) => {
      this.setGoalSilently(p.goalId);
    });
    this.subscribe(MissionProposalReady, (p) => {
      this.setGoalSilently(p.goalId);
    });
    this.subscribe(MissionSubmitted, (p) => {
      if (this.currentOrInit().projectId === p.projectId) {
        this.setMissionSilently(p.missionId);
      }
    });
    this.subscribe(WorkflowCreated, (_p) => {
      /* a definition became available; nothing to activate until it is run */
    });
    this.subscribe(WorkflowStarted, (p) => {
      this.setWorkflowSilently(p.workflowId, p.executionId);
    });

    this.logger.info('context.started', {});
  }

  // --- current context -------------------------------------------------------

  /** The live context, initializing the onboarding (empty) state on first read. */
  current(): CurrentContext {
    return this.currentOrInit();
  }

  /** Fetch the live context, or `undefined` when none has ever been established. */
  find(): CurrentContext | undefined {
    return this.registry.current();
  }

  /**
   * Explicitly (re)establish the context. Used for deep-linking and boot restore.
   * Validates every non-null reference against the owning subsystem.
   */
  async initialize(init: ContextInit = {}): Promise<CurrentContext> {
    this.assertReferences(init);
    const context = this.factory.initialize(init);
    this.registry.add(context);
    this.logger.info('context.initialized', {
      hasProject: context.projectId !== null,
      hasWorkspace: context.workspaceId !== null,
    });
    await this.bus.publish(ContextInitialized, {
      contextId: context.id,
      hasProject: context.projectId !== null,
      hasWorkspace: context.workspaceId !== null,
      timestamp: Date.now(),
    });
    await this.publishChanged(['*'], context);
    return context;
  }

  // --- explicit setters ------------------------------------------------------

  /** Set (or clear with `null`) the active workspace. */
  async setWorkspace(id: string | null): Promise<CurrentContext> {
    if (id !== null && this.workspaceExists !== undefined && !this.workspaceExists(id)) {
      throw new ContextNotFoundError('workspaceId', id);
    }
    return this.applyPatch({ workspaceId: (id ?? null) as never }, 'workspaceId', 'workspaceId');
  }

  /** Set (or clear with `null`) the active project. */
  async setProject(id: string | null): Promise<CurrentContext> {
    if (id !== null && this.projectExists !== undefined && !this.projectExists(id)) {
      throw new ContextNotFoundError('projectId', id);
    }
    return this.applyPatch({ projectId: (id ?? null) as never }, 'projectId', 'projectId');
  }

  /** Set (or clear with `null`) the current goal. */
  async setGoal(id: string | null): Promise<CurrentContext> {
    if (id !== null && this.goalExists !== undefined && !this.goalExists(id)) {
      throw new ContextNotFoundError('goalId', id);
    }
    return this.applyPatch({ goalId: (id ?? null) as never }, 'goalId', 'goalId');
  }

  /** Set (or clear with `null`) the current mission. */
  async setMission(id: string | null): Promise<CurrentContext> {
    if (id !== null && this.missionExists !== undefined && !this.missionExists(id)) {
      throw new ContextNotFoundError('missionId', id);
    }
    return this.applyPatch({ missionId: (id ?? null) as never }, 'missionId', 'missionId');
  }

  /** Set (or clear with `null`) the selected workflow definition. */
  async setWorkflow(id: string | null): Promise<CurrentContext> {
    if (id !== null && this.workflowExists !== undefined && !this.workflowExists(id)) {
      throw new ContextNotFoundError('workflowId', id);
    }
    return this.applyPatch({ workflowId: (id ?? null) as never }, 'workflowId', 'workflowId');
  }

  /** Set (or clear with `null`) the active file and push it onto recent files. */
  async setActiveFile(file: string | null): Promise<CurrentContext> {
    if (file === null) {
      return this.applyPatch({ activeFile: null }, 'activeFile', 'activeFile');
    }
    return this.touchFile(file);
  }

  /** Set (or clear with `null`) the Git branch of the active project. */
  async setBranch(branch: string | null): Promise<CurrentContext> {
    return this.applyPatch({ branch: (branch ?? null) as never }, 'branch', 'branch');
  }

  // --- recent tracking -------------------------------------------------------

  /** Record a file touch: updates activeFile and the recent-files ring. */
  async touchFile(file: string): Promise<CurrentContext> {
    const current = this.currentOrInit();
    const ordered = this.history.recordFile(current.recentFiles, file);
    const next = this.factory.withRecentFiles(current, ordered, file as never);
    this.registry.update(next);
    this.logger.info('context.file.touched', { file });
    await this.bus.publish(ContextActiveFileChanged, {
      contextId: next.id,
      previousActiveFile: current.activeFile,
      activeFile: next.activeFile,
      timestamp: Date.now(),
    });
    await this.bus.publish(ContextRecentFileAdded, {
      contextId: next.id,
      file: next.activeFile as never,
      recentFiles: next.recentFiles as never,
      timestamp: Date.now(),
    });
    await this.publishChanged(['activeFile', 'recentFiles'], next);
    return next;
  }

  /** Record a workflow use: updates workflowId and the recent-workflows ring. */
  async useWorkflow(id: string): Promise<CurrentContext> {
    if (this.workflowExists !== undefined && !this.workflowExists(id)) {
      throw new ContextNotFoundError('workflowId', id);
    }
    const current = this.currentOrInit();
    const ordered = this.history.recordWorkflow(current.recentWorkflows, id as never);
    const next = this.factory.withRecentWorkflows(current, ordered, id as never);
    this.registry.update(next);
    this.logger.info('context.workflow.used', { workflowId: id });
    await this.bus.publish(ContextWorkflowChanged, {
      contextId: next.id,
      previousWorkflowId: current.workflowId,
      workflowId: next.workflowId,
      timestamp: Date.now(),
    });
    await this.bus.publish(ContextRecentWorkflowAdded, {
      contextId: next.id,
      workflowId: id as never,
      recentWorkflows: next.recentWorkflows,
      timestamp: Date.now(),
    });
    await this.publishChanged(['workflowId', 'recentWorkflows'], next);
    return next;
  }

  // --- reset -----------------------------------------------------------------

  /** Reset the context to the onboarding (empty) state, preserving its id. */
  async reset(): Promise<CurrentContext> {
    const current = this.currentOrInit();
    const next = this.factory.reset(current);
    this.registry.update(next);
    this.logger.info('context.reset', {});
    await this.bus.publish(ContextReset, { contextId: next.id, timestamp: Date.now() });
    await this.publishChanged(['*'], next);
    return next;
  }

  // --- queries ---------------------------------------------------------------

  /** Whether the context has any project selected. */
  hasProject(): boolean {
    return this.currentOrInit().projectId !== null;
  }

  /** Whether the context is in the onboarding (empty) state. */
  isOnboarding(): boolean {
    const c = this.currentOrInit();
    return c.workspaceId === null && c.projectId === null;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const d of this.disposers.splice(0)) {
      d.dispose();
    }
    this.registry.clear();
  }

  // --- internals -------------------------------------------------------------

  private currentOrInit(): CurrentContext {
    const existing = this.registry.current();
    if (existing !== undefined) {
      return existing;
    }
    const created = this.factory.initialize();
    this.registry.add(created);
    return created;
  }

  private subscribe<T>(definition: EventDefinition<T>, handler: (payload: T) => void): void {
    const disposable = this.bus.subscribe(definition, (envelope) => {
      handler(envelope.payload);
    });
    this.disposers.push(disposable);
  }

  private async applyPatch(
    patch: Partial<ContextInit>,
    changedField: string,
    eventKey: string,
  ): Promise<CurrentContext> {
    const current = this.currentOrInit();
    const previous = { ...current };
    const next = this.factory.withPatch(current, patch);
    this.registry.update(next);
    await this.publishFieldEvent(eventKey, previous, next);
    await this.publishChanged([changedField], next);
    return next;
  }

  private async publishFieldEvent(
    eventKey: string,
    previous: CurrentContext,
    next: CurrentContext,
  ): Promise<void> {
    const base = { contextId: next.id, timestamp: Date.now() } as Record<string, unknown>;
    switch (eventKey) {
      case 'workspaceId':
        await this.bus.publish(ContextWorkspaceChanged, {
          ...base,
          previousWorkspaceId: previous.workspaceId,
          workspaceId: next.workspaceId,
        } as never);
        return;
      case 'projectId':
        await this.bus.publish(ContextProjectChanged, {
          ...base,
          previousProjectId: previous.projectId,
          projectId: next.projectId,
        } as never);
        return;
      case 'goalId':
        await this.bus.publish(ContextGoalChanged, {
          ...base,
          previousGoalId: previous.goalId,
          goalId: next.goalId,
        } as never);
        return;
      case 'missionId':
        await this.bus.publish(ContextMissionChanged, {
          ...base,
          previousMissionId: previous.missionId,
          missionId: next.missionId,
        } as never);
        return;
      case 'workflowId':
        await this.bus.publish(ContextWorkflowChanged, {
          ...base,
          previousWorkflowId: previous.workflowId,
          workflowId: next.workflowId,
        } as never);
        return;
      case 'activeFile':
        await this.bus.publish(ContextActiveFileChanged, {
          ...base,
          previousActiveFile: previous.activeFile,
          activeFile: next.activeFile,
        } as never);
        return;
      case 'branch':
        await this.bus.publish(ContextBranchChanged, {
          ...base,
          previousBranch: previous.branch,
          branch: next.branch,
        } as never);
        return;
      default:
        return;
    }
  }

  private async publishChanged(
    changedFields: ReadonlyArray<string>,
    context: CurrentContext,
  ): Promise<void> {
    await this.bus.publish(ContextChanged, {
      changedFields,
      context,
      timestamp: Date.now(),
    });
  }

  private setWorkspaceSilently(id: string): void {
    const current = this.currentOrInit();
    if (String(current.workspaceId) === id) {
      return;
    }
    void this.setWorkspace(id);
  }

  private setProjectSilently(id: string): void {
    const current = this.currentOrInit();
    if (String(current.projectId) === id) {
      return;
    }
    void this.setProject(id);
  }

  private setGoalSilently(id: string): void {
    const current = this.currentOrInit();
    if (String(current.goalId) === id) {
      return;
    }
    void this.setGoal(id);
  }

  private setMissionSilently(id: string): void {
    const current = this.currentOrInit();
    if (String(current.missionId) === id) {
      return;
    }
    void this.setMission(id);
  }

  private setWorkflowSilently(workflowId: string, executionId: string): void {
    const current = this.currentOrInit();
    if (
      String(current.workflowId) === workflowId &&
      String(current.workflowExecutionId) === executionId
    ) {
      return;
    }
    void this.applyPatch(
      { workflowId: workflowId as never, workflowExecutionId: executionId as never },
      'workflowId',
      'workflowId',
    );
  }

  private assertReferences(init: ContextInit): void {
    if (
      init.workspaceId !== undefined &&
      init.workspaceId !== null &&
      this.workspaceExists !== undefined &&
      !this.workspaceExists(String(init.workspaceId))
    ) {
      throw new ContextNotFoundError('workspaceId', String(init.workspaceId));
    }
    if (
      init.projectId !== undefined &&
      init.projectId !== null &&
      this.projectExists !== undefined &&
      !this.projectExists(String(init.projectId))
    ) {
      throw new ContextNotFoundError('projectId', String(init.projectId));
    }
  }
}
