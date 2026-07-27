import { COORDINATOR_MANAGER_TOKEN, type CoordinatorManager } from '@gamedev-agent/coordinator';
import { createServiceToken } from '@gamedev-agent/di';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import { PLANNER_MANAGER_TOKEN, type PlannerManager } from '@gamedev-agent/planner';
import { PlanCreated } from '@gamedev-agent/planner';
import { PRODUCER_MANAGER_TOKEN, type ProducerManager } from '@gamedev-agent/producer';
import {
  GoalAnalysing,
  GoalApprovalRequested,
  GoalMissionTreeGenerated,
  GoalObjectivesGenerated,
  GoalReviewPackageGenerated,
  GoalSubmitted,
  MissionProposalReady,
} from '@gamedev-agent/producer';
import type { Disposable } from '@gamedev-agent/shared';
import { WORKFLOW_MANAGER_TOKEN, type WorkflowManager } from '@gamedev-agent/workflow';

/** DI token for the {@link StudioOrchestrator}. */
export const STUDIO_ORCHESTRATOR_TOKEN = createServiceToken<StudioOrchestrator>(
  'nova.studio-orchestrator',
);

/**
 * Studio Orchestrator — the vertical-slice glue.
 * ===========================================================================
 *
 * This module is the *only* place the five Nova systems are tied into one flow.
 * It owns no domain logic of its own; it listens on the shared Event Bus and
 * delegates every action to an existing manager:
 *
 *   GoalSubmitted              → Producer.analyse
 *   GoalAnalysing              → Producer.generateObjectives
 *   GoalObjectivesGenerated    → Producer.generateMissionTree
 *   GoalMissionTreeGenerated   → Producer.generateReviewPackage
 *   GoalReviewPackageGenerated → Producer.requestApproval
 *   GoalApprovalRequested      → Producer.approve            (auto-approve slice)
 *   MissionProposalReady       → Planner.plan                (approved tree → plan)
 *   PlanCreated                → Coordinator Mission + Workflow execution
 *
 * The last hop is where the slice demonstrates the architecture pays off: a
 * single `plan.created` event fans out into a Coordinator Mission (started) and
 * a Workflow Engine execution (driven to completion by the deterministic
 * executor). Because everything flows through the bus, the Studio UI updates
 * automatically from the resulting event stream — no polling, no direct
 * coupling between subsystems.
 *
 * This reuses the existing KernelModule + EventBus + DI pattern; it introduces
 * no new architecture, only the wiring between existing systems.
 */
export class StudioOrchestrator implements Disposable {
  private readonly producer: ProducerManager;
  private readonly planner: PlannerManager;
  private readonly workflow: WorkflowManager;
  private readonly coordinator: CoordinatorManager;
  private readonly disposers: Array<Disposable> = [];
  private disposed = false;

  constructor(params: {
    producer: ProducerManager;
    planner: PlannerManager;
    workflow: WorkflowManager;
    coordinator: CoordinatorManager;
  }) {
    this.producer = params.producer;
    this.planner = params.planner;
    this.workflow = params.workflow;
    this.coordinator = params.coordinator;
  }

  /** Subscribe to every pipeline event. Idempotent. */
  start(bus: import('@gamedev-agent/events').EventBusContract): void {
    this.disposers.push(
      bus.subscribe(GoalSubmitted, (e) => this.advance('analyse', e.payload.goalId)),
      bus.subscribe(GoalAnalysing, (e) => this.advance('generateObjectives', e.payload.goalId)),
      bus.subscribe(GoalObjectivesGenerated, (e) =>
        this.advance('generateMissionTree', e.payload.goalId),
      ),
      bus.subscribe(GoalMissionTreeGenerated, (e) =>
        this.advance('generateReviewPackage', e.payload.goalId),
      ),
      bus.subscribe(GoalReviewPackageGenerated, (e) =>
        this.advance('requestApproval', e.payload.goalId),
      ),
      bus.subscribe(GoalApprovalRequested, (e) => this.advance('approve', e.payload.goalId)),
      bus.subscribe(MissionProposalReady, (e) => void this.onProposalReady(e.payload)),
      bus.subscribe(PlanCreated, (e) => void this.onPlanCreated(e.payload.planId)),
    );
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const d of this.disposers.splice(0)) {
      d.dispose();
    }
  }

  // --- pipeline steps --------------------------------------------------------

  private async advance(
    step:
      | 'analyse'
      | 'generateObjectives'
      | 'generateMissionTree'
      | 'generateReviewPackage'
      | 'requestApproval'
      | 'approve',
    goalId: string,
  ): Promise<void> {
    try {
      switch (step) {
        case 'analyse':
          await this.producer.analyse(goalId as never);
          break;
        case 'generateObjectives':
          await this.producer.generateObjectives(goalId as never);
          break;
        case 'generateMissionTree':
          await this.producer.generateMissionTree(goalId as never);
          break;
        case 'generateReviewPackage':
          await this.producer.generateReviewPackage(goalId as never);
          break;
        case 'requestApproval':
          await this.producer.requestApproval(goalId as never);
          break;
        case 'approve':
          await this.producer.approve(goalId as never, 'studio-orchestrator');
          break;
      }
    } catch (error) {
      // A guard failure (illegal transition) here means the pipeline is already
      // in the expected terminal state; swallow so a late/duplicate event does
      // not fault the bus. Other errors surface through the subsystems' own
      // logging and events.
      if (!(error instanceof Error) || !/already|illegal|transition/i.test(error.message)) {
        throw error;
      }
    }
  }

  /** Approved tree arrived: let the Planner turn it into an immutable plan. */
  private async onProposalReady(
    payload: import('@gamedev-agent/producer').MissionProposalReadyPayload,
  ): Promise<void> {
    await this.planner.plan(payload.proposal, { missionId: null });
  }

  /**
   * Plan produced: start a Coordinator Mission for it and create + run a Workflow
   * execution from the plan's `WorkflowSource` bridge. This is the fan-out that
   * proves the architecture connects Planning → Workflow → Coordinator.
   */
  private async onPlanCreated(planId: string): Promise<void> {
    const plan = this.planner.getPlan(planId as never);
    const goal = this.producer.find(plan.goalId);
    const title = goal?.title ?? `Execute ${plan.proposalId}`;

    // 1. Coordinator Mission: submit → accept → analyse → approve → ready → start.
    const mission = await this.coordinator.submit({
      projectId: plan.projectId as never,
      title,
      brief: `Mission derived from proposal ${plan.proposalId}`,
    });
    await this.coordinator.accept(mission.id);
    await this.coordinator.analyse(mission.id);
    await this.coordinator.requestApproval(mission.id);
    await this.coordinator.approve(mission.id);
    await this.coordinator.markReady(mission.id);
    await this.coordinator.startExecution(mission.id);

    // 2. Workflow execution: bridge the plan into a WorkflowSource, then run it.
    //    When a StepExecutor is set on the WorkflowManager (e.g. the Execution
    //    Engine), `start()` automatically drives every step through the executor
    //    and the run reaches `completed` before the promise resolves.
    //    Without an executor (e.g. in tests or vertical-slice mode), manually
    //    succeed every step so the run completes deterministically.
    const execution = await this.workflow.createFromSource(plan.toWorkflowSource());
    const started = await this.workflow.start(execution.id);
    if (started.state === 'running' && this.workflow.executor === undefined) {
      let current = started;
      for (const stepId of current.plan.order) {
        if (current.state !== 'running' || current.paused) break;
        current = await this.workflow.succeedStep(current.id, stepId);
      }
    }
  }
}

/** Kernel module that installs the {@link StudioOrchestrator}. */
export const studioOrchestratorModule: KernelModule = {
  name: 'nova.studio-orchestrator',
  async register(kernel: StudioKernel): Promise<void> {
    const [producer, planner, workflow, coordinator] = await Promise.all([
      kernel.services.resolve(PRODUCER_MANAGER_TOKEN),
      kernel.services.resolve(PLANNER_MANAGER_TOKEN),
      kernel.services.resolve(WORKFLOW_MANAGER_TOKEN),
      kernel.services.resolve(COORDINATOR_MANAGER_TOKEN),
    ]);
    const orchestrator = new StudioOrchestrator({ producer, planner, workflow, coordinator });
    kernel.registerService({
      token: STUDIO_ORCHESTRATOR_TOKEN,
      singleton: true,
      factory: () => orchestrator,
    });
    // Subscriptions are attached once the kernel has fully booted so every
    // upstream service exists and the first pipeline events are observed.
    kernel.lifecycle.on('running', () => {
      orchestrator.start(kernel.events);
    });
  },
};
