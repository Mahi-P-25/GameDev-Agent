import type { Disposable } from '@gamedev-agent/shared';
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

/**
 * Truthful workspace awareness, derived entirely from real Runtime observations
 * (git branch, dirty tree, package manager, build/test state). Never assumed.
 */
export interface RuntimeAwareness {
  readonly workspaceRoot: string;
  readonly branch: string | null;
  readonly dirty: boolean;
  readonly packageManager: string;
  readonly buildState: string | null;
  readonly testState: string | null;
  readonly lastOpenedFile: string | null;
  readonly health: string;
}

/**
 * The Runtime surface the Command Center and Presence UI may call. Every action
 * executes *through* the Runtime providers, so each side effect becomes a real
 * Studio Event — nothing is faked. Reads are safe in the browser (pure
 * provider status); mutating actions resolve to no-ops/throws when the browser
 * executor is in place, and run for real in the Nova backend.
 */
export interface RuntimeClient {
  /** A truthful snapshot of the workspace (branch, build/test state, …). */
  getAwareness(): Promise<RuntimeAwareness>;
  /** Refresh real environment state (git, package manager). */
  refresh(): Promise<void>;
  /** Run the project's real test command. */
  runTests(): Promise<{ passed: number; failed: number; total: number } | null>;
  /** Restart the project's real build. */
  restartBuild(): Promise<{ failed: boolean } | null>;
  /** Show current modified files (observed git status). */
  getModifiedFiles(): Promise<ReadonlyArray<string>>;
  /** Open a terminal session (no-op in browser; real in backend). */
  openTerminal(command: string, args?: ReadonlyArray<string>): Promise<void>;
}

/**
 * The stable surface the Nova Studio UI depends on.
 *
 * Frontends NEVER import backend packages directly. They consume this client,
 * which today is backed by an in-browser {@link StudioApi} instance (the kernel
 * is booted with the Coordinator / Capabilities / Project / Studio API modules).
 *
 * Keeping the UI behind this interface means a future deployment can swap the
 * implementation for an HTTP client that talks to a remote Studio API without
 * touching a single component. Every method returns the plain DTOs defined by
 * `@gamedev-agent/studio-api` — the single contract the UI may rely on.
 */
export interface StudioApiClient {
  readonly ready: boolean;

  getWorkspace(): StudioWorkspace;
  listProjects(): ReadonlyArray<StudioProjectSummary>;
  getProject(id: string): StudioProject;
  listMissions(): ReadonlyArray<StudioMission>;
  getMission(id: string): StudioMission;
  listCapabilities(): ReadonlyArray<StudioCapability>;
  getHealth(): StudioHealth;
  getCoordinatorStatus(): StudioCoordinatorStatus;
  /** The live development context (what the Director is working on now). */
  getContext(): StudioContext;
  /**
   * The full Studio Home aggregate — a single projection of every subsystem's
   * current truth (goal, mission/coordinator status, planner status, workflow
   * status, live context, recent activity). The Studio Presence system renders
   * from this.
   */
  getStudioHome(): StudioHome;
  /** Subscribe to the normalized activity stream. Returns a disposer. */
  onActivity(handler: (activity: StudioActivity) => void): Disposable;
  /** Switch the active project; returns the updated context. */
  setActiveProject(id: string): Promise<StudioContext>;
  /** Record the file the Director is actively editing; returns the updated context. */
  setActiveFile(file: string): Promise<StudioContext>;
  /** Clear the context back to onboarding; returns the updated context. */
  resetContext(): Promise<StudioContext>;
  getActivity(limit?: number): ReadonlyArray<StudioActivity>;

  // --- development workflows ------------------------------------------------

  /** All runnable Development Workflow templates. */
  listWorkflowTemplates(): ReadonlyArray<StudioWorkflowTemplate>;
  /** Start a named Development Workflow against a project. */
  startWorkflow(request: StartWorkflowRequest): Promise<StudioWorkflowRun>;
  /** Cancel a running Development Workflow. */
  cancelWorkflow(id: string): Promise<StudioWorkflowRun>;
  /** Every Development Workflow run (running + finished), oldest → newest. */
  listWorkflowRuns(): ReadonlyArray<StudioWorkflowRun>;
  /** A single Development Workflow run by id. */
  getWorkflowRun(id: string): StudioWorkflowRun;
  /** Most recent finished Development Workflow runs (History). */
  listWorkflowHistory(limit?: number): ReadonlyArray<StudioWorkflowRun>;

  // --- runtime (truthful workspace awareness + actions) ----------------------

  /** The Nova Runtime surface — real workspace awareness and command actions. */
  readonly runtime: RuntimeClient;
}
