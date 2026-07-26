import type { MissionId } from '@gamedev-agent/coordinator';
import type {
  Dependency,
  GoalId,
  Milestone,
  MissionProposal,
  ProposalId,
  ProposedMission,
  ProposedMissionId,
} from '@gamedev-agent/producer';
import type { ProjectId } from '@gamedev-agent/project';
import type { Brand, Timestamp, UUID } from '@gamedev-agent/shared';
import type { WorkflowExecutionMode, WorkflowSource, WorkflowStep } from '@gamedev-agent/workflow';

export type { ProjectId };
export type { MissionId };
export type { Dependency, GoalId, Milestone, ProposalId };
export type { MissionProposal, ProposedMission, ProposedMissionId };
export type { WorkflowExecutionMode, WorkflowSource, WorkflowStep };

/**
 * Nova Planning Engine — domain model and future-integration contracts.
 *
 * The Planner is **not** an executor and **not** an AI model. It is a pure domain
 * service that transforms an *approved* Mission Tree (a {@link MissionProposal}
 * handed over by the Producer, via the Coordinator) into an **immutable**
 * {@link ExecutionPlan}. The plan answers "what is the best way to execute this
 * work?": it validates dependencies, groups related work, lays out execution
 * {@link ExecutionPhase}s, packs each phase with parallel-capable
 * {@link ExecutionGroup}s, estimates execution order, and records
 * {@link ExecutionConstraint}s.
 *
 * The Planner MUST NOT execute work. It produces a plan that the Workflow Engine
 * consumes (see {@link ExecutionPlan.toWorkflowSource}); the future Execution
 * Engine performs the real work. Like the Producer and Workflow, the Planner
 * depends only on abstractions and never calls an LLM.
 *
 * This module defines:
 *  - The {@link ExecutionPlan} aggregate and its parts: {@link ExecutionPhase},
 *    {@link ExecutionGroup}, {@link ExecutionConstraint}.
 *  - The per-plan {@link ExecutionStep} (a planned unit of work derived from a
 *    {@link ProposedMission}).
 *  - The {@link PlanningStrategy} interface and the evolution hooks (optimization,
 *    constraint scoring) that future AI-enhanced planning will fill.
 *  - **Future-integration interfaces** (Memory, Knowledge, Model Router, Role
 *    System, Execution Engine) declared here as contracts only.
 */

/** Branded plan identifier. Plain string at runtime, distinct at the type level. */
export type PlanId = Brand<UUID, 'PlanId'>;

/** Branded execution-phase identifier (unique within a plan). */
export type ExecutionPhaseId = Brand<string, 'ExecutionPhaseId'>;

/** Branded execution-group identifier (unique within a phase). */
export type ExecutionGroupId = Brand<string, 'ExecutionGroupId'>;

/** Branded execution-step identifier (unique within a plan). */
export type ExecutionStepId = Brand<string, 'ExecutionStepId'>;

/**
 * Scheduling hint for a group. `sequential` runs its steps one at a time;
 * `parallel` marks the steps as independently dispatchable — a future runner may
 * execute them concurrently. The Planner *encodes* the independence; it never
 * runs anything. Today the Workflow Engine honors `parallel` groups as waves.
 */
export type GroupMode = 'sequential' | 'parallel';

/**
 * A single planned unit of work inside an {@link ExecutionPlan}. Derived from a
 * Producer {@link ProposedMission}; carries the dependency edges (as planned-step
 * ids), the estimated role/capability needs, and the originating node id for
 * traceability back to the Mission Tree.
 */
export interface ExecutionStep {
  /** Stable, plan-unique id. */
  readonly id: ExecutionStepId;
  /** Human-readable title (from the proposed mission). */
  readonly title: string;
  /** Free-form description of the work (from the proposed mission brief). */
  readonly description: string;
  /**
   * Ids of planned steps that must complete before this step may begin. The
   * Planner validates these against the plan and fails planning on dangling or
   * cyclic references.
   */
  readonly dependsOn: ReadonlyArray<ExecutionStepId>;
  /** The role kind this step is expected to need (future Role System). */
  readonly requiredRole?: string;
  /** The capability this step consumes (future execution dispatch / gating). */
  readonly requiredCapability?: string;
  /** Complexity estimate inherited from the proposed mission. */
  readonly complexity?: string;
  /** The originating proposed-mission id (traceability to the Mission Tree). */
  readonly sourceMissionId: ProposedMissionId;
  /** Arbitrary, JSON-serializable metadata for future subsystems. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/**
 * A wave of mutually-independent steps within a phase. Under `sequential` mode a
 * group holds exactly one step; under `parallel` mode a group may hold many
 * steps that have no intra-group dependency and may be dispatched concurrently by
 * a future runner. Groups run in array order within their phase.
 */
export interface ExecutionGroup {
  readonly id: ExecutionGroupId;
  /** Scheduling hint. `parallel` marks the steps as independently dispatchable. */
  readonly mode: GroupMode;
  /** The planned steps in this group, in local order. */
  readonly stepIds: ReadonlyArray<ExecutionStepId>;
}

/**
 * A coarse, ordered chunk of execution — typically aligned to a Producer
 * {@link Milestone} or a goal-level checkpoint. Phases run in `order`; within a
 * phase, groups run in array order and may be parallel internally. A phase fails
 * the whole plan only when `failFast` is set and a step fails.
 */
export interface ExecutionPhase {
  readonly id: ExecutionPhaseId;
  /** Zero-based order of this phase within the plan. */
  readonly order: number;
  /** Human-readable title (usually the milestone title, or "Phase N"). */
  readonly title: string;
  /** Free-form description of what the phase delivers. */
  readonly description: string;
  /** The milestone this phase was grouped from, if any. */
  readonly milestoneId: string | null;
  /** Groups within this phase, in execution order. */
  readonly groups: ReadonlyArray<ExecutionGroup>;
  /** Whether a single failing step in this phase fails the whole plan. */
  readonly failFast: boolean;
}

/**
 * A declarative constraint the plan must respect during and after execution.
 * Constraints are *recorded* by the Planner (derived from the goal, the
 * dependencies, and the strategy); enforcement is delegated to the Workflow /
 * Execution Engine. The Planner never enforces them itself.
 */
export interface ExecutionConstraint {
  /** Stable constraint key (e.g. `dependency`, `capability`, `deadline`). */
  readonly kind: ExecutionConstraintKind;
  /** Human-readable description of what must hold. */
  readonly description: string;
  /** Steps this constraint concerns (empty = plan-wide). */
  readonly stepIds: ReadonlyArray<ExecutionStepId>;
  /** Arbitrary, JSON-serializable parameters (deadline ts, budget, policy). */
  readonly params?: Readonly<Record<string, JsonValue>>;
}

/** The vocabulary of constraint kinds the Planner can derive. */
export type ExecutionConstraintKind =
  | 'dependency'
  | 'capability'
  | 'role'
  | 'deadline'
  | 'budget'
  | 'approval-gate'
  | 'data-flow';

/**
 * The immutable output of the Planning Engine. Once built, a plan is never
 * mutated; the Workflow Engine reads it (and {@link toWorkflowSource}) to drive
 * execution. The plan is the single agreed contract between Planning and
 * Workflow — neither depends on the other's internals.
 */
export interface ExecutionPlan {
  readonly id: PlanId;
  /** The Mission Proposal this plan was derived from. */
  readonly proposalId: ProposalId;
  readonly goalId: GoalId;
  readonly projectId: ProjectId;
  /** The Mission this plan is tied to, if the Coordinator has created one. */
  readonly missionId: MissionId | null;
  /** The strategy that produced this plan (for auditability / future routing). */
  readonly strategy: string;
  /** Overall scheduling mode selected by the strategy. */
  readonly mode: WorkflowExecutionMode;
  /** Phases in execution order. */
  readonly phases: ReadonlyArray<ExecutionPhase>;
  /** Every step the plan may run, keyed by id for O(1) lookup. */
  readonly steps: ReadonlyMap<ExecutionStepId, ExecutionStep>;
  /** The canonical topological execution order of step ids (phase/group flatten). */
  readonly order: ReadonlyArray<ExecutionStepId>;
  /** Constraints the plan records (enforced downstream). */
  readonly constraints: ReadonlyArray<ExecutionConstraint>;
  /** 0–100 estimated confidence in the plan quality (strategy-dependent). */
  readonly confidence: number;
  readonly createdAt: Timestamp;
  /** Convert this immutable plan into a Workflow Engine source. */
  toWorkflowSource(): WorkflowSource;
}

/**
 * Strongly-typed request to plan an approved proposal. The Planner consumes the
 * *approved* Mission Tree — not raw goals. The Coordinator/Producer hand the
 * proposal over once `goal.approved` (see `mission-proposal.ready`).
 */
export interface PlanRequest {
  readonly proposal: MissionProposal;
  /** The Mission the Coordinator created for this proposal, if known. */
  readonly missionId?: MissionId | null;
  /** Override the planning strategy (defaults to the manager's configured one). */
  readonly strategy?: string;
  /** Override the global scheduling mode. */
  readonly mode?: WorkflowExecutionMode;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/**
 * A planning strategy decides *how* to turn a Mission Tree into an Execution Plan:
 * how to group, phase, and order the work, and which optimization to apply.
 *
 * Strategies are the seam for future AI-enhanced planning (see README). Today the
 * package ships a deterministic {@link DependencyGraphStrategy} (topological
 * phases + ready-set parallel groups). A future `ai-strategy` can implement this
 * same interface and be selected by name without changing the engine or the
 * Workflow consumer.
 */
export interface PlanningStrategy {
  /** Stable strategy key (e.g. `dependency-graph`, `ai-balanced`). */
  readonly name: string;
  /**
   * Build a plan from the proposal's Mission Tree. Must be pure and
   * deterministic given the same input (the deterministic clock/id come from the
   * engine). Throws {@link PlanValidationError} on structural problems.
   */
  build(context: StrategyContext): ExecutionPlan;
}

/** The immutable inputs a strategy receives from the engine. */
export interface StrategyContext {
  readonly planId: PlanId;
  readonly proposal: MissionProposal;
  readonly projectId: ProjectId;
  readonly missionId: MissionId | null;
  readonly mode: WorkflowExecutionMode;
  readonly createdAt: Timestamp;
}

// --- Future-integration interfaces (filled by later packages) ----------------

/**
 * A constraint/scoring signal the plan can request from Memory or Knowledge
 * without the Planner depending on them. The future Memory/Knowledge subsystems
 * implement this; the engine passes it to strategies that opt in. Declared here
 * so strategies can reference it; never called inside this package.
 */
export interface PlanningContextProvider {
  /** Enrich a proposed mission with historical/prior-art context. */
  enrich(mission: ProposedMission): Promise<Readonly<Record<string, JsonValue>>>;
}

/**
 * A hook the Model Router / Role System will use to assign a concrete role or
 * model to a planned step. Declared as a contract only — the Planner records the
 * *estimated* role/capability and leaves assignment to the future Role System.
 */
export interface StepAssignmentAdvisor {
  /** Suggest a role kind + capability for a planned step. */
  advise(step: ExecutionStep): { role: string; capability: string } | null;
}

/** JSON-serializable value, re-declared locally to avoid a cross-package import cycle. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };
