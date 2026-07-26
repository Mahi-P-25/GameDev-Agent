import type { ProjectId } from '@gamedev-agent/project';
import type { Brand, Timestamp, UUID } from '@gamedev-agent/shared';

export type { ProjectId };

/**
 * Nova Producer — domain model and future-integration contracts.
 *
 * The Producer is **not** an AI model. It is a pure domain service that
 * transforms a Creative Director's high-level {@link Goal} ("I want realistic
 * Formula racing") into a structured, reviewable {@link MissionProposal}. The
 * Producer never creates Coordinator Missions directly — it *proposes* a
 * {@link MissionTree}; the Coordinator decides execution.
 *
 * This module defines:
 *  - The {@link Goal} aggregate and its {@link GoalStatus} lifecycle.
 *  - The analysis products: {@link GoalAnalysis}, {@link Objective},
 *    {@link Milestone}, {@link Dependency}.
 *  - The {@link MissionTree} of proposed (parent/child) {@link ProposedMission}
 *    nodes and the {@link MissionProposal} + {@link ApprovalPackage} handed to
 *    the Coordinator.
 *  - **Future-integration interfaces** the Planner, Memory, Knowledge, and Role
 *    System will fill. They are interfaces only — no LLM, Memory, Knowledge,
 *    Planner, or Role execution is implemented here.
 */

/** Branded goal identifier. Plain string at runtime, distinct at the type level. */
export type GoalId = Brand<UUID, 'GoalId'>;

/** Branded objective identifier. */
export type ObjectiveId = Brand<UUID, 'ObjectiveId'>;

/** Branded milestone identifier. */
export type MilestoneId = Brand<UUID, 'MilestoneId'>;

/** Branded proposed-mission identifier (distinct from a Coordinator MissionId). */
export type ProposedMissionId = Brand<UUID, 'ProposedMissionId'>;

/** Branded proposal identifier. */
export type ProposalId = Brand<UUID, 'ProposalId'>;

/**
 * The Goal lifecycle, owned exclusively by the Producer.
 *
 * ```
 * submitted → analysing → objectives_generated → mission_tree_generated
 *          → review_package_generated → waiting_for_approval → approved
 *                                                            ↘ rejected
 * ```
 *
 * `approved` is terminal for the Producer: at that point the Coordinator
 * receives the Mission Tree and owns execution. `rejected` is terminal too.
 */
export type GoalStatus =
  | 'submitted'
  | 'analysing'
  | 'objectives_generated'
  | 'mission_tree_generated'
  | 'review_package_generated'
  | 'waiting_for_approval'
  | 'approved'
  | 'rejected';

/** Canonical lifecycle order, used for progress ordering and display. */
export const GOAL_LIFECYCLE: ReadonlyArray<GoalStatus> = [
  'submitted',
  'analysing',
  'objectives_generated',
  'mission_tree_generated',
  'review_package_generated',
  'waiting_for_approval',
  'approved',
];

/** Terminal Goal states from which no further transition is possible. */
export const GOAL_TERMINAL_STATES: ReadonlyArray<GoalStatus> = ['approved', 'rejected'];

/** Goal urgency. Open set via the `string & {}` escape so new tiers can be added. */
export type GoalPriority = 'low' | 'normal' | 'high' | 'critical' | (string & {});

/** Relative priority for objectives, milestones, and proposed missions. */
export type Priority = GoalPriority;

/** A coarse complexity estimate the Producer attaches to proposed work. */
export type Complexity = 'trivial' | 'small' | 'moderate' | 'large' | 'epic';

/** Ordered complexity tiers, low → high, for scoring and comparison. */
export const COMPLEXITY_ORDER: ReadonlyArray<Complexity> = [
  'trivial',
  'small',
  'moderate',
  'large',
  'epic',
];

/**
 * A high-level description of desired outcome, submitted by the Creative
 * Director. The Director never creates Missions directly — they describe a Goal
 * and the Producer analyses it.
 */
export interface GoalRequest {
  /** The project this goal belongs to (scoping for memory, knowledge, roles). */
  readonly projectId: ProjectId;
  /** Human-readable title shown in studio surfaces. */
  readonly title: string;
  /** Free-form description of the desired outcome ("I want realistic Formula racing"). */
  readonly description: string;
  /** Optional explicit priority; defaults to `normal`. */
  readonly priority?: GoalPriority;
  /** Optional constraints the Director wants respected (budget, deadline, style). */
  readonly constraints?: ReadonlyArray<string>;
  /** Arbitrary, JSON-serializable metadata for future subsystems. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/**
 * The Goal aggregate — the unit of intent the Producer owns from submission to
 * approval. Instances are produced by {@link Producer} and replaced (never
 * mutated) on each transition by the {@link ProducerManager}. The analysis
 * products are attached as the lifecycle advances.
 */
export interface Goal {
  readonly id: GoalId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly description: string;
  readonly priority: GoalPriority;
  readonly status: GoalStatus;
  readonly constraints: ReadonlyArray<string>;
  /** Analysis produced during `analysing`; null until then. */
  readonly analysis: GoalAnalysis | null;
  /** The Mission Tree produced from the analysis; null until generated. */
  readonly missionTree: MissionTree | null;
  /** The reviewable proposal + approval package; null until generated. */
  readonly proposal: MissionProposal | null;
  /** Reason recorded when the goal is `rejected`. */
  readonly rejectionReason: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

// --- Analysis products -------------------------------------------------------

/**
 * The structured understanding the Producer derives from a Goal's free-form
 * description: the Objectives, Milestones, and the Roles/Capabilities the work
 * is expected to need. Today the derivation is a deterministic domain heuristic;
 * the future Planner (with Memory + Knowledge) will replace it with far richer
 * analysis without changing this shape.
 */
export interface GoalAnalysis {
  readonly goalId: GoalId;
  /** Distinct, addressable outcomes extracted from the goal. */
  readonly objectives: ReadonlyArray<Objective>;
  /** Ordered checkpoints that group objectives into deliverable phases. */
  readonly milestones: ReadonlyArray<Milestone>;
  /** Roles the Producer estimates the work requires. */
  readonly requiredRoles: ReadonlyArray<RoleEstimate>;
  /** Capabilities the Producer estimates the work requires. */
  readonly estimatedCapabilities: ReadonlyArray<CapabilityEstimate>;
  /** A brief, human-readable summary of the analysis for the approver. */
  readonly summary: string;
  readonly analysedAt: Timestamp;
}

/**
 * A distinct, addressable outcome the Goal decomposes into (e.g. "Vehicle
 * physics", "Track system", "AI opponents"). Objectives are the granularity at
 * which the Producer reasons about milestones and proposed missions.
 */
export interface Objective {
  readonly id: ObjectiveId;
  readonly title: string;
  readonly description: string;
  readonly priority: Priority;
  readonly complexity: Complexity;
  /** Capabilities this objective is expected to require. */
  readonly capabilities: ReadonlyArray<CapabilityEstimate>;
}

/**
 * A deliverable checkpoint grouping one or more {@link Objective}s. Milestones
 * establish coarse ordering ("foundations before content") that the Mission Tree
 * refines into concrete dependencies.
 */
export interface Milestone {
  readonly id: MilestoneId;
  readonly title: string;
  readonly description: string;
  /** Zero-based order of this milestone within the goal. */
  readonly order: number;
  /** Objectives delivered by this milestone. */
  readonly objectiveIds: ReadonlyArray<ObjectiveId>;
}

/**
 * A directed edge in the Mission Tree: `from` depends on `to` (i.e. `to` must be
 * satisfied before `from` can begin). The Producer records these so the
 * Coordinator can schedule work in a valid order.
 */
export interface Dependency {
  /** The dependent proposed mission (the one that waits). */
  readonly from: ProposedMissionId;
  /** The prerequisite proposed mission (the one that must come first). */
  readonly to: ProposedMissionId;
  /** Why this dependency exists (for transparency in the approval package). */
  readonly reason?: string;
}

// --- Mission Tree ------------------------------------------------------------

/**
 * A node in the {@link MissionTree}: a *proposed* mission the Producer suggests.
 * This is deliberately **not** a Coordinator `Mission` — the Producer never
 * creates Coordinator Missions. It carries enough structure (ordering, priority,
 * complexity, required roles/capabilities) for the Coordinator to decide
 * execution and, later, for the Planner to expand.
 */
export interface ProposedMission {
  readonly id: ProposedMissionId;
  /** Parent node id, or null for a root proposed mission. */
  readonly parentId: ProposedMissionId | null;
  readonly title: string;
  readonly brief: string;
  readonly priority: Priority;
  readonly complexity: Complexity;
  /** Execution order hint within the tree (lower runs earlier). */
  readonly order: number;
  /** The objective this proposed mission delivers, if any. */
  readonly objectiveId: ObjectiveId | null;
  /** The milestone this proposed mission belongs to, if any. */
  readonly milestoneId: MilestoneId | null;
  /** Roles the Producer estimates this proposed mission needs. */
  readonly requiredRoles: ReadonlyArray<RoleEstimate>;
  /** Capabilities the Producer estimates this proposed mission needs. */
  readonly requiredCapabilities: ReadonlyArray<CapabilityEstimate>;
}

/**
 * The tree of proposed missions the Producer hands to the Coordinator. It
 * supports parent/child nesting, cross-node {@link Dependency}s, an explicit
 * execution `order`, per-node priority, and per-node estimated complexity.
 *
 * The tree is validated for structural integrity (no dangling ids, no cycles)
 * before it is proposed — see {@link Producer.buildMissionTree}.
 */
export interface MissionTree {
  readonly goalId: GoalId;
  /** Every proposed mission node, keyed by id via {@link ProposedMission.id}. */
  readonly nodes: ReadonlyArray<ProposedMission>;
  /** Root node ids (nodes with no parent). */
  readonly rootIds: ReadonlyArray<ProposedMissionId>;
  /** Directed dependency edges between nodes. */
  readonly dependencies: ReadonlyArray<Dependency>;
  /** A valid topological execution order of node ids (respects dependencies). */
  readonly executionOrder: ReadonlyArray<ProposedMissionId>;
  readonly generatedAt: Timestamp;
}

// --- Proposal & approval -----------------------------------------------------

/**
 * The complete, reviewable package the Producer emits for a Goal. The Coordinator
 * receives this — not raw Missions — and decides execution. It bundles the
 * analysis, the Mission Tree, and an {@link ApprovalPackage} summarizing the
 * decision the Creative Director is being asked to make.
 */
export interface MissionProposal {
  readonly id: ProposalId;
  readonly goalId: GoalId;
  readonly projectId: ProjectId;
  readonly analysis: GoalAnalysis;
  readonly missionTree: MissionTree;
  readonly approvalPackage: ApprovalPackage;
  readonly createdAt: Timestamp;
}

/**
 * The human-facing summary the Creative Director approves or rejects. It rolls
 * up the proposal into the few facts a decision needs: how much work, in how
 * many phases, needing which roles, and the estimated overall complexity.
 */
export interface ApprovalPackage {
  readonly goalId: GoalId;
  readonly proposalId: ProposalId;
  readonly title: string;
  readonly summary: string;
  /** Total number of proposed missions in the tree. */
  readonly missionCount: number;
  /** Total number of milestones. */
  readonly milestoneCount: number;
  /** Total number of objectives. */
  readonly objectiveCount: number;
  /** Distinct roles the proposal estimates are required. */
  readonly requiredRoles: ReadonlyArray<RoleEstimate>;
  /** Distinct capabilities the proposal estimates are required. */
  readonly estimatedCapabilities: ReadonlyArray<CapabilityEstimate>;
  /** The aggregate estimated complexity of the whole proposal. */
  readonly estimatedComplexity: Complexity;
  readonly preparedAt: Timestamp;
}

// --- Future-integration interfaces (filled by later packages) ----------------

/**
 * A capability the Producer estimates a piece of work needs (e.g.
 * "vehicle-physics", "3d-modeling", "audio-mixing"). This is an *estimate*: the
 * future Planner + Knowledge subsystems will refine it. The Producer never
 * resolves capabilities to concrete workers.
 */
export interface CapabilityEstimate {
  /** Stable capability key (namespaced by extension where relevant). */
  readonly capability: string;
  /** Confidence in the estimate, 0–1. Defaults to a heuristic value. */
  readonly confidence: number;
}

/**
 * A role the Producer estimates a piece of work needs (e.g. `gameplay-engineer`,
 * `technical-artist`). Estimates only — the future Role System resolves and
 * assigns concrete Roles; the Producer merely predicts them for planning.
 */
export interface RoleEstimate {
  /** A role kind, e.g. `gameplay-engineer`. Stable identity. */
  readonly role: string;
  /** Capabilities this role is expected to satisfy. */
  readonly capabilities: ReadonlyArray<CapabilityEstimate>;
  /** Why the Producer believes this role is required (for transparency). */
  readonly rationale?: string;
}

/**
 * The context the Producer hands to the Coordinator alongside a proposal. The
 * Coordinator reads this to decide execution; future subsystems (Planner,
 * Memory, Knowledge, Roles) read it to do their work. The Producer owns its
 * truth and never executes anything itself.
 */
export interface ProposalContext {
  readonly goalId: GoalId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly description: string;
  readonly priority: GoalPriority;
  readonly proposal: MissionProposal;
}

/** JSON-serializable value, re-declared locally to avoid a cross-package import cycle. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };
