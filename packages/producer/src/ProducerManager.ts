import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import { GoalRegistry } from './GoalRegistry';
import { Producer } from './Producer';
import { GoalStateError } from './ProducerErrors';
import {
  GoalAnalysing,
  GoalApprovalRequested,
  GoalApproved,
  GoalMissionTreeGenerated,
  GoalObjectivesGenerated,
  GoalRejected,
  GoalReviewPackageGenerated,
  GoalSubmitted,
  MissionProposalReady,
} from './ProducerEvents';
import { canTransition } from './ProducerState';
import type {
  Goal,
  GoalAnalysis,
  GoalId,
  GoalRequest,
  GoalStatus,
  MissionProposal,
  MissionTree,
} from './ProducerTypes';

/**
 * Orchestrates the Goal lifecycle and is the single point of integration between
 * the Producer domain (service + registry + state machine) and Nova's shared
 * infrastructure (the Event Bus and Logger).
 *
 * Responsibilities:
 *  - The full lifecycle surface: `submit → analyse → generateObjectives →
 *    generateMissionTree → generateReviewPackage → requestApproval → approve`,
 *    plus `reject`.
 *  - Guard every transition against {@link canTransition}, throwing
 *    {@link GoalStateError} on an illegal move.
 *  - Publish a strongly-typed event for every state change, and — on approval —
 *    emit `mission-proposal.ready` so the Coordinator receives the Mission Tree
 *    and decides execution. The Producer never creates Coordinator Missions.
 *  - Keep the registry and event emissions strictly consistent.
 *
 * Like the Coordinator, the manager depends only on abstractions
 * (`EventBusContract`, `Logger`) — never on Coordinator, Planner, Memory,
 * Knowledge, or Role packages — and owns no singleton; callers inject the
 * bus/logger (and can supply test doubles). It is `Disposable` for kernel-scoped
 * teardown.
 */
export interface ProducerManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly producer?: Producer;
  readonly registry?: GoalRegistry;
}

export class ProducerManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly producer: Producer;
  private readonly registry: GoalRegistry;
  private disposed = false;

  constructor(options: ProducerManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.producer', [new ConsoleLogSink()]);
    this.producer = options.producer ?? new Producer();
    this.registry = options.registry ?? new GoalRegistry();
  }

  /**
   * Submit a new Goal. Validates and stores it in `submitted`, then emits
   * `goal.submitted`. Throws `GoalValidationError` on invalid input.
   */
  async submit(request: GoalRequest): Promise<Goal> {
    const goal = this.producer.create(request);
    this.registry.add(goal);
    this.logger.info('goal.submitted', { id: goal.id, projectId: goal.projectId });
    await this.bus.publish(GoalSubmitted, {
      goalId: goal.id,
      projectId: goal.projectId,
      title: goal.title,
      priority: goal.priority,
      timestamp: this.now(),
    });
    return goal;
  }

  /** Begin analysis: `submitted → analysing`. Emits `goal.analysing`. */
  async analyse(id: GoalId): Promise<Goal> {
    const next = this.move(id, 'analysing');
    await this.bus.publish(GoalAnalysing, { goalId: next.id, timestamp: this.now() });
    return next;
  }

  /**
   * Produce Objectives and Milestones from the analysis:
   * `analysing → objectives_generated`. Attaches the {@link GoalAnalysis} to the
   * goal and emits `goal.objectives-generated`.
   */
  async generateObjectives(id: GoalId): Promise<Goal> {
    const current = this.require(id);
    if (!canTransition(current.status, 'objectives_generated')) {
      throw new GoalStateError(id, current.status, 'objectives_generated');
    }
    const analysis: GoalAnalysis = this.producer.analyze(current);
    const next = this.move(id, 'objectives_generated', { analysis });
    await this.bus.publish(GoalObjectivesGenerated, {
      goalId: next.id,
      analysis,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Build the Mission Tree from the analysis:
   * `objectives_generated → mission_tree_generated`. Attaches the
   * {@link MissionTree} and emits `goal.mission-tree-generated`.
   */
  async generateMissionTree(id: GoalId): Promise<Goal> {
    const current = this.require(id);
    if (!canTransition(current.status, 'mission_tree_generated')) {
      throw new GoalStateError(id, current.status, 'mission_tree_generated');
    }
    if (current.analysis === null) {
      throw new GoalStateError(id, current.status, 'mission_tree_generated');
    }
    const missionTree: MissionTree = this.producer.buildMissionTree(current, current.analysis);
    const next = this.move(id, 'mission_tree_generated', { missionTree });
    await this.bus.publish(GoalMissionTreeGenerated, {
      goalId: next.id,
      missionTree,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Assemble the reviewable proposal + approval package:
   * `mission_tree_generated → review_package_generated`. Attaches the
   * {@link MissionProposal} and emits `goal.review-package-generated`.
   */
  async generateReviewPackage(id: GoalId): Promise<Goal> {
    const current = this.require(id);
    if (!canTransition(current.status, 'review_package_generated')) {
      throw new GoalStateError(id, current.status, 'review_package_generated');
    }
    if (current.analysis === null || current.missionTree === null) {
      throw new GoalStateError(id, current.status, 'review_package_generated');
    }
    const proposal: MissionProposal = this.producer.buildProposal(
      current,
      current.analysis,
      current.missionTree,
    );
    const next = this.move(id, 'review_package_generated', { proposal });
    await this.bus.publish(GoalReviewPackageGenerated, {
      goalId: next.id,
      approvalPackage: proposal.approvalPackage,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Raise the approval gate: `review_package_generated → waiting_for_approval`.
   * Emits `goal.approval-requested` carrying the {@link ApprovalPackage}.
   */
  async requestApproval(id: GoalId): Promise<Goal> {
    const current = this.require(id);
    if (current.proposal === null) {
      throw new GoalStateError(id, current.status, 'waiting_for_approval');
    }
    const next = this.move(id, 'waiting_for_approval');
    await this.bus.publish(GoalApprovalRequested, {
      goalId: next.id,
      approvalPackage: current.proposal.approvalPackage,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Approve the proposal: `waiting_for_approval → approved`. Emits `goal.approved`
   * and, critically, `mission-proposal.ready` — the handoff by which the
   * Coordinator *receives* the Mission Tree and decides execution. The Producer
   * never creates Coordinator Missions itself.
   */
  async approve(id: GoalId, approver?: string): Promise<Goal> {
    const current = this.require(id);
    if (!canTransition(current.status, 'approved')) {
      throw new GoalStateError(id, current.status, 'approved');
    }
    if (current.proposal === null) {
      throw new GoalStateError(id, current.status, 'approved');
    }
    const proposal = current.proposal;
    const next = this.move(id, 'approved');
    await this.bus.publish(GoalApproved, {
      goalId: next.id,
      proposal,
      approver,
      timestamp: this.now(),
    });
    await this.bus.publish(MissionProposalReady, {
      goalId: next.id,
      projectId: next.projectId,
      proposal,
      timestamp: this.now(),
    });
    this.logger.info('mission-proposal.ready', { id: next.id, proposalId: proposal.id });
    return next;
  }

  /**
   * Reject the goal from any active analysis phase. Records the reason,
   * transitions to `rejected`, and emits `goal.rejected`.
   */
  async reject(id: GoalId, reason: string): Promise<Goal> {
    const next = this.move(id, 'rejected', { rejectionReason: reason });
    await this.bus.publish(GoalRejected, {
      goalId: next.id,
      reason,
      timestamp: this.now(),
    });
    return next;
  }

  /** List every tracked goal (insertion order). */
  list(): ReadonlyArray<Goal> {
    return this.registry.list();
  }

  /** Fetch a goal by id, or `undefined` when absent. */
  find(id: GoalId): Goal | undefined {
    return this.registry.find(id);
  }

  /** Fetch a goal by id, throwing {@link GoalNotFoundError} when absent. */
  get(id: GoalId): Goal {
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

  private require(id: GoalId): Goal {
    return this.registry.get(id);
  }

  /**
   * Guard and apply a lifecycle transition. Throws {@link GoalStateError} when
   * the move is illegal from the current status, then delegates to the service
   * (which re-validates immutably) and persists the result.
   */
  private move(id: GoalId, to: GoalStatus, patch: Partial<Goal> = {}): Goal {
    const current = this.require(id);
    if (!canTransition(current.status, to)) {
      throw new GoalStateError(id, current.status, to);
    }
    const next = this.producer.transition(current, to, patch);
    this.registry.update(next);
    this.logger.info('goal.transition', { id, from: current.status, to });
    return next;
  }

  private now(): Timestamp {
    return Date.now() as Timestamp;
  }
}
