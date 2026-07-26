import type { ProjectId } from '@gamedev-agent/project';
import type { Brand, Timestamp, UUID } from '@gamedev-agent/shared';

export type { ProjectId };

/**
 * Nova Studio Coordinator — domain model and future-integration contracts.
 *
 * The Coordinator is the orchestration entry point for every Mission. A Mission
 * is the unit of planned work the Creative Director directs Nova to perform; the
 * Coordinator *owns* its lifecycle and state but performs no implementation
 * itself. It coordinates Roles, requests approvals, and hands execution to a
 * future Execution subsystem.
 *
 * This module defines:
 *  - The {@link Mission} aggregate and its {@link MissionStatus} lifecycle.
 *  - The {@link MissionPriority} and metadata carriers.
 *  - **Future-integration interfaces** (`RoleRequirement`, `CapabilityRequirement`,
 *    `RoleAssignment`, `ApprovalRequest`, `MissionContext`, `ExecutionContext`)
 *    that later packages (Role System, Planner, Execution) implement. They are
 *    interfaces only — no Role/Planner/Execution code is implemented here.
 */

/** Branded mission identifier. Plain string at runtime, distinct at the type level. */
export type MissionId = Brand<UUID, 'MissionId'>;

/**
 * The complete Mission lifecycle, owned exclusively by the Coordinator.
 *
 * ```
 * submitted → accepted → analysing → waiting_for_approval → approved
 *          → ready → executing → reviewing → completed
 *                              ↘ failed | cancelled
 * ```
 *
 * Not every mission requires approval: a mission may move
 * `analysing → ready` directly when no approval gate is required.
 */
export type MissionStatus =
  | 'submitted'
  | 'accepted'
  | 'analysing'
  | 'waiting_for_approval'
  | 'approved'
  | 'ready'
  | 'executing'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Canonical lifecycle order, used for monotonic-progress checks and display. */
export const MISSION_LIFECYCLE: ReadonlyArray<MissionStatus> = [
  'submitted',
  'accepted',
  'analysing',
  'waiting_for_approval',
  'approved',
  'ready',
  'executing',
  'reviewing',
  'completed',
];

/** Terminal states from which no further transition is possible. */
export const MISSION_TERMINAL_STATES: ReadonlyArray<MissionStatus> = [
  'completed',
  'failed',
  'cancelled',
];

/** Mission urgency. Open set via the `string & {}` escape so new tiers can be added. */
export type MissionPriority = 'low' | 'normal' | 'high' | 'critical' | (string & {});

/**
 * A request for a unit of work, submitted by the Creative Director (or an
 * upstream system). The Coordinator validates and accepts it, then owns the
 * resulting {@link Mission}.
 */
