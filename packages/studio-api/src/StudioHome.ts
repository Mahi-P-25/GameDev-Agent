import type { ContextManager } from '@gamedev-agent/context';
import type { CoordinatorManager } from '@gamedev-agent/coordinator';
import type { PlannerManager } from '@gamedev-agent/planner';
import type { ProducerManager } from '@gamedev-agent/producer';
import type { WorkflowManager } from '@gamedev-agent/workflow';
import type {
  StudioActivity,
  StudioContext,
  StudioCoordinatorStatus,
  StudioExecutionPhase,
  StudioGoal,
  StudioHome,
  StudioPlannerStatus,
  StudioWorkflowStatus,
} from './StudioApiContracts';

/**
 * Builds the complete, self-contained {@link StudioHome} view from the live
 * state of the underlying subsystems.
 *
 * This is a *pure projection*: it reads each subsystem's current truth and
 * translates it into the stable Studio Home DTO. It holds no state of its own —
 * every call reflects the exact moment of the request — so the Studio UI can
 * re-render from it whenever the {@link ActivityFeed} signals a change, without
 * the UI ever knowing about the Producer, Planner, Workflow, Coordinator,
 * Context, or internals. This is what lets "Studio UI updates automatically"
 * with zero polling of domain packages.
 */
export function buildStudioHome(params: {
  producer: ProducerManager;
  planner: PlannerManager;
  workflow: WorkflowManager;
  coordinator: CoordinatorManager;
  context: ContextManager;
  activity: ReadonlyArray<StudioActivity>;
}): StudioHome {
  const { producer, planner, workflow, coordinator, context, activity } = params;

  const goal = currentGoal(producer);
  const plannerStatus = plannerStatusOf(planner);
  const workflowStatus = workflowStatusOf(workflow, plannerStatus.lastPlan?.phases ?? []);
  const missionStatus = coordinatorStatusOf(coordinator);
  const studioContext = contextSnapshot(context);

  return {
    goal,
    missionStatus,
    plannerStatus,
    workflowStatus,
    coordinatorStatus: missionStatus,
    context: studioContext,
    activity,
  };
}

/** Translate the live {@link ContextManager} snapshot into the Studio DTO. */
function contextSnapshot(manager: ContextManager): StudioContext {
  const current = manager.current();
  return {
    onboarding: manager.isOnboarding(),
    workspaceId: current.workspaceId === null ? null : String(current.workspaceId),
    projectId: current.projectId === null ? null : String(current.projectId),
    goalId: current.goalId === null ? null : String(current.goalId),
    missionId: current.missionId === null ? null : String(current.missionId),
    workflowId: current.workflowId === null ? null : String(current.workflowId),
    workflowExecutionId:
      current.workflowExecutionId === null ? null : String(current.workflowExecutionId),
    activeFile: current.activeFile === null ? null : String(current.activeFile),
    branch: current.branch === null ? null : String(current.branch),
    recentFiles: current.recentFiles.map((f) => String(f)),
    recentWorkflows: current.recentWorkflows.map((w) => String(w)),
    updatedAt: current.updatedAt,
  };
}

/** The most recently submitted goal that is still in flight, if any. */
function currentGoal(producer: ProducerManager): StudioGoal {
  const goals = producer.list();
  const goal = goals.length > 0 ? goals[goals.length - 1] : undefined;
  if (goal === undefined) {
    return { goalId: null, title: null, status: null, proposalId: null };
  }
  return {
    goalId: String(goal.id),
    title: goal.title,
    status: goal.status,
    proposalId: goal.proposal !== null ? String(goal.proposal.id) : null,
  };
}

function plannerStatusOf(planner: PlannerManager): StudioPlannerStatus {
  const plans = planner.listPlans();
  const last = plans.length > 0 ? plans[plans.length - 1] : undefined;
  return {
    planCount: plans.length,
    lastPlan:
      last === undefined
        ? null
        : {
            planId: String(last.id),
            proposalId: String(last.proposalId),
            strategy: last.strategy,
            mode: last.mode,
            phaseCount: last.phases.length,
            stepCount: last.steps.size,
            phases: last.phases.map((p: { order: number; title: string }) => ({
              index: p.order,
              title: p.title,
            })),
          },
  };
}

function workflowStatusOf(
  workflow: WorkflowManager,
  planPhases: ReadonlyArray<{ index: number; title: string }>,
): StudioWorkflowStatus {
  const executions = workflow.list();
  const current = executions.length > 0 ? executions[executions.length - 1] : undefined;
  const phases = phasesFor(current, planPhases);

  return {
    executionCount: executions.length,
    current:
      current === undefined
        ? null
        : {
            executionId: String(current.id),
            state: current.state,
            progress: current.progress,
            stepCount: current.plan.order.length,
            mode: current.plan.mode,
          },
    phases,
  };
}

/**
 * Resolve the execution phases backing the current workflow run. Phase titles
 * come from the Planner's plan; when absent we fall back to a single implicit
 * phase. The "active" / "done" flags are derived from the run's overall
 * progress mapped onto the phase list — a deterministic, local heuristic
 * sufficient for the Studio Home panel (no execution engine required).
 */
function phasesFor(
  current: ReturnType<WorkflowManager['list']>[number] | undefined,
  planPhases: ReadonlyArray<{ index: number; title: string }>,
): ReadonlyArray<StudioExecutionPhase> {
  if (current === undefined) {
    return [];
  }
  const phaseCount = Math.max(1, planPhases.length);
  const progress = current.progress;
  const completed = progress >= 100;
  const activeIndex = completed
    ? phaseCount - 1
    : Math.min(phaseCount - 1, Math.floor((progress / 100) * phaseCount));

  return Array.from({ length: phaseCount }, (_, index) => ({
    index,
    title: planPhases[index]?.title ?? `Phase ${index + 1}`,
    active: !completed && index === activeIndex,
    done: completed || index < activeIndex,
  }));
}

function coordinatorStatusOf(coordinator: CoordinatorManager): StudioCoordinatorStatus {
  const missions = coordinator.list();
  const byStatus: Record<string, number> = {};
  let active = 0;
  let terminal = 0;
  for (const m of missions) {
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    if (m.status === 'completed' || m.status === 'failed' || m.status === 'cancelled') {
      terminal += 1;
    } else {
      active += 1;
    }
  }
  return { total: missions.length, byStatus, active, terminal };
}
