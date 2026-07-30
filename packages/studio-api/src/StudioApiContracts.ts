/**
 * Studio API — Public Contracts (DTOs)
 * ===========================================================================
 *
 * THESE TYPES ARE THE ONLY SHAPE A NOVA FRONTEND MAY DEPEND ON.
 *
 * The façade in {@link StudioApi} is responsible for translating the internal
 * domain models of the Coordinator, Projects, and Capabilities subsystems into
 * these stable, presentation-oriented Data Transfer Objects. Frontends
 * (Desktop, Web, CLI, VS Code) import *this* file and never the subsystem
 * packages — that boundary is what lets the subsystems evolve without breaking
 * the UI.
 *
 * Rules:
 *  - No subsystem type appears here. These DTOs are self-contained.
 *  - They are plain, serializable data (no classes, no methods).
 *  - Keep them additive. Renaming a field is a breaking change for every
 *    frontend, so think twice.
 */

/** A capability's runtime health bucket. */
export type StudioHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

/** Required readiness state of a subsystem the façade talks to. */
export type StudioDependencyStatus = 'up' | 'degraded' | 'down';

/** High-level, frontend-facing view of the whole Studio workspace. */
export interface StudioWorkspace {
  /** Number of projects currently known to the Project subsystem. */
  readonly projectCount: number;
  /** Number of missions currently tracked by the Coordinator. */
  readonly missionCount: number;
  /** Aggregate readiness of every dependency the façade relies on. */
  readonly dependencies: ReadonlyArray<StudioDependencyHealth>;
  /** `true` only when every dependency reports `up`. */
  readonly ready: boolean;
}

/** A lightweight, list-friendly projection of a Project. */
export interface StudioProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly updatedAt: number;
}

/** The full, detail view of a single Project. */
export interface StudioProject {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rootPath: string;
  readonly engine: string;
  readonly language: string;
  readonly targetPlatforms: ReadonlyArray<string>;
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tags: ReadonlyArray<string>;
}

/** Payload to create a new project. */
export interface CreateProjectRequest {
  readonly name: string;
  readonly rootPath: string;
  readonly description?: string;
  readonly engine?: string;
  readonly language?: string;
  readonly targetPlatforms?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
}

/** Payload to update an existing project. */
export interface UpdateProjectRequest {
  readonly name?: string;
  readonly description?: string;
  readonly rootPath?: string;
  readonly engine?: string;
  readonly language?: string;
  readonly targetPlatforms?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
}

/** Payload to create (submit) a new mission. */
export interface CreateMissionRequest {
  readonly projectId: string;
  readonly title: string;
  readonly brief: string;
  readonly priority?: string;
}

/** A role the Coordinator believes a mission needs. */
export interface StudioRoleRequirement {
  readonly role: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly rationale?: string;
}

/** A coordinator mission, translated into a presentation-friendly shape. */
export interface StudioMission {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly brief: string;
  readonly priority: string;
  readonly status: string;
  readonly roleRequirements: ReadonlyArray<StudioRoleRequirement>;
  readonly approvalPending: boolean;
  readonly progress: number;
  readonly failureReason: string | null;
  readonly cancellationReason: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A capability the Studio can offer, translated for discovery/UI. */
export interface StudioCapability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly permissions: ReadonlyArray<string>;
  readonly supportedPlatforms: ReadonlyArray<string>;
  readonly requiredTools: ReadonlyArray<string>;
  readonly enabled: boolean;
  readonly health: StudioHealthStatus;
}

/** Aggregate health of every capability. */
export interface StudioHealth {
  readonly total: number;
  readonly healthy: number;
  readonly degraded: number;
  readonly unhealthy: number;
  readonly unknown: number;
}

/** Readiness of one dependency the façade depends on. */
export interface StudioDependencyHealth {
  readonly name: string;
  readonly status: StudioDependencyStatus;
  readonly detail?: string;
}

/** A single, normalized entry in the Studio Activity feed. */
export interface StudioActivity {
  /** Monotonic sequence number within this façade instance. */
  readonly seq: number;
  /** Stable discriminator, e.g. `mission.submitted`, `project.created`. */
  readonly kind: string;
  /** Human-readable, already-localized-ready message. */
  readonly message: string;
  /** Event timestamp (ms since epoch). */
  readonly timestamp: number;
  /** Present when the activity concerns a mission. */
  readonly missionId?: string;
  /** Present when the activity concerns a project. */
  readonly projectId?: string;
  /** Present when the activity concerns a goal. */
  readonly goalId?: string;
}

/** A coordinator status snapshot derived from tracked missions. */
export interface StudioCoordinatorStatus {
  readonly total: number;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly active: number;
  readonly terminal: number;
}

/** Lifecycle status of a Goal as tracked by the Producer. */
export type StudioGoalStatus =
  | 'submitted'
  | 'analysing'
  | 'objectives_generated'
  | 'mission_tree_generated'
  | 'review_package_generated'
  | 'waiting_for_approval'
  | 'approved'
  | 'rejected';

/** The current Goal the Studio is working on, surfaced for Studio Home. */
export interface StudioGoal {
  /** Present when a goal is being worked (the most recently submitted goal). */
  readonly goalId: string | null;
  readonly title: string | null;
  readonly status: StudioGoalStatus | null;
  readonly proposalId: string | null;
}

/** Snapshot of the Planning Engine's activity, surfaced for Studio Home. */
export interface StudioPlannerStatus {
  /** Number of execution plans produced so far. */
  readonly planCount: number;
  /** The most recently produced plan, if any. */
  readonly lastPlan: {
    readonly planId: string;
    readonly proposalId: string;
    readonly strategy: string;
    readonly mode: string;
    readonly phaseCount: number;
    readonly stepCount: number;
    readonly phases: ReadonlyArray<{ readonly index: number; readonly title: string }>;
  } | null;
}

/** A phase of the current execution plan, surfaced for Studio Home. */
export interface StudioExecutionPhase {
  readonly index: number;
  readonly title: string;
  /** `true` when this phase is the one currently executing. */
  readonly active: boolean;
  /** `true` once every step in the phase has completed. */
  readonly done: boolean;
}

/** Snapshot of the Workflow Engine's activity, surfaced for Studio Home. */
export interface StudioWorkflowStatus {
  /** Number of workflow executions created so far. */
  readonly executionCount: number;
  /** The most recently created/active execution, if any. */
  readonly current: {
    readonly executionId: string;
    readonly state: string;
    readonly progress: number;
    readonly stepCount: number;
    readonly mode: string;
  } | null;
  /** Phases of the plan backing the current execution. */
  readonly phases: ReadonlyArray<StudioExecutionPhase>;
}

/**
 * The complete, self-contained Studio Home view. This is the single object the
 * Studio UI renders on its landing screen — it aggregates the Goal, Mission
 * status, current execution phase, and the Planner / Workflow / Coordinator
 * statuses into one stable shape. It refreshes automatically as the event-driven
 * pipeline advances, so the UI re-renders from this DTO without polling internals.
 */
export interface StudioHome {
  readonly goal: StudioGoal;
  readonly missionStatus: StudioCoordinatorStatus;
  readonly plannerStatus: StudioPlannerStatus;
  readonly workflowStatus: StudioWorkflowStatus;
  readonly coordinatorStatus: StudioCoordinatorStatus;
  readonly context: StudioContext;
  readonly activity: ReadonlyArray<StudioActivity>;
}

// --- Development Workflows ---------------------------------------------------

/** Stable discriminator for every workflow template Nova can run. */
export type StudioWorkflowKind =
  | 'validate-project'
  | 'inspect-project'
  | 'open-workspace'
  | 'create-project'
  | 'build-project'
  | 'run-tests'
  | 'prepare-commit'
  | 'review-changes'
  | 'release-build'
  | 'sync-dependencies'
  | 'generate-documentation'
  | 'implement-feature';

/** A registered, runnable Development Workflow template. */
export interface StudioWorkflowTemplate {
  /** Stable template id (e.g. `nova.dev-workflow.validate-project`). */
  readonly id: string;
  /** Discriminator the UI switches on for icons / labels. */
  readonly kind: StudioWorkflowKind;
  /** Human-readable name. */
  readonly name: string;
  /** What the workflow does. */
  readonly description: string;
  /** Semantic version. */
  readonly version: string;
  /** Ordered step titles, for display. */
  readonly steps: ReadonlyArray<string>;
}

/** Lifecycle state of a Development Workflow run. */
export type StudioWorkflowRunState =
  | 'created'
  | 'planned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** A single step's live state within a Development Workflow run. */
export interface StudioWorkflowStep {
  /** Stable step id within the run. */
  readonly stepId: string;
  /** Human-readable title. */
  readonly title: string;
  /** `pending | running | succeeded | failed | skipped | cancelled`. */
  readonly state: string;
  /** Attempts made so far. */
  readonly attempts: number;
  /** Present when the step failed. */
  readonly error?: string;
}

/** A Development Workflow run (execution) surfaced to the Studio UI. */
export interface StudioWorkflowRun {
  /** Execution id. */
  readonly id: string;
  /** Template id this run was created from. */
  readonly workflowId: string;
  /** Discriminator of the template. */
  readonly kind: StudioWorkflowKind;
  /** Project the run operated on. */
  readonly projectId: string;
  /** Lifecycle state. */
  readonly state: StudioWorkflowRunState;
  /** `true` while forward progress is paused (not a separate state). */
  readonly paused: boolean;
  /** 0–100 overall progress. */
  readonly progress: number;
  /** Per-step progress. */
  readonly steps: ReadonlyArray<StudioWorkflowStep>;
  /** Failure reason when `state` is `failed`. */
  readonly failureReason: string | null;
  /** Cancellation reason when `state` is `cancelled`. */
  readonly cancellationReason: string | null;
  /** Event time the run was created (ms since epoch). */
  readonly createdAt: number;
  /** Event time the run was last updated (ms since epoch). */
  readonly updatedAt: number;
}

/** Request to start a Development Workflow from the Studio UI. */
export interface StartWorkflowRequest {
  /** Which Development Workflow template to run. */
  readonly kind: StudioWorkflowKind;
  /** The project the workflow operates on. */
  readonly projectId: string;
}

// --- Current Context --------------------------------------------------------

/**
 * The live development context, surfaced so the Studio Home always shows what
 * the Creative Director is working on — no repeated "which project?" questions.
 * Every field mirrors the Context Engine's {@link CurrentContext} snapshot.
 */
export interface StudioContext {
  /** Whether the studio is in the onboarding (no project) state. */
  readonly onboarding: boolean;
  /** The currently selected workspace id, or `null` when none is active. */
  readonly workspaceId: string | null;
  /** The active project id, or `null` when none is active. */
  readonly projectId: string | null;
  /** The Creative Director's current goal id, or `null`. */
  readonly goalId: string | null;
  /** The mission currently being worked, or `null`. */
  readonly missionId: string | null;
  /** The selected workflow definition id, or `null`. */
  readonly workflowId: string | null;
  /** The workflow execution currently running, or `null`. */
  readonly workflowExecutionId: string | null;
  /** The file the Director is actively editing, or `null`. */
  readonly activeFile: string | null;
  /** The Git branch of the active project, or `null` (future seam). */
  readonly branch: string | null;
  /** Most-recently-touched files, newest first. */
  readonly recentFiles: ReadonlyArray<string>;
  /** Most-recently-used workflows, newest first. */
  readonly recentWorkflows: ReadonlyArray<string>;
  /** Event time the context was last mutated. */
  readonly updatedAt: number;
}
