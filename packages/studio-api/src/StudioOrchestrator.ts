import { COORDINATOR_MANAGER_TOKEN, type CoordinatorManager } from '@gamedev-agent/coordinator';
import { PROJECT_MANAGER_TOKEN, type ProjectManager } from '@gamedev-agent/project';
import { createServiceToken } from '@gamedev-agent/di';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import { MISSION_AGENT_TOKEN, type MissionAgent } from '@gamedev-agent/execution-engine';
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
import type { Logger } from '@gamedev-agent/logging';
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
 *   PlanCreated                → Coordinator Mission + MissionAgent
 *
 * The last hop is the MissionAgent — Nova's autonomous mission brain. Instead
 * of executing a predefined workflow step-by-step, the agent receives the plan,
 * observes the environment, thinks about the next action, executes through the
 * Tool Runtime, and verifies the result. The MissionAgent orchestrates existing
 * systems; it never replaces them.
 *
 * This reuses the existing KernelModule + EventBus + DI pattern; it introduces
 * no new architecture, only the wiring between existing systems.
 */
export class StudioOrchestrator implements Disposable {
  private readonly producer: ProducerManager;
  private readonly planner: PlannerManager;
  private readonly workflow: WorkflowManager;
  private readonly coordinator: CoordinatorManager;
  private readonly missionAgent: MissionAgent;
  private readonly projects: ProjectManager | undefined;
  private readonly logger: Logger | undefined;
  private readonly disposers: Array<Disposable> = [];
  private disposed = false;

  constructor(params: {
    producer: ProducerManager;
    planner: PlannerManager;
    workflow: WorkflowManager;
    coordinator: CoordinatorManager;
    missionAgent: MissionAgent;
    projects?: ProjectManager | undefined;
    logger?: Logger | undefined;
  }) {
    this.producer = params.producer;
    this.planner = params.planner;
    this.workflow = params.workflow;
    this.coordinator = params.coordinator;
    this.missionAgent = params.missionAgent;
    this.projects = params.projects;
    this.logger = params.logger;
  }

  get workflowManager(): WorkflowManager {
    return this.workflow;
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
   * Plan produced: start a Coordinator Mission for it and launch the MissionAgent
   * to autonomously execute the plan. The agent owns the decision loop:
   * observe → think → decide → execute → verify → repeat.
   */
  private async onPlanCreated(planId: string): Promise<void> {
    const plan = this.planner.getPlan(planId as never);
    const goal = this.producer.find(plan.goalId);
    const title = goal?.title ?? `Execute ${plan.proposalId}`;

    // 1. Coordinator Mission: submit → accept → analyse → approve → ready → start.
    this.logger?.info('Starting Coordinator Mission', { title, planId });
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

    // 2. Launch the MissionAgent — the autonomous brain that owns execution.
    //    It receives the plan (as a WorkflowSource), observes the workspace,
    //    decides each action, executes through the Tool Runtime, verifies
    //    results, and continues until the mission is complete, failed, or
    //    cancelled.
    this.logger?.info('Launching MissionAgent', { planId, missionId: mission.id });
    const source = plan.toWorkflowSource();
    const report = await this.missionAgent.run(source);
    this.logger?.info('MissionAgent completed', {
      planId,
      status: report.status,
      actions: report.actionCount,
      durationMs: report.totalDurationMs,
    });

    // 3. Complete the coordinator mission based on the agent's result.
    if (report.status === 'completed') {
      await this.coordinator.review(mission.id);
      await this.coordinator.complete(mission.id);

      if (this.projects !== undefined) {
        const projectName = goal?.title ?? title;
        try {
          await this.projects.create({
            name: projectName,
            description: `Autonomous project derived from goal: ${projectName}`,
            rootPath: `./${projectName}`,
            engine: 'three.js',
            language: 'typescript',
          });
          this.logger?.info('Project registered in ProjectManager', { name: projectName });
        } catch (error) {
          if (!(error instanceof Error) || !/duplicate|already|exists/i.test(error.message)) {
            this.logger?.warn('Failed to register created project in ProjectManager', { error });
          }
        }
      }
    } else if (report.status === 'failed') {
      await this.coordinator.fail(mission.id, report.finalSummary);
    }
  }
}

/** Kernel module that installs the {@link StudioOrchestrator}. */
export const studioOrchestratorModule: KernelModule = {
  name: 'nova.studio-orchestrator',
  async register(kernel: StudioKernel): Promise<void> {
    const [producer, planner, workflow, coordinator, missionAgent, projects] = await Promise.all([
      kernel.services.resolve(PRODUCER_MANAGER_TOKEN),
      kernel.services.resolve(PLANNER_MANAGER_TOKEN),
      kernel.services.resolve(WORKFLOW_MANAGER_TOKEN),
      kernel.services.resolve(COORDINATOR_MANAGER_TOKEN),
      kernel.services.resolve(MISSION_AGENT_TOKEN),
      kernel.services.has(PROJECT_MANAGER_TOKEN)
        ? kernel.services.resolve<ProjectManager>(PROJECT_MANAGER_TOKEN)
        : Promise.resolve(undefined),
    ]);
    const orchestrator = new StudioOrchestrator({
      producer,
      planner,
      workflow,
      coordinator,
      missionAgent,
      projects,
      logger: kernel.logger.child('studio-orchestrator'),
    });
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
