import type {
  Dependency,
  ExecutionConstraint,
  ExecutionConstraintKind,
  ExecutionGroup,
  ExecutionPhase,
  ExecutionPhaseId,
  ExecutionPlan,
  ExecutionStep,
  ExecutionStepId,
  GroupMode,
  Milestone,
  PlanningStrategy,
  ProposedMission,
  StrategyContext,
  WorkflowExecutionMode,
  WorkflowSource,
  WorkflowStep,
} from './PlannerTypes';

/**
 * Planning strategies decide *how* a Mission Tree becomes an {@link ExecutionPlan}:
 * how to group, phase, and order the work. Strategies are the seam for future
 * AI-enhanced planning — today the package ships two deterministic strategies
 * ({@link DependencyGraphStrategy}, {@link SequentialPlanningStrategy}); a future
 * `ai-strategy` implements the same {@link PlanningStrategy} interface and is
 * selected by name without changing the engine or the Workflow consumer.
 *
 * Every strategy is pure and deterministic given the {@link StrategyContext};
 * the engine supplies the deterministic `Clock`/`IdGenerator` so two plans for
 * the same proposal are identical.
 */

/** Resolve the dependency targets of a node from the tree's edge list. */
function dependenciesOf(
  nodeId: string,
  dependencies: ReadonlyArray<Dependency>,
): ReadonlyArray<string> {
  return dependencies.filter((d) => d.from === nodeId).map((d) => d.to as string);
}

/** Build an immutable ExecutionStep from a Producer node, honoring optional fields. */
function toStep(node: ProposedMission, dependencies: ReadonlyArray<Dependency>): ExecutionStep {
  const requiredRole = node.requiredRoles[0]?.role;
  const requiredCapability = node.requiredCapabilities[0]?.capability;
  return {
    id: node.id as ExecutionStepId,
    title: node.title,
    description: node.brief,
    dependsOn: dependenciesOf(node.id, dependencies).map((d) => d as ExecutionStepId),
    complexity: node.complexity,
    sourceMissionId: node.id,
    ...(requiredRole !== undefined ? { requiredRole } : {}),
    ...(requiredCapability !== undefined ? { requiredCapability } : {}),
    metadata: { priority: node.priority, objectiveId: node.objectiveId },
  };
}

/**
 * Default strategy. Groups work into {@link ExecutionPhase}s aligned to the
 * Producer's milestones, then computes topological ready-set waves within each
 * phase and packs them into {@link ExecutionGroup}s. Encodes independence so a
 * future parallel runner can dispatch `parallel` groups concurrently; performs no
 * execution and calls no model.
 */
export class DependencyGraphStrategy implements PlanningStrategy {
  readonly name = 'dependency-graph';

  build(context: StrategyContext): ExecutionPlan {
    const { proposal, planId, projectId, missionId, mode, createdAt } = context;
    const tree = proposal.missionTree;

    const stepMap = new Map<ExecutionStepId, ExecutionStep>();
    for (const node of tree.nodes) {
      stepMap.set(node.id as ExecutionStepId, toStep(node, tree.dependencies));
    }

    const phases = buildPhases(tree.nodes, tree.dependencies, proposal.analysis.milestones, mode);
    const order: Array<ExecutionStepId> = [];
    const constraints: Array<ExecutionConstraint> = [];

    for (const phase of phases) {
      for (const group of phase.groups) {
        for (const stepId of group.stepIds) {
          order.push(stepId);
          const step = stepMap.get(stepId);
          if (step === undefined) continue;
          for (const dep of step.dependsOn) {
            constraints.push({
              kind: 'dependency' as ExecutionConstraintKind,
              description: `Step "${step.id}" depends on "${dep}"`,
              stepIds: [step.id, dep],
            });
          }
          if (step.requiredCapability !== undefined) {
            constraints.push({
              kind: 'capability' as ExecutionConstraintKind,
              description: `Step "${step.id}" requires capability "${step.requiredCapability}"`,
              stepIds: [step.id],
              params: { capability: step.requiredCapability },
            });
          }
          if (step.requiredRole !== undefined) {
            constraints.push({
              kind: 'role' as ExecutionConstraintKind,
              description: `Step "${step.id}" requires role "${step.requiredRole}"`,
              stepIds: [step.id],
              params: { role: step.requiredRole },
            });
          }
        }
      }
    }

    constraints.push({
      kind: 'approval-gate' as ExecutionConstraintKind,
      description: 'Proposal was approved before planning; no mid-plan re-approval required.',
      stepIds: [],
    });

    return finalizePlan({
      id: planId,
      proposalId: proposal.id,
      goalId: proposal.goalId,
      projectId,
      missionId,
      strategy: this.name,
      mode,
      phases,
      steps: stepMap,
      order,
      constraints,
      confidence: 0.8,
      createdAt,
    });
  }
}