export interface MissionRequest {
  /** The project this mission belongs to (scoping for memory, knowledge, roles). */
  readonly projectId: ProjectId;
  /** Human-readable title shown in studio surfaces. */
  readonly title: string;
  /** Free-form direction/brief from the Creative Director. */
  readonly brief: string;
  /** Optional explicit priority; defaults to `normal`. */
  readonly priority?: MissionPriority;
  /** Optional capabilities the mission is known to require up front. */
  readonly requiredCapabilities?: ReadonlyArray<CapabilityRequirement>;
  /** Arbitrary, JSON-serializable metadata for future subsystems. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

// --- Future-integration interfaces (implemented by later packages) --------

/**
 * A capability a mission needs (e.g. "code-generation", "3d-modeling",
 * "audio-mixing"). Roles declare which capabilities they satisfy; the future
 * Role System matches {@link RoleRequirement}s against available Roles. The
 * Coordinator only *records* requirements — it never resolves them.
 */
export interface CapabilityRequirement {
  /** Stable capability key (namespaced by extension where relevant). */
  readonly capability: string;
  /** Minimum proficiency the coordinator should request, if the role system supports it. */
  readonly minProficiency?: number;
}

/**
 * A single role the coordinator has determined a mission needs. The Coordinator
 * *derives* these (today from `requiredCapabilities`, tomorrow from the Planner)
 * and records them; it never instantiates or invokes a Role.
 */
export interface RoleRequirement {
  /** A role kind, e.g. `gameplay-engineer`, `technical-artist`. Stable identity. */
  readonly role: string;
  /** Capabilities this role is expected to satisfy for the mission. */
  readonly capabilities: ReadonlyArray<CapabilityRequirement>;
  /** Why the coordinator believes this role is required (for transparency). */
  readonly rationale?: string;
}

/**
 * A concrete assignment of a Role to a Mission. Produced by the future Role
 * System / Orchestrator, not by the Coordinator. The Coordinator stores it so
 * the rest of the lifecycle (and observers) can see who is responsible.
 */
export interface RoleAssignment {
  /** The role kind assigned. */
  readonly role: string;
  /** Optional concrete worker/agent id once the role system resolves one. */
  readonly assigneeId?: string;
  /** Capabilities this assignment covers. */
  readonly capabilities: ReadonlyArray<CapabilityRequirement>;
  /** When the assignment was made. */
  readonly assignedAt: Timestamp;
}

/**
 * A request for human (Creative Director) approval before a gated transition.
 * The Coordinator raises it and blocks progression until it is resolved.
 */
export interface ApprovalRequest {
  /** Stable id for correlating the request with its resolution. */
  readonly approvalId: UUID;
  /** The lifecycle transition this approval gates (e.g. `approved`). */
  readonly reason: string;
  /** Context the approver needs to make a decision. */
  readonly context?: MissionContext;
  /** When the request was raised. */
  readonly requestedAt: Timestamp;
}

/**
 * The immutable context a Mission carries: the project it belongs to, the brief,
 * and the requirements the coordinator derived. Future subsystems (Planner,
 * Roles) read this to do their work; the Coordinator owns its truth.
 */
export interface MissionContext {
  readonly missionId: MissionId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly brief: string;
  readonly priority: MissionPriority;
  readonly requiredCapabilities: ReadonlyArray<CapabilityRequirement>;
  readonly roleRequirements: ReadonlyArray<RoleRequirement>;
}

/**
 * The context handed to a future Execution subsystem when a Mission begins. The
 * Coordinator populates it from the Mission; it never executes anything itself.
 */
export interface ExecutionContext {
  readonly missionId: MissionId;
  readonly projectId: ProjectId;
  readonly assignments: ReadonlyArray<RoleAssignment>;
  /** Opaque execution plan produced by a future Planner; null until planned. */
  readonly plan: ExecutionPlan | null;
}

/**
 * A placeholder for the execution plan a future Planner will produce. The
 * Coordinator references it so it can carry a plan into {@link ExecutionContext}
 * without owning planning logic.
 */
export interface ExecutionPlan {
  readonly planId: UUID;
  readonly steps: ReadonlyArray<ExecutionStep>;
}

/** A single planned step. Structure only — no execution semantics here. */
export interface ExecutionStep {
  readonly stepId: string;
  readonly description: string;
  readonly requiredCapability?: string;
}

// --- The Mission aggregate ---------------------------------------------------

/**
 * The Mission aggregate — the unit of planned work the Coordinator owns from
 * submission to completion/failure/cancellation. Instances are produced by
 * {@link Coordinator} and replaced (never mutated) on each transition by the
 * {@link CoordinatorManager}.
 */
export interface Mission {
  readonly id: MissionId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly brief: string;
  readonly priority: MissionPriority;
  readonly status: MissionStatus;
  /** Requirements the coordinator derived/recorded. */
  readonly roleRequirements: ReadonlyArray<RoleRequirement>;
  /** Concrete role assignments (populated by the future Role System). */
  readonly assignments: ReadonlyArray<RoleAssignment>;
  /** Pending approval request, if the mission is awaiting a gate. */
  readonly approval: ApprovalRequest | null;
  /** Execution context, populated when execution begins. */
  readonly execution: ExecutionContext | null;
  /** 0–100 progress reported by a future Execution subsystem. */
  readonly progress: number;
  /** Failure reason when status is `failed`. */
  readonly failureReason: string | null;
  /** Cancellation reason when status is `cancelled`. */
  readonly cancellationReason: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

/** JSON-serializable value, re-declared locally to avoid a cross-package import cycle. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };
