import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';
import { Coordinator } from './Coordinator';
import { MissionApprovalError, MissionStateError } from './CoordinatorErrors';
import {
  MissionAccepted,
  MissionAnalysing,
  MissionApprovalRequested,
  MissionApproved,
  MissionCancelled,
  MissionCompleted,
  MissionExecutionPaused,
  MissionExecutionStarted,
  MissionFailed,
  MissionReady,
  MissionReviewing,
  MissionSubmitted,
} from './CoordinatorEvents';
import { canTransition } from './CoordinatorState';
import type {
  ApprovalRequest,
  ExecutionContext,
  ExecutionPlan,
  Mission,
  MissionId,
  MissionRequest,
  MissionStatus,
  RoleAssignment,
} from './CoordinatorTypes';
import { MissionRegistry } from './MissionRegistry';

/**
 * Orchestrates the Mission lifecycle and is the single point of integration
 * between the Coordinator domain (factory + registry + state machine) and Nova's
 * shared infrastructure (the Event Bus and Logger).
 *
 * Responsibilities:
 *  - The full lifecycle surface: `submit → accept → analyse →
 *    requestApproval/approve → markReady → startExecution → review → complete`,
 *    plus `fail`, `cancel`, `pauseExecution`, `reportProgress`, and
 *    `assignRole`.
 *  - Guard every transition against {@link canTransition}, throwing
 *    {@link MissionStateError} on an illegal move.
 *  - Publish a strongly-typed event for every state change.
 *  - Keep the registry and event emissions strictly consistent.
 *
 * Like the Project System, the manager depends only on abstractions
 * (`EventBusContract`, `Logger`) — never on Roles, Planner, or Execution
 * packages — and owns no singleton; callers inject the bus/logger (and can
 * supply test doubles). It is `Disposable` for kernel-scoped teardown.
 */
export interface CoordinatorManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly coordinator?: Coordinator;
  readonly registry?: MissionRegistry;
}

export class CoordinatorManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly coordinator: Coordinator;
  private readonly registry: MissionRegistry;
  private disposed = false;

  constructor(options: CoordinatorManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.coordinator', [new ConsoleLogSink()]);
    this.coordinator = options.coordinator ?? new Coordinator();
    this.registry = options.registry ?? new MissionRegistry();
  }

  /**
   * Submit a new mission. Validates and stores it in `submitted`, then emits
   * `mission.submitted`. Throws `MissionValidationError` on invalid input.
   */
  async submit(request: MissionRequest): Promise<Mission> {
    const mission = this.coordinator.create(request);
    this.registry.add(mission);
    this.logger.info('mission.submitted', { id: mission.id, projectId: mission.projectId });
    await this.bus.publish(MissionSubmitted, {
      missionId: mission.id,
      projectId: mission.projectId,
      title: mission.title,
      priority: mission.priority,
      timestamp: this.now(),
    });
    return mission;
  }

  /** Accept a submitted mission: `submitted → accepted`. Emits `mission.accepted`. */
  async accept(id: MissionId): Promise<Mission> {
    const next = this.move(id, 'accepted');
    await this.bus.publish(MissionAccepted, {
      missionId: next.id,
      projectId: next.projectId,
      roleRequirements: next.roleRequirements,
      timestamp: this.now(),
    });
    return next;
  }

  /** Begin analysis: `accepted → analysing`. Emits `mission.analysing`. */
  async analyse(id: MissionId): Promise<Mission> {
    const next = this.move(id, 'analysing');
    await this.bus.publish(MissionAnalysing, { missionId: next.id, timestamp: this.now() });
    return next;
  }

  /**
   * Raise an approval gate: `analysing → waiting_for_approval`. Records an
   * {@link ApprovalRequest} on the mission and emits `mission.approval-requested`.
   */
  async requestApproval(id: MissionId, reason = 'approval required'): Promise<Mission> {
    const current = this.require(id);
    const approval: ApprovalRequest = {
      approvalId: this.coordinator.generateId(),
      reason,
      context: this.coordinator.contextOf(current),
      requestedAt: this.now(),
    };
    const next = this.move(id, 'waiting_for_approval', { approval });
    await this.bus.publish(MissionApprovalRequested, {
      missionId: next.id,
      approval,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Resolve the approval gate: `waiting_for_approval → approved`. Clears the
   * pending request and emits `mission.approved`. Throws
   * {@link MissionApprovalError} when no approval is pending.
   */
  async approve(id: MissionId, approver?: string): Promise<Mission> {
    const current = this.require(id);
    if (!canTransition(current.status, 'approved')) {
      throw new MissionStateError(id, current.status, 'approved');
    }
    if (current.approval === null) {
      throw new MissionApprovalError(id, 'no approval is pending');
    }
    const next = this.move(id, 'approved', { approval: null });
    await this.bus.publish(MissionApproved, {
      missionId: next.id,
      approver,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Mark a mission ready for execution. Supports both gated (`approved → ready`)
   * and ungated (`analysing → ready`) paths. Emits `mission.ready`.
   */
  async markReady(id: MissionId): Promise<Mission> {
    const next = this.move(id, 'ready');
    await this.bus.publish(MissionReady, { missionId: next.id, timestamp: this.now() });
    return next;
  }

  /**
   * Begin execution: `ready → executing`. Populates the {@link ExecutionContext}
   * that a future Execution subsystem consumes and emits
   * `mission.execution-started`. The Coordinator hands off context only — it runs
   * nothing itself.
   */
  async startExecution(
    id: MissionId,
    assignments: ReadonlyArray<RoleAssignment> = [],
    plan: ExecutionPlan | null = null,
  ): Promise<Mission> {
    const current = this.require(id);
    const merged = assignments.length > 0 ? assignments : current.assignments;
    const execution: ExecutionContext = {
      missionId: current.id,
      projectId: current.projectId,
      assignments: merged,
      plan,
    };
    const next = this.move(id, 'executing', { execution, assignments: merged });
    await this.bus.publish(MissionExecutionStarted, {
      missionId: next.id,
      execution,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Signal that execution has paused. This is an in-`executing` signal, not a
   * lifecycle state change: the status stays `executing` while progress is
   * recorded and `mission.execution-paused` is emitted so observers can react.
   */
  async pauseExecution(id: MissionId, progress?: number): Promise<Mission> {
    const current = this.require(id);
    if (current.status !== 'executing') {
      throw new MissionStateError(id, current.status, 'pauseExecution');
    }
    const value = clampProgress(progress ?? current.progress);
    const next: Mission = { ...current, progress: value, updatedAt: this.now() };
    this.registry.update(next);
    await this.bus.publish(MissionExecutionPaused, {
      missionId: next.id,
      progress: value,
      timestamp: this.now(),
    });
    return next;
  }

  /** Move into review: `executing → reviewing`. Emits `mission.reviewing`. */
  async review(id: MissionId): Promise<Mission> {
    const next = this.move(id, 'reviewing');
    await this.bus.publish(MissionReviewing, { missionId: next.id, timestamp: this.now() });
    return next;
  }

  /** Finish a mission: `reviewing → completed`. Emits `mission.completed`. */
  async complete(id: MissionId): Promise<Mission> {
    const next = this.move(id, 'completed', { progress: 100 });
    await this.bus.publish(MissionCompleted, { missionId: next.id, timestamp: this.now() });
    return next;
  }

  /**
   * Fail a mission from any active state. Records the reason, transitions to
   * `failed`, and emits `mission.failed`.
   */
  async fail(id: MissionId, reason: string): Promise<Mission> {
    const next = this.move(id, 'failed', { failureReason: reason });
    await this.bus.publish(MissionFailed, {
      missionId: next.id,
      reason,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Cancel a mission from any active state. Records the reason, transitions to
   * `cancelled`, and emits `mission.cancelled`.
   */
  async cancel(id: MissionId, reason = 'cancelled by director'): Promise<Mission> {
    const next = this.move(id, 'cancelled', { cancellationReason: reason });
    await this.bus.publish(MissionCancelled, {
      missionId: next.id,
      reason,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Record progress (0–100) for a mission under execution without changing its
   * status. Progress is monotonic: values below the current progress are ignored.
   */
  reportProgress(id: MissionId, progress: number): Mission {
    const current = this.require(id);
    const value = Math.max(current.progress, clampProgress(progress));
    if (value === current.progress) {
      return current;
    }
    const next: Mission = { ...current, progress: value, updatedAt: this.now() };
    this.registry.update(next);
    this.logger.debug('mission.progress', { id, progress: value });
    return next;
  }

  /**
   * Record a concrete {@link RoleAssignment} produced by the future Role System.
   * The Coordinator only stores it; it never resolves or invokes the role.
   */
  assignRole(id: MissionId, assignment: RoleAssignment): Mission {
    const current = this.require(id);
    const next: Mission = {
      ...current,
      assignments: [...current.assignments, assignment],
      updatedAt: this.now(),
    };
    this.registry.update(next);
    this.logger.info('mission.role-assigned', { id, role: assignment.role });
    return next;
  }

  /** List every tracked mission (insertion order). */
  list(): ReadonlyArray<Mission> {
    return this.registry.list();
  }

  /** Fetch a mission by id, or `undefined` when absent. */
  find(id: MissionId): Mission | undefined {
    return this.registry.find(id);
  }

  /** Fetch a mission by id, throwing {@link MissionNotFoundError} when absent. */
  get(id: MissionId): Mission {
    return this.require(id);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.registry.clear();
  }

  // --- internals ----------------------------------------------------------

  private require(id: MissionId): Mission {
    return this.registry.get(id);
  }

  /**
   * Guard and apply a lifecycle transition. Throws {@link MissionStateError}
   * when the move is illegal from the current status, then delegates to the
   * factory (which re-validates immutably) and persists the result.
   */
  private move(id: MissionId, to: MissionStatus, patch: Partial<Mission> = {}): Mission {
    const current = this.require(id);
    if (!canTransition(current.status, to)) {
      throw new MissionStateError(id, current.status, to);
    }
    const next = this.coordinator.transition(current, to, patch);
    this.registry.update(next);
    this.logger.info('mission.transition', { id, from: current.status, to });
    return next;
  }

  private now(): Timestamp {
    return Date.now() as Timestamp;
  }
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

export type { UUID };
