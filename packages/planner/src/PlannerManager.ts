import type { MissionId } from '@gamedev-agent/coordinator';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { MissionProposalReady, type MissionProposalReadyPayload } from '@gamedev-agent/producer';
import type { MissionProposal } from '@gamedev-agent/producer';
import type { Disposable } from '@gamedev-agent/shared';
import { Planner } from './Planner';
import { PlanNotFoundError, ProposalNotApprovedError, UnknownStrategyError } from './PlannerErrors';
import { PlanCreated, PlanFailed, PlanRequested } from './PlannerEvents';
import { PlannerRegistry } from './PlannerRegistry';
import type {
  ExecutionPlan,
  PlanId,
  PlanningStrategy,
  ProposalId,
  WorkflowExecutionMode,
} from './PlannerTypes';
import { BUILTIN_STRATEGIES } from './PlanningStrategy';

/**
 * Orchestrates the Planning lifecycle and is the single point of integration
 * between the Planning domain (engine + registry + strategies) and Nova's shared
 * infrastructure (the Event Bus, Logger, and the Producer/Coordinator via events).
 *
 * Responsibilities:
 *  - Register planning strategies; select one by name (default `dependency-graph`).
 *  - Accept an *approved* Mission Proposal (the handoff from the Producer/Coordinator)
 *    and turn it into an immutable {@link ExecutionPlan}.
 *  - Guard that only `approved` proposals are planned.
 *  - Store the plan and publish `plan.created` (carrying phase/step counts) so the
 *    Workflow Engine can consume it; on failure publish `plan.failed`.
 *  - Optionally auto-plan on `mission-proposal.ready` when `autoPlan` is enabled.
 *
 * The manager depends only on abstractions (`EventBusContract`, `Logger`,
 * `PlanningStrategy`) — never on the Producer, Coordinator, Memory, Knowledge,
 * Role, or Execution packages directly — and owns no singleton; callers inject
 * the bus/logger/strategies (and can supply test doubles). It is `Disposable` for
 * kernel-scoped teardown.
 */
export interface PlannerManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  /** Strategies available by name. Defaults to the built-in set. */
  readonly strategies?: ReadonlyArray<PlanningStrategy>;
  /** Strategy selected when a request omits one. */
  readonly defaultStrategy?: string;
  /** Auto-plan when an approved proposal arrives on the bus. Default false. */
  readonly autoPlan?: boolean;
  readonly planner?: Planner;
  readonly registry?: PlannerRegistry;
}

export class PlannerManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly planner: Planner;
  private readonly registry: PlannerRegistry;
  private readonly strategies: Map<string, PlanningStrategy>;
  private readonly defaultStrategy: string;
  private readonly autoPlan: boolean;
  private busDisposer: Disposable | null = null;
  private disposed = false;

  constructor(options: PlannerManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.planner', [new ConsoleLogSink()]);
    this.planner = options.planner ?? new Planner();
    this.registry = options.registry ?? new PlannerRegistry();
    const strategies = options.strategies ?? BUILTIN_STRATEGIES;
    this.strategies = new Map(strategies.map((s) => [s.name, s]));
    this.defaultStrategy = options.defaultStrategy ?? 'dependency-graph';
    this.autoPlan = options.autoPlan ?? false;

    if (this.autoPlan) {
      this.busDisposer = this.bus.subscribe(MissionProposalReady, (envelope) => {
        void this.onProposalReady(envelope.payload);
      });
    }
  }

  /** Register an additional strategy (e.g. a future AI strategy) by name. */
  registerStrategy(strategy: PlanningStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Plan an approved proposal. Validates approval, selects the strategy, builds
   * the immutable plan, stores it, and emits `plan.created`. Throws
   * {@link ProposalNotApprovedError} for un-approved proposals and
   * {@link UnknownStrategyError} for an unregistered strategy.
   */
  async plan(
    proposal: MissionProposal,
    options: {
      readonly missionId?: MissionId | null;
      readonly strategy?: string;
      readonly mode?: WorkflowExecutionMode;
    } = {},
  ): Promise<PlanId> {
    const strategyName = options.strategy ?? this.defaultStrategy;
    await this.bus.publish(PlanRequested, {
      proposalId: proposal.id,
      missionId: options.missionId ?? null,
      strategy: strategyName,
      timestamp: Date.now(),
    });
    try {
      const strategy = this.strategies.get(strategyName);
      if (strategy === undefined) {
        throw new UnknownStrategyError(strategyName);
      }
      const plan = this.planner.plan(
        proposal,
        strategy,
        options.missionId ?? null,
        options.mode ?? 'sequential',
      );
      this.registry.add(plan);
      this.logger.info('plan.created', {
        id: plan.id,
        proposalId: plan.proposalId,
        phases: plan.phases.length,
        steps: plan.steps.size,
      });
      await this.bus.publish(PlanCreated, {
        planId: plan.id,
        proposalId: plan.proposalId,
        goalId: plan.goalId,
        projectId: plan.projectId,
        missionId: plan.missionId,
        strategy: plan.strategy,
        mode: plan.mode,
        phaseCount: plan.phases.length,
        stepCount: plan.steps.size,
        timestamp: Date.now(),
      });
      return plan.id;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.bus.publish(PlanFailed, {
        proposalId: proposal.id,
        reason,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /** Fetch a stored plan by id. */
  getPlan(id: PlanId): ExecutionPlan {
    const plan = this.registry.get(id);
    if (plan === undefined) {
      throw new PlanNotFoundError('plan', id);
    }
    return plan;
  }

  /** Fetch a stored plan by id, or `undefined` when absent. */
  findPlan(id: PlanId): ExecutionPlan | undefined {
    return this.registry.find(id);
  }

  /** Fetch the plan derived from a proposal, if any. */
  findByProposal(proposalId: ProposalId): ExecutionPlan | undefined {
    return this.registry.findByProposal(proposalId);
  }

  /** List every tracked plan (insertion order). */
  listPlans(): ReadonlyArray<ExecutionPlan> {
    return this.registry.list();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.busDisposer?.dispose();
    this.registry.clear();
  }

  /** Handler for `mission-proposal.ready`: auto-plan the approved proposal. */
  private async onProposalReady(payload: MissionProposalReadyPayload): Promise<void> {
    try {
      await this.plan(payload.proposal, { missionId: null });
    } catch (error) {
      this.logger.warn('plan.auto-failed', {
        goalId: payload.goalId,
        proposalId: payload.proposal.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
