import type {
  CapabilityDescriptor,
  CapabilityHealth,
  CapabilityManager,
  CapabilityPermission,
} from '@gamedev-agent/capabilities';
import { ContextManager } from '@gamedev-agent/context';
import type {
  CoordinatorManager,
  Mission,
  MissionId,
  MissionStatus,
} from '@gamedev-agent/coordinator';
import {
  MISSION_TERMINAL_STATES,
  MissionApprovalError,
  MissionNotFoundError,
  MissionStateError,
  MissionValidationError,
} from '@gamedev-agent/coordinator';
import { createServiceToken } from '@gamedev-agent/di';
import type { EventBusContract } from '@gamedev-agent/events';
import type { PlannerManager } from '@gamedev-agent/planner';
import type { ProducerManager } from '@gamedev-agent/producer';
import type { Project, ProjectManager } from '@gamedev-agent/project';
import { ProjectNotFoundError } from '@gamedev-agent/project';
import type { Disposable } from '@gamedev-agent/shared';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowId,
  WorkflowManager,
  WorkflowStep,
} from '@gamedev-agent/workflow';
import { ActivityFeed } from './ActivityFeed';
import type {
  CreateMissionRequest,
  CreateProjectRequest,
  StartWorkflowRequest,
  StudioActivity,
  StudioCapability,
  StudioContext,
  StudioCoordinatorStatus,
  StudioDependencyHealth,
  StudioHealth,
  StudioHome,
  StudioMission,
  StudioProject,
  StudioProjectSummary,
  StudioRoleRequirement,
  StudioWorkflowKind,
  StudioWorkflowRun,
  StudioWorkflowStep,
  StudioWorkflowTemplate,
  StudioWorkspace,
  UpdateProjectRequest,
} from './StudioApiContracts';
import { StudioApiError, StudioNotFoundError, StudioRejectionError } from './StudioApiErrors';
import { buildStudioHome } from './StudioHome';
import { DEV_WORKFLOW_IDS, type DevelopmentWorkflowKind } from './workflows/DevelopmentWorkflow';
import { RUNTIME_WORKFLOW_IDS } from './workflows/RuntimeWorkflow';
import type { WorkflowRunner } from './workflows/WorkflowRunner';

/** Options for constructing the Studio API façade. */
export interface StudioApiOptions {
  readonly coordinator: CoordinatorManager;
  readonly projects: ProjectManager;
  readonly capabilities: CapabilityManager;
  readonly producer: ProducerManager;
  readonly planner: PlannerManager;
  readonly workflow: WorkflowManager;
  readonly workflowRunner: WorkflowRunner;
  /** The live development context. Optional; a no-subscription manager is used
   *  when a caller (e.g. a unit test) does not supply one. */
  readonly context?: ContextManager;
  readonly bus: EventBusContract;
}

/**
 * The **Studio API** — the single, stable application façade every Nova
 * frontend (Desktop, Web, CLI, VS Code) must talk to.
 *
 * It owns *no* domain logic. It orchestrates the Coordinator, Projects, and
 * Capabilities subsystems, translates their internal models into the stable
 * DTOs in {@link StudioApiContracts}, and projects the shared Event Bus into a
 * single normalized {@link StudioActivity} stream. Frontends depend on this
 * class and these contracts — never on the subsystems directly.
 */
export class StudioApi implements Disposable {
  private readonly coordinator: CoordinatorManager;
  private readonly projects: ProjectManager;
  private readonly capabilities: CapabilityManager;
  private readonly producer: ProducerManager;
  private readonly planner: PlannerManager;
  private readonly workflow: WorkflowManager;
  private readonly workflowRunner: WorkflowRunner;
  private readonly context: ContextManager;
  private readonly bus: EventBusContract;
  private readonly feed: ActivityFeed;
  private disposed = false;

  constructor(options: StudioApiOptions) {
    this.coordinator = options.coordinator;
    this.projects = options.projects;
    this.capabilities = options.capabilities;
    this.producer = options.producer;
    this.planner = options.planner;
    this.workflow = options.workflow;
    this.workflowRunner = options.workflowRunner;
    this.context = options.context ?? new ContextManager({ eventBus: options.bus });
    this.bus = options.bus;
    this.feed = new ActivityFeed(this.bus);
  }

  // --- workspace / projects ------------------------------------------------

  /** Whole-workspace overview: counts, dependency readiness, overall readiness. */
  getWorkspace(): StudioWorkspace {
    const projectCount = this.projects.list().length;
    const missions = this.coordinator.list();
    const dependencies = this.dependencyHealth();
    const ready = dependencies.every((d) => d.status === 'up');
    return {
      projectCount,
      missionCount: missions.length,
      dependencies,
      ready,
    };
  }

  /**
   * The Studio Home aggregate — the single projection the Studio UI renders.
   *
   * It composes the Goals (Producer), the Plan (Planner), the Execution
   * (Workflow), and the Missions (Coordinator) panels over a live read of every
   * subsystem plus the normalized activity feed. This is the UI boundary of the
   * vertical slice: one call and the frontend has everything it needs, with the
   * bus keeping it fresh as the pipeline advances.
   */
  getStudioHome(): StudioHome {
    return buildStudioHome({
      producer: this.producer,
      planner: this.planner,
      workflow: this.workflow,
      coordinator: this.coordinator,
      context: this.context,
      activity: this.feed.recent(50),
    });
  }

  /**
   * The current development context — what the Creative Director is working on
   * right now. Surfaced so the Studio UI can show it on Home, drive "Continue
   * Working", auto-target Quick Actions at the active project, and offer project
   * switching without the Director repeating themselves.
   */
  getContext(): StudioContext {
    return this.contextSnapshot();
  }

  /**
   * Switch the active project. The Context Engine validates the id against the
   * Project subsystem and publishes a typed change event that re-renders Home.
   * Returns the updated context snapshot.
   */
  async setActiveProject(id: string): Promise<StudioContext> {
    await this.context.setProject(id);
    return this.contextSnapshot();
  }

  /**
   * Record the file the Creative Director is actively editing. Drives the
   * recent-files ring and the "Continue Working" surface.
   */
  async setActiveFile(file: string): Promise<StudioContext> {
    await this.context.setActiveFile(file);
    return this.contextSnapshot();
  }

  /**
   * Record the Git branch of the active project (future seam). The Version-Control
   * subsystem will feed this automatically once it lands.
   */
  async setBranch(branch: string): Promise<StudioContext> {
    await this.context.setBranch(branch);
    return this.contextSnapshot();
  }

  /**
   * Clear the context back to the onboarding (empty) state, e.g. when the
   * Creative Director wants a clean slate.
   */
  async resetContext(): Promise<StudioContext> {
    await this.context.reset();
    return this.contextSnapshot();
  }

  private contextSnapshot(): StudioContext {
    const current = this.context.current();
    return {
      onboarding: this.context.isOnboarding(),
      workspaceId: current.workspaceId === null ? null : String(current.workspaceId),
      projectId: current.projectId === null ? null : String(current.projectId),
      goalId: current.goalId === null ? null : String(current.goalId),
      missionId: current.missionId === null ? null : String(current.missionId),
      workflowId: current.workflowId === null ? null : String(current.workflowId),
      workflowExecutionId:
        current.workflowExecutionId === null ? null : String(current.workflowExecutionId),
      activeFile: current.activeFile === null ? null : String(current.activeFile),
      branch: current.branch === null ? null : String(current.branch),
      recentFiles: current.recentFiles.map((f) => String(f)),
      recentWorkflows: current.recentWorkflows.map((w) => String(w)),
      updatedAt: current.updatedAt,
    };
  }

  async createProject(request: CreateProjectRequest): Promise<StudioProject> {
    const init: Record<string, unknown> = {
      name: request.name,
      rootPath: request.rootPath,
    };
    if (request.description !== undefined) {
      init.description = request.description;
    }
    if (request.engine !== undefined) {
      init.engine = request.engine;
    }
    if (request.language !== undefined) {
      init.language = request.language;
    }
    if (request.targetPlatforms !== undefined) {
      init.targetPlatforms = request.targetPlatforms;
    }
    if (request.tags !== undefined) {
      init.tags = request.tags;
    }
    const project = await this.projects.create(init as never);
    return this.projectFrom(project);
  }

  async openProject(id: string): Promise<StudioProject> {
    const project = await this.projects.open(id as never);
    return this.projectFrom(project);
  }

  listProjects(): ReadonlyArray<StudioProjectSummary> {
    return this.projects.list().map((p) => this.projectSummaryFrom(p));
  }

  getProject(id: string): StudioProject {
    const project = this.projects.find(id as never);
    if (project === undefined) {
      throw new StudioNotFoundError('project', id);
    }
    return this.projectFrom(project);
  }

  async updateProject(id: string, patch: UpdateProjectRequest): Promise<StudioProject> {
    const next: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      next.name = patch.name;
    }
    if (patch.description !== undefined) {
      next.description = patch.description;
    }
    if (patch.rootPath !== undefined) {
      next.rootPath = patch.rootPath;
    }
    if (patch.engine !== undefined) {
      next.engine = patch.engine;
    }
    if (patch.language !== undefined) {
      next.language = patch.language;
    }
    if (patch.targetPlatforms !== undefined) {
      next.targetPlatforms = patch.targetPlatforms;
    }
    if (patch.tags !== undefined) {
      next.tags = patch.tags;
    }
    const updated = await this.projects.rename(id as never, next.name as string, next as never);
    return this.projectFrom(updated);
  }

  async closeProject(id: string): Promise<void> {
    await this.projects.close(id as never);
  }

  async deleteProject(id: string): Promise<void> {
    await this.projects.delete(id as never);
  }

  // --- missions ------------------------------------------------------------

  async createMission(request: CreateMissionRequest): Promise<StudioMission> {
    const request2: Record<string, unknown> = {
      projectId: request.projectId,
      title: request.title,
      brief: request.brief,
    };
    if (request.priority !== undefined) {
      request2.priority = request.priority;
    }
    const mission = await this.coordinator.submit(request2 as never);
    return this.missionFrom(mission);
  }

  async approveMission(id: string): Promise<StudioMission> {
    const mission = await this.coordinator.approve(id as MissionId);
    return this.missionFrom(mission);
  }

  async cancelMission(id: string, reason?: string): Promise<StudioMission> {
    const mission = await this.coordinator.cancel(id as MissionId, reason);
    return this.missionFrom(mission);
  }

  listMissions(): ReadonlyArray<StudioMission> {
    return this.coordinator.list().map((m) => this.missionFrom(m));
  }

  getMission(id: string): StudioMission {
    const mission = this.coordinator.find(id as MissionId);
    if (mission === undefined) {
      throw new StudioNotFoundError('mission', id);
    }
    return this.missionFrom(mission);
  }

  // --- capabilities --------------------------------------------------------

  listCapabilities(): ReadonlyArray<StudioCapability> {
    return this.capabilities.descriptors().map((d) => this.capabilityFrom(d));
  }

  getHealth(): StudioHealth {
    const descriptors = this.capabilities.descriptors();
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let unknown = 0;
    for (const d of descriptors) {
      const health = this.capabilities.healthOf(d.id);
      if (health === 'healthy') {
        healthy += 1;
      } else if (health === 'degraded') {
        degraded += 1;
      } else if (health === 'unhealthy') {
        unhealthy += 1;
      } else {
        unknown += 1;
      }
    }
    return {
      total: descriptors.length,
      healthy,
      degraded,
      unhealthy,
      unknown,
    };
  }

  // --- coordinator status --------------------------------------------------

  getCoordinatorStatus(): StudioCoordinatorStatus {
    const missions = this.coordinator.list();
    const byStatus: Record<string, number> = {};
    let active = 0;
    let terminal = 0;
    for (const m of missions) {
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
      if (MISSION_TERMINAL_STATES.includes(m.status as MissionStatus)) {
        terminal += 1;
      } else {
        active += 1;
      }
    }
    return {
      total: missions.length,
      byStatus,
      active,
      terminal,
    };
  }

  // --- activity feed -------------------------------------------------------

  /** The `limit` most recent normalized activities (oldest → newest). */
  getActivity(limit = 50): ReadonlyArray<StudioActivity> {
    return this.feed.recent(limit);
  }

  /** Subscribe to the normalized activity stream. Returns a disposer. */
  onActivity(handler: (activity: StudioActivity) => void): Disposable {
    return this.feed.subscribe(handler);
  }

  // --- development workflows ------------------------------------------------

  /** All runnable Development Workflow templates. */
  listWorkflowTemplates(): ReadonlyArray<StudioWorkflowTemplate> {
    return this.workflowRunner
      .listTemplates()
      .map((definition) => this.templateFrom(definition, this.kindOf(definition.id)));
  }

  /** Start a named Development Workflow against a project. Returns the new run. */
  async startWorkflow(request: StartWorkflowRequest): Promise<StudioWorkflowRun> {
    const kind = this.assertKind(request.kind);
    const execution = await this.workflowRunner.start({
      kind,
      projectId: request.projectId,
    });
    return this.runFrom(execution);
  }

  /** Cancel a running Development Workflow. */
  async cancelWorkflow(id: string): Promise<StudioWorkflowRun> {
    const execution = await this.workflowRunner.cancel(id);
    return this.runFrom(execution);
  }

  /** Every Development Workflow run, oldest → newest. */
  listWorkflowRuns(): ReadonlyArray<StudioWorkflowRun> {
    return this.workflowRunner.listRuns().map((execution) => this.runFrom(execution));
  }

  /** A single Development Workflow run by id. */
  getWorkflowRun(id: string): StudioWorkflowRun {
    const execution = this.workflowRunner.getRun(id);
    if (execution === undefined) {
      throw new StudioNotFoundError('workflow-run', id);
    }
    return this.runFrom(execution);
  }

  /** Most recent finished Development Workflow runs (History). */
  listWorkflowHistory(limit = 20): ReadonlyArray<StudioWorkflowRun> {
    return this.workflowRunner.history(limit).map((execution) => this.runFrom(execution));
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.feed.dispose();
  }

  // --- dependency boundary -------------------------------------------------

  private dependencyHealth(): ReadonlyArray<StudioDependencyHealth> {
    const capabilitiesUp = this.capabilities
      .descriptors()
      .every((d) => this.capabilities.healthOf(d.id) !== 'unhealthy');
    return [
      { name: 'coordinator', status: 'up' },
      { name: 'projects', status: 'up' },
      {
        name: 'capabilities',
        status: capabilitiesUp ? 'up' : 'degraded',
      },
      { name: 'event-bus', status: 'up' },
    ];
  }

  // --- internal → DTO translators -----------------------------------------

  private projectFrom(project: Project): StudioProject {
    return {
      id: String(project.id),
      name: project.name,
      description: project.description,
      rootPath: project.rootPath,
      engine: String(project.engine),
      language: project.language,
      targetPlatforms: project.targetPlatforms.map((p) => String(p)),
      status: String(project.status),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      tags: project.tags,
    };
  }

  private projectSummaryFrom(p: Project): StudioProjectSummary {
    return {
      id: String(p.id),
      name: p.name,
      description: p.description,
      status: String(p.status),
      updatedAt: p.updatedAt,
    };
  }

  private missionFrom(m: Mission): StudioMission {
    return {
      id: m.id,
      projectId: m.projectId,
      title: m.title,
      brief: m.brief,
      priority: m.priority,
      status: m.status,
      roleRequirements: m.roleRequirements.map((rr) => this.roleRequirementFrom(rr)),
      approvalPending: m.approval !== null,
      progress: m.progress,
      failureReason: m.failureReason,
      cancellationReason: m.cancellationReason,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  private roleRequirementFrom(rr: Mission['roleRequirements'][number]): StudioRoleRequirement {
    const requirement: { role: string; capabilities: ReadonlyArray<string>; rationale?: string } = {
      role: rr.role,
      capabilities: rr.capabilities.map((c) => c.capability),
    };
    if (rr.rationale !== undefined) {
      requirement.rationale = rr.rationale;
    }
    return requirement;
  }

  private capabilityFrom(d: CapabilityDescriptor): StudioCapability {
    const enabled = this.capabilities.isEnabled(d.id);
    const health: CapabilityHealth = this.capabilities.healthOf(d.id);
    return {
      id: String(d.id),
      name: d.name,
      description: d.description,
      category: String(d.category),
      permissions: d.permissions.map((p: CapabilityPermission) => String(p)),
      supportedPlatforms: d.supportedPlatforms.map((p) => String(p)),
      requiredTools: d.requiredTools.map((t) => String(t)),
      enabled,
      health,
    };
  }

  // --- workflow DTO translators ----------------------------------------------

  private kindOf(workflowId: WorkflowId): StudioWorkflowKind {
    if (workflowId === DEV_WORKFLOW_IDS['validate-project']) return 'validate-project';
    if (workflowId === DEV_WORKFLOW_IDS['inspect-project']) return 'inspect-project';
    if (workflowId === DEV_WORKFLOW_IDS['open-workspace']) return 'open-workspace';
    if (workflowId === RUNTIME_WORKFLOW_IDS['build-project']) return 'build-project';
    if (workflowId === RUNTIME_WORKFLOW_IDS['run-tests']) return 'run-tests';
    if (workflowId === RUNTIME_WORKFLOW_IDS['prepare-commit']) return 'prepare-commit';
    if (workflowId === RUNTIME_WORKFLOW_IDS['review-changes']) return 'review-changes';
    if (workflowId === RUNTIME_WORKFLOW_IDS['release-build']) return 'release-build';
    if (workflowId === RUNTIME_WORKFLOW_IDS['sync-dependencies']) return 'sync-dependencies';
    if (workflowId === RUNTIME_WORKFLOW_IDS['generate-documentation'])
      return 'generate-documentation';
    if (workflowId === RUNTIME_WORKFLOW_IDS['implement-feature']) return 'implement-feature';
    // Templates are always one of the known kinds; fall back defensively.
    return 'validate-project';
  }

  private assertKind(kind: StudioWorkflowKind): DevelopmentWorkflowKind {
    return kind as DevelopmentWorkflowKind;
  }

  private templateFrom(
    definition: WorkflowDefinition,
    kind: StudioWorkflowKind,
  ): StudioWorkflowTemplate {
    return {
      id: String(definition.id),
      kind,
      name: definition.name,
      description: definition.description,
      version: definition.version,
      steps: definition.steps.map((step: WorkflowStep) => step.title),
    };
  }

  private runFrom(execution: WorkflowExecution): StudioWorkflowRun {
    const steps: ReadonlyArray<StudioWorkflowStep> = [...execution.steps.values()].map((record) => {
      const stepDef = execution.plan.steps.get(record.stepId);
      return {
        stepId: String(record.stepId),
        title: stepDef?.title ?? String(record.stepId),
        state: record.state,
        attempts: record.attempts,
        ...(record.error !== undefined ? { error: record.error } : {}),
      };
    });
    return {
      id: String(execution.id),
      workflowId: String(execution.workflowId),
      kind: this.kindOf(execution.workflowId),
      projectId: String(execution.projectId),
      state: execution.state,
      paused: execution.paused,
      progress: execution.progress,
      steps,
      failureReason: execution.failureReason,
      cancellationReason: execution.cancellationReason,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
  }

  /** Translate an internal subsystem error into a stable Studio API error. */
  translate(error: unknown): StudioApiError {
    if (error instanceof StudioApiError) {
      return error;
    }

    if (error instanceof MissionNotFoundError) {
      return new StudioNotFoundError('mission', String(error.id));
    }
    if (error instanceof ProjectNotFoundError) {
      return new StudioNotFoundError('project', String(error.id));
    }
    if (error instanceof MissionValidationError) {
      const detail = error.violations.map((v) => `${v.field}: ${v.reason}`).join('; ');
      return new StudioRejectionError('mission.validation', detail, 'coordinator');
    }
    if (error instanceof MissionStateError || error instanceof MissionApprovalError) {
      const id = 'id' in error ? String((error as { id: MissionId }).id) : 'unknown';
      const reason =
        'reason' in error ? String((error as { reason: string }).reason) : error.message;
      return new StudioRejectionError('mission.state', `[${id}] ${reason}`, 'coordinator');
    }

    if (error instanceof Error) {
      return new StudioApiError(error.message, { cause: error });
    }
    return new StudioApiError('unknown studio api failure', { cause: error });
  }
}

/** DI token for the Studio API façade. */
export const STUDIO_API_TOKEN = createServiceToken<StudioApi>('nova.studio-api');
