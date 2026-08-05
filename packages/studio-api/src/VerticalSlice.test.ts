import { CapabilityManager, NoopToolProbe } from '@gamedev-agent/capabilities';
import { CoordinatorManager } from '@gamedev-agent/coordinator';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { PlannerManager } from '@gamedev-agent/planner';
import { ProducerManager } from '@gamedev-agent/producer';
import { ProjectManager } from '@gamedev-agent/project';
import { WorkflowManager } from '@gamedev-agent/workflow';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudioApi } from './StudioApi';
import { StudioOrchestrator } from './StudioOrchestrator';
import { WorkflowRunner } from './workflows/WorkflowRunner';

const noopLogger: Logger = {
  namespace: 'test',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

/**
 * Drives the entire Nova pipeline through the *real* subsystems, connected only
 * by the shared Event Bus via the StudioOrchestrator. No AI, no Memory, no new
 * architecture — just the existing Producer → Planner → Workflow → Coordinator
 * systems wired through the bus and surfaced through the Studio API façade.
 */
describe('Vertical Slice — Goal to Studio Home', () => {
  let bus: InMemoryEventBus;
  let producer: ProducerManager;
  let planner: PlannerManager;
  let workflow: WorkflowManager;
  let coordinator: CoordinatorManager;
  let projects: ProjectManager;
  let capabilities: CapabilityManager;
  let orchestrator: StudioOrchestrator;
  let api: StudioApi;

  beforeEach(() => {
    bus = new InMemoryEventBus('test');
    producer = new ProducerManager({ eventBus: bus, logger: noopLogger });
    planner = new PlannerManager({ eventBus: bus, logger: noopLogger });
    workflow = new WorkflowManager({ eventBus: bus, logger: noopLogger });
    coordinator = new CoordinatorManager({ eventBus: bus, logger: noopLogger });
    projects = new ProjectManager({ eventBus: bus, logger: noopLogger });
    capabilities = new CapabilityManager({
      eventBus: bus,
      logger: noopLogger,
      toolProbe: new NoopToolProbe(),
    });

    orchestrator = new StudioOrchestrator({
      producer,
      planner,
      workflow,
      coordinator,
      missionAgent: {
        run: async () => ({
          missionId: 'mission-test',
          planId: 'plan-test',
          goalTitle: 'Realistic Formula racing',
          startedAt: Date.now(),
          completedAt: Date.now(),
          status: 'completed',
          finalSummary: 'Mission completed',
          timeline: [],
          actionCount: 0,
          failureCount: 0,
          artifacts: [],
          totalDurationMs: 0,
          decisionCount: 0,
        }),
      } as never,
    });
    orchestrator.start(bus);

    api = new StudioApi({
      coordinator,
      projects,
      capabilities,
      producer,
      planner,
      workflow,
      workflowRunner: new WorkflowRunner(workflow),
      bus,
    });
  });

  afterEach(() => {
    orchestrator.dispose();
  });

  /** Wait until the orchestrator has driven the pipeline to a completed mission. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 100; i += 1) {
      const missions = coordinator.list();
      if (missions.some((m) => m.status === 'completed' || m.status === 'failed')) {
        return;
      }
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  it('auto-advances the goal lifecycle to approval and produces a plan', async () => {
    const project = await projects.create({ name: 'Racer', rootPath: '/tmp/racer' } as never);
    const goal = await producer.submit({
      projectId: project.id,
      title: 'Realistic Formula racing',
      description: 'I want a believable single-seater racing experience.',
    } as never);
    await settle();

    // The orchestrator must have walked the goal through every lifecycle step.
    const settled = producer.find(goal.id);
    expect(settled?.status).toBe('approved');
    expect(settled?.proposal).not.toBeNull();

    // And the Planner must have produced a frozen plan from the approved tree.
    const proposal = settled?.proposal;
    expect(proposal).not.toBeNull();
    const planId = proposal !== null && proposal !== undefined ? proposal.id : undefined;
    const plan = planId !== undefined ? planner.findByProposal(planId) : undefined;
    expect(plan).toBeDefined();
    if (plan !== undefined) {
      expect(plan.phases.length).toBeGreaterThan(0);
    }
  });

  it('fans a plan out into a Coordinator Mission executed by the MissionAgent', async () => {
    const project = await projects.create({ name: 'Racer', rootPath: '/tmp/racer' } as never);
    await producer.submit({
      projectId: project.id,
      title: 'Realistic Formula racing',
      description: 'I want a believable single-seater racing experience.',
    } as never);
    await settle();

    const missions = coordinator.list();
    expect(missions.length).toBeGreaterThan(0);
    const mission = missions[0] as (typeof missions)[number];
    // The MissionAgent ran autonomously and completed the coordinator mission.
    expect(['completed', 'reviewed']).toContain(mission.status);
  });

  it('exposes the whole pipeline through a single StudioHome read', async () => {
    const project = await projects.create({ name: 'Racer', rootPath: '/tmp/racer' } as never);
    await producer.submit({
      projectId: project.id,
      title: 'Realistic Formula racing',
      description: 'I want a believable single-seater racing experience.',
    } as never);
    await settle();

    const home = api.getStudioHome();
    expect(home.goal.goalId).not.toBeNull();
    expect(home.goal.title).toBe('Realistic Formula racing');
    expect(home.plannerStatus.planCount).toBe(1);
    expect(home.plannerStatus.lastPlan?.phaseCount).toBeGreaterThan(0);
    expect(home.coordinatorStatus.total).toBeGreaterThan(0);
    // The activity feed captured the pipeline unfolding.
    const kinds = home.activity.map((a) => a.kind);
    expect(kinds).toContain('goal.submitted');
    expect(kinds).toContain('plan.created');
    expect(kinds).toContain('mission.submitted');
  });
});
