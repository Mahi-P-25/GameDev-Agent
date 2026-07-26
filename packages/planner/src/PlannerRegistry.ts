import type { Disposable } from '@gamedev-agent/shared';
import { PlanNotFoundError } from './PlannerErrors';
import type { ExecutionPlan, PlanId, ProposalId } from './PlannerTypes';

/**
 * Tracks planned {@link ExecutionPlan}s. Responsibilities (and nothing more):
 * store plans by id, and index them by the proposal they were derived from so a
 * Coordinator/Workflow lookup is O(1). It emits no events and never touches the
 * Event Bus, Logger, or filesystem — keeping planning bookkeeping testable and
 * fast, and letting the {@link PlannerManager} own all orchestration (events,
 * integration, strategy selection).
 */
export class PlannerRegistry implements Disposable {
  private readonly planMap = new Map<string, ExecutionPlan>();
  private readonly byProposal = new Map<string, PlanId>();

  /** Store a plan. Overwrites any prior plan for the same id. */
  add(plan: ExecutionPlan): void {
    this.planMap.set(plan.id, plan);
    this.byProposal.set(plan.proposalId, plan.id);
  }

  /** Fetch a plan by id, or throw {@link PlanNotFoundError}. */
  get(id: PlanId): ExecutionPlan {
    const plan = this.planMap.get(id);
    if (plan === undefined) {
      throw new PlanNotFoundError('plan', id);
    }
    return plan;
  }

  /** Fetch a plan by id, or `undefined` when absent. */
  find(id: PlanId): ExecutionPlan | undefined {
    return this.planMap.get(id);
  }

  /** Fetch the plan derived from a proposal, or `undefined` when none exists. */
  findByProposal(proposalId: ProposalId): ExecutionPlan | undefined {
    const id = this.byProposal.get(proposalId);
    return id === undefined ? undefined : this.planMap.get(id);
  }

  /** Every tracked plan, insertion order. */
  list(): ReadonlyArray<ExecutionPlan> {
    return Array.from(this.planMap.values());
  }

  /** Reset all state (used by tests and teardown). */
  clear(): void {
    this.planMap.clear();
    this.byProposal.clear();
  }

  dispose(): void {
    this.clear();
  }
}
