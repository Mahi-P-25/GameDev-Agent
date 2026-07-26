import type { MissionId, ProjectId } from '@gamedev-agent/coordinator';
import type { Brand, Timestamp, UUID } from '@gamedev-agent/shared';
import type { WorkflowState } from './WorkflowState';

export type { MissionId, ProjectId };
export type { WorkflowState } from './WorkflowState';

/**
 * Nova Workflow Engine — domain model and future-integration contracts.
 *
 * The Workflow Engine coordinates execution of **approved Mission Trees**. The
 * Producer proposes Mission Trees; the Coordinator owns the Mission lifecycle;
 * the Workflow Engine decides *what runs, in what order, and under which control
 * signals* (pause, resume, cancel, retry). It does not propose work, does not
 * reason about memory or knowledge, and does not itself execute a single step
 * of real work — step execution is delegated to a future Execution Engine /
 * Role System through interfaces defined here.
 *
 * This module defines:
 *  - The {@link WorkflowStep} and {@link WorkflowDefinition} model.
 *  - The {@link WorkflowPlan} — the concrete, dependency-ordered execution plan
 *    the engine derives from a definition (or an approved Mission Tree).
 *  - The {@link WorkflowExecution} aggregate — a single run of a plan.
 *  - **Future-integration interfaces** (`WorkflowExecutor`, `StepExecutor`,
 *    `WorkflowSource`) that later packages (Execution Engine, Role System,
 *    Planner) implement. They are interfaces only — no execution is implemented
 *    here.
 */

/** Branded workflow identifier. Plain string at runtime, distinct at the type level. */
export type WorkflowId = Brand<UUID, 'WorkflowId'>;

/** Branded step identifier (unique within a workflow definition). */
export type WorkflowStepId = Brand<string, 'WorkflowStepId'>;

/** Branded execution identifier (a single run of a plan). */
export type WorkflowExecutionId = Brand<UUID, 'WorkflowExecutionId'>;

/**
 * How a workflow runs its steps. `sequential` executes one step at a time in
 * topological order; `parallel` is a forward-looking mode where independent
 * steps (no dependency edges between them) may be dispatched concurrently. The
 * engine is built to support both; only `sequential` is exercised by the
 * execution surface today (see README — "Future parallel execution").
 */
export type WorkflowExecutionMode = 'sequential' | 'parallel';

/**
 * A single unit of work inside a workflow definition. Steps are declarative:
 * they name the *capability* and (optionally) the *role* they need, plus their
 * dependencies. The Workflow Engine never executes them — it orders and gates
 * them, and the future Execution Engine performs the real work.
 */