/**
 * A flat strategy: every node runs in a single phase, one step per group, strictly
 * in the Producer's `order`. Useful as a predictable baseline and as a reference
 * for future optimization strategies (which can post-process a graph plan).
 */
export class SequentialPlanningStrategy implements PlanningStrategy {
  readonly name = 'sequential';

  build(context: StrategyContext): ExecutionPlan {
    const { proposal, planId, projectId, missionId, createdAt } = context;
    const tree = proposal.missionTree;
    const ordered = [...tree.nodes].sort((a, b) => a.order - b.order);

    const stepMap = new Map<ExecutionStepId, ExecutionStep>();
    const order: Array<ExecutionStepId> = [];
    const constraints: Array<ExecutionConstraint> = [];
    const groups: Array<ExecutionGroup> = [];

    ordered.forEach((node, index) => {
      const stepId = node.id as ExecutionStepId;
      const deps = dependenciesOf(node.id, tree.dependencies);
      stepMap.set(stepId, toStep(node, tree.dependencies));
      order.push(stepId);
      groups.push({ id: `g-${index}` as ExecutionGroupId, mode: 'sequential', stepIds: [stepId] });
      for (const dep of deps) {
        constraints.push({
          kind: 'dependency' as ExecutionConstraintKind,
          description: `Step "${stepId}" depends on "${dep}"`,
          stepIds: [stepId, dep as ExecutionStepId],
        });
      }
    });

    constraints.push({
      kind: 'approval-gate' as ExecutionConstraintKind,
      description: 'Proposal was approved before planning; no mid-plan re-approval required.',
      stepIds: [],
    });

    const phase: ExecutionPhase = {
      id: 'phase-0' as ExecutionPhaseId,
      order: 0,
      title: 'Execution',
      description: 'All approved work, scheduled in proposal order.',
      milestoneId: null,
      groups,
      failFast: true,
    };

    return finalizePlan({
      id: planId,
      proposalId: proposal.id,
      goalId: proposal.goalId,
      projectId,
      missionId,
      strategy: this.name,
      mode: 'sequential',
      phases: [phase],
      steps: stepMap,
      order,
      constraints,
      confidence: 0.7,
      createdAt,
    });
  }
}

/** Group nodes into phases by milestone; ungrouped nodes form an implicit phase. */
function buildPhases(
  nodes: ReadonlyArray<ProposedMission>,
  dependencies: ReadonlyArray<Dependency>,
  milestones: ReadonlyArray<Milestone>,
  mode: WorkflowExecutionMode,
): ReadonlyArray<ExecutionPhase> {
  const nodeMap = new Map<string, ProposedMission>(nodes.map((n) => [n.id, n]));
  const byMilestone = new Map<string | null, Array<ProposedMission>>();
  for (const node of nodes) {
    const list = byMilestone.get(node.milestoneId) ?? [];
    list.push(node);
    byMilestone.set(node.milestoneId, list);
  }

  const orderedKeys: Array<string | null> = [];
  for (const m of [...milestones].sort((a, b) => a.order - b.order)) {
    if (byMilestone.has(m.id)) orderedKeys.push(m.id);
  }
  if (byMilestone.has(null)) orderedKeys.push(null);

  const phases: Array<ExecutionPhase> = [];
  let phaseOrder = 0;
  for (const key of orderedKeys) {
    const group = byMilestone.get(key);
    if (group === undefined || group.length === 0) continue;
    const milestone = key !== null ? (milestones.find((m) => m.id === key) ?? null) : null;
    const groups = buildGroups(group, dependencies, nodeMap, mode);
    phases.push({
      id: `phase-${phaseOrder}` as ExecutionPhaseId,
      order: phaseOrder,
      title: milestone !== null ? milestone.title : `Phase ${phaseOrder + 1}`,
      description: milestone !== null ? milestone.description : 'Work not assigned to a milestone.',
      milestoneId: key,
      groups,
      failFast: true,
    });
    phaseOrder += 1;
  }
  return phases;
}

/**
 * Compute topological ready-set waves for a set of nodes and pack them into
 * execution groups. Cross-phase dependencies are ignored locally (phase order
 * already guarantees the prerequisite phase runs first). In `parallel` mode a wave
 * becomes one multi-step group; in `sequential` mode each node is its own group.
 */
/** Null-safe order lookup for a node within a phase's node map. */
function orderOf(nodeMap: ReadonlyMap<string, ProposedMission>, id: string): number {
  return nodeMap.get(id)?.order ?? 0;
}

function buildGroups(
  groupNodes: ReadonlyArray<ProposedMission>,
  dependencies: ReadonlyArray<Dependency>,
  nodeMap: ReadonlyMap<string, ProposedMission>,
  mode: WorkflowExecutionMode,
): ReadonlyArray<ExecutionGroup> {
  const ids: Array<string> = groupNodes.map((n) => n.id as string);
  const localSet = new Set<string>(ids);
  const indegree = new Map<string, number>();
  for (const id of ids) indegree.set(id, 0);
  for (const node of groupNodes) {
    for (const dep of dependenciesOf(node.id, dependencies)) {
      if (!localSet.has(dep)) continue;
      indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
    }
  }

  const ready: Array<string> = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  ready.sort((a, b) => orderOf(nodeMap, a) - orderOf(nodeMap, b));

  const satisfied = new Set<string>();
  const groups: Array<ExecutionGroup> = [];
  let groupIndex = 0;
  while (satisfied.size < ids.length) {
    const wave: Array<string> = [];
    for (const id of ready) {
      if (satisfied.has(id)) continue;
      const depsMet = dependenciesOf(id, dependencies).every(
        (d) => !localSet.has(d) || satisfied.has(d),
      );
      if (depsMet) wave.push(id);
    }
    if (wave.length === 0) break; // defensive; an acyclic local graph prevents this
    for (const id of wave) satisfied.add(id);
    const groupMode: GroupMode = mode === 'parallel' ? 'parallel' : 'sequential';
    groups.push({
      id: `g-${groupIndex}` as ExecutionGroupId,
      mode: groupMode,
      stepIds: wave.map((id) => id as ExecutionStepId),
    });
    groupIndex += 1;
    ready.length = 0;
    for (const id of ids) {
      if (satisfied.has(id)) continue;
      if (dependenciesOf(id, dependencies).every((d) => !localSet.has(d) || satisfied.has(d))) {
        ready.push(id);
      }
    }
    ready.sort((a, b) => orderOf(nodeMap, a) - orderOf(nodeMap, b));
  }
  return groups;
}

type ExecutionGroupId = ExecutionGroup['id'];

/** Shared finalization: stamps the `toWorkflowSource` bridge onto the plan. */
function finalizePlan(plan: Omit<ExecutionPlan, 'toWorkflowSource'>): ExecutionPlan {
  return {
    ...plan,
    toWorkflowSource(): WorkflowSource {
      return toWorkflowSource(plan as ExecutionPlan);
    },
  };
}

/**
 * Bridge an immutable {@link ExecutionPlan} into a {@link WorkflowSource} the
 * Workflow Engine consumes. Steps carry dependency edges and capability/role
 * needs; the Workflow Engine validates and runs them. The Planner never executes.
 */
export function toWorkflowSource(plan: ExecutionPlan): WorkflowSource {
  const steps: Array<WorkflowStep> = [];
  for (const step of plan.steps.values()) {
    const wfStep: WorkflowStep = {
      id: step.id as unknown as WorkflowStep['id'],
      title: step.title,
      description: step.description,
      dependsOn: step.dependsOn.map((d) => d as unknown as WorkflowStep['id']),
      metadata: step.metadata ?? {},
    };
    if (step.requiredCapability !== undefined) {
      (wfStep as { requiredCapability?: string }).requiredCapability = step.requiredCapability;
    }
    if (step.requiredRole !== undefined) {
      (wfStep as { requiredRole?: string }).requiredRole = step.requiredRole;
    }
    steps.push(wfStep);
  }
  return {
    sourceId: plan.id as string,
    projectId: plan.projectId,
    missionId: plan.missionId,
    steps,
    mode: plan.mode,
    failFast: plan.phases.every((p) => p.failFast),
  };
}

/** The strategies bundled with the engine, keyed by `PlanningStrategy.name`. */
export const BUILTIN_STRATEGIES: ReadonlyArray<PlanningStrategy> = [
  new DependencyGraphStrategy(),
  new SequentialPlanningStrategy(),
];