export interface WorkflowStep {
  /** Stable id, unique within the owning workflow definition. */
  readonly id: WorkflowStepId;
  /** Human-readable title shown in studio surfaces. */
  readonly title: string;
  /** Free-form description of the work this step represents. */
  readonly description: string;
  /**
   * The capability this step consumes (e.g. `code-generation`, `3d-modeling`,
   * `test-runner`). Used for future execution dispatch and capability gating.
   */
  readonly requiredCapability?: string;
  /** The role kind this step is expected to need (future Role System). */
  readonly requiredRole?: string;
  /**
   * Ids of steps that must complete before this step may begin. Declared
   * against the owning definition's step ids. The engine validates these
   * against the definition and fails planning on dangling/cyclic references.
   */
  readonly dependsOn: ReadonlyArray<WorkflowStepId>;
  /** Arbitrary, JSON-serializable metadata for future subsystems. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/**
 * A reusable, named recipe for executing a class of approved work. Workflows are
 * stored in the {@link WorkflowRegistry} (versioned, not hardcoded) so new
 * execution strategies are *registered*, not patched into the engine.
 */
export interface WorkflowDefinition {
  /** Stable, unique workflow key (e.g. `create-feature`, `fix-bug`). */
  readonly id: WorkflowId;
  /** Human-readable name. */
  readonly name: string;
  /** Free-form description of what this workflow achieves. */
  readonly description: string;
  /** Semantic version, enabling non-breaking evolution and caller pinning. */
  readonly version: string;
  /** How steps are scheduled. Defaults to `sequential` when materialized. */
  readonly mode: WorkflowExecutionMode;
  /** Every step the workflow may run. */
  readonly steps: ReadonlyArray<WorkflowStep>;
  /** Whether a single failing step fails the whole workflow (true) or only
   *  blocks its dependents (false). Defaults to true when materialized. */
  readonly failFast: boolean;
  /** Arbitrary, JSON-serializable metadata for future subsystems. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/**
 * A concrete, dependency-ordered execution plan the engine derives from a
 * {@link WorkflowDefinition} (or an approved {@link WorkflowSource} Mission
 * Tree). `order` is the canonical topological sequence; `concurrencyGroups`
 * partitions that order into waves of mutually-independent steps so the future
 * parallel runner can dispatch each wave concurrently.
 */
export interface WorkflowPlan {
  /** The definition this plan was derived from. */
  readonly definitionId: WorkflowId;
  /** Mode the plan was built under. */
  readonly mode: WorkflowExecutionMode;
  /** Topologically-sorted step ids; index 0 runs first. */
  readonly order: ReadonlyArray<WorkflowStepId>;
  /**
   * Waves of independent steps. Each group is an array of step ids that have no
   * dependency relationships *within the group*; groups run in array order. Under
   * `sequential` mode each group contains exactly one step. Under a future
   * `parallel` mode, a group may contain many.
   */
  readonly concurrencyGroups: ReadonlyArray<ReadonlyArray<WorkflowStepId>>;
  /** The resolved step map, keyed by id for O(1) lookup during execution. */
  readonly steps: ReadonlyMap<WorkflowStepId, WorkflowStep>;
  /** Per-step retry budget (attempts allowed, including the first). */
  readonly maxAttempts: number;
  readonly plannedAt: Timestamp;
}

/**
 * The state of a single step within a running {@link WorkflowExecution}.
 * Steps advance independently so the engine can pause/resume/cancel/retry at
 * step granularity.
 */
export type WorkflowStepState =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';

/** The immutable record for one step within a workflow execution run. */
export interface WorkflowStepRecord {
  readonly stepId: WorkflowStepId;
  readonly state: WorkflowStepState;
  /** Attempts made so far (1 = first try). */
  readonly attempts: number;
  /** Error detail when `state` is `failed`. */
  readonly error?: string;
  /** When the step started running. */
  readonly startedAt?: Timestamp;
  /** When the step reached a terminal local state. */
  readonly finishedAt?: Timestamp;
}

/**
 * A single run of a {@link WorkflowPlan}. The Workflow Engine owns this
 * aggregate from creation to completion/failure/cancellation. Instances are
 * produced by the {@link Workflow} factory and replaced (never mutated) on each
 * transition by the {@link WorkflowManager}.
 */
export interface WorkflowExecution {
  readonly id: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly projectId: ProjectId;
  /** The Mission this workflow was created from, if any (future Mission Tree). */
  readonly missionId: MissionId | null;
  readonly plan: WorkflowPlan;
  /** Overall lifecycle state of the run. */
  readonly state: WorkflowState;
  /** Whether forward progress is currently halted (pause signal). */
  readonly paused: boolean;
  /** Per-step progress, keyed by step id. */
  readonly steps: ReadonlyMap<WorkflowStepId, WorkflowStepRecord>;
  /** Index into `plan.order` of the next step to advance (sequential mode). */
  readonly cursor: number;
  /** Failure reason when `state` is `failed`. */
  readonly failureReason: string | null;
  /** Cancellation reason when `state` is `cancelled`. */
  readonly cancellationReason: string | null;
  /** 0–100 overall progress derived from completed steps. */
  readonly progress: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

/**
 * Strongly-typed request to create and plan a workflow execution from a
 * registered {@link WorkflowDefinition}.
 */
export interface WorkflowRequest {
  readonly projectId: ProjectId;
  /** The registered workflow definition key to instantiate. */
  readonly workflowId: WorkflowId;
  /** The Mission this execution is tied to (future approved Mission Tree). */
  readonly missionId?: MissionId | null;
  /** Override the execution mode for this run. */
  readonly mode?: WorkflowExecutionMode;
  /** Override the per-step retry budget for this run. */
  readonly maxAttempts?: number;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/**
 * A source of workflows the engine can plan and run. The Producer's approved
 * Mission Tree is the canonical source; this interface lets the engine accept
 * *any* tree-shaped, dependency-bearing proposal without the Workflow package
 * depending on the Producer. Implemented by the future Mission Tree adapter.
 */
export interface WorkflowSource {
  /** A stable identity for the source (e.g. a ProposalId). */
  readonly sourceId: string;
  readonly projectId: ProjectId;
  /** The Mission this source derives from, if any. */
  readonly missionId: MissionId | null;
  /** The steps to execute, already carrying dependency edges. */
  readonly steps: ReadonlyArray<WorkflowStep>;
  /** How the steps should be scheduled. */
  readonly mode: WorkflowExecutionMode;
  readonly failFast: boolean;
}

/**
 * The contract a future Execution Engine fulfils: given a step and its context,
 * perform the real work and report success or failure. The Workflow Engine never
 * implements this — it only calls it. Keeping the seam here means the engine is
 * complete and testable today, while execution plugs in later without redesign.
 */
export interface StepExecutor {
  execute(step: WorkflowStep, context: WorkflowStepContext): Promise<StepResult>;
}

/** Context handed to a {@link StepExecutor} for one step. */
export interface WorkflowStepContext {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly projectId: ProjectId;
  readonly missionId: MissionId | null;
  readonly attempt: number;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

/** The outcome a {@link StepExecutor} returns for one step attempt. */
export interface StepResult {
  readonly ok: boolean;
  readonly error?: string;
}

/** JSON-serializable value, re-declared locally to avoid a cross-package import cycle. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };
