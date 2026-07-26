import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import { GoalValidationError, MissionTreeError, type ValidationViolation } from './ProducerErrors';
import { canTransition, isTerminal } from './ProducerState';
import {
  type ApprovalPackage,
  COMPLEXITY_ORDER,
  type CapabilityEstimate,
  type Complexity,
  type Dependency,
  type Goal,
  type GoalAnalysis,
  type GoalId,
  type GoalPriority,
  type GoalRequest,
  type GoalStatus,
  type Milestone,
  type MilestoneId,
  type MissionProposal,
  type MissionTree,
  type Objective,
  type ObjectiveId,
  type Priority,
  type ProposalId,
  type ProposedMission,
  type ProposedMissionId,
  type RoleEstimate,
} from './ProducerTypes';

/** Production clock/id primitives, shared with the rest of Nova. */
const defaultClock: Clock = SystemClock;
const defaultIds: IdGenerator = UuidGenerator;

export interface ProducerOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  /**
   * The strategy that turns a Goal into Objectives, Milestones, and estimates.
   * Defaults to the built-in deterministic {@link HeuristicGoalAnalyzer}. The
   * future Planner (with Memory + Knowledge) will supply a richer implementation
   * of this same interface — the Producer's structure never changes.
   */
  readonly analyzer?: GoalAnalyzer;
}

/**
 * The raw analysis a {@link GoalAnalyzer} produces before the Producer stamps it
 * with ids and timestamps. Kept separate so analyzers stay pure and free of
 * clock/id concerns.
 */
export interface AnalysisDraft {
  readonly objectives: ReadonlyArray<ObjectiveDraft>;
  readonly milestones: ReadonlyArray<MilestoneDraft>;
  readonly summary: string;
}

/** An objective before the Producer assigns it a stable id. */
export interface ObjectiveDraft {
  /** Stable local key used to wire milestones to objectives within a draft. */
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly priority: Priority;
  readonly complexity: Complexity;
  readonly capabilities: ReadonlyArray<CapabilityEstimate>;
}

/** A milestone before the Producer assigns ids, referencing objectives by key. */
export interface MilestoneDraft {
  readonly title: string;
  readonly description: string;
  readonly order: number;
  /** Keys of the objectives (see {@link ObjectiveDraft.key}) this milestone delivers. */
  readonly objectiveKeys: ReadonlyArray<string>;
}

/**
 * Transforms a Goal into a structured {@link AnalysisDraft}. This is the single
 * seam where richer intelligence (the Planner, informed by Memory and Knowledge)
 * will plug in later. It is intentionally *not* an AI model here — the default
 * implementation is a deterministic domain heuristic.
 */
export interface GoalAnalyzer {
  analyze(goal: Goal): AnalysisDraft;
}

/**
 * Constructs and validates {@link Goal} aggregates and derives their analysis
 * products (Objectives, Milestones, Mission Tree, Approval Package).
 *
 * The Producer is the *only* place that assembles these domain objects, keeping
 * construction rules (defaulting, id/time stamping, derivation, validation) in
 * one testable unit. `Clock` and `IdGenerator` are injected so tests get
 * deterministic ids/timestamps and the service never touches `Date.now()` /
 * `crypto` directly — matching the Coordinator and Project System.
 *
 * The service is pure: it validates, derives, and returns new objects. It never
 * registers, stores, emits, or transitions on its own — orchestration lives in
 * {@link ProducerManager}. Critically, it never creates Coordinator Missions; it
 * only *proposes* a {@link MissionTree}.
 */
export class Producer {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly analyzer: GoalAnalyzer;

  constructor(options: ProducerOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.idGenerator = options.idGenerator ?? defaultIds;
    this.analyzer = options.analyzer ?? new HeuristicGoalAnalyzer();
  }

  /**
   * Build the initial {@link Goal} from a {@link GoalRequest}. Applies defaults,
   * validates, and starts the goal in `submitted`. Throws
   * {@link GoalValidationError} on invalid input.
   */
  create(request: GoalRequest): Goal {
    const violations = validateRequest(request);
    if (violations.length > 0) {
      throw new GoalValidationError(violations);
    }

    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as GoalId;
    const priority: GoalPriority = request.priority ?? 'normal';

    const goal: Goal = {
      id,
      projectId: request.projectId,
      title: request.title.trim(),
      description: request.description.trim(),
      priority,
      status: 'submitted',
      constraints: request.constraints ?? [],
      analysis: null,
      missionTree: null,
      proposal: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata ?? {},
    };

    return goal;
  }

  /**
   * Analyse a Goal into Objectives, Milestones, and role/capability estimates.
   * Delegates decomposition to the injected {@link GoalAnalyzer}, then stamps ids
   * and timestamps and rolls the estimates up from the objectives. Pure — returns
   * a {@link GoalAnalysis}; it neither mutates nor stores the goal.
   */
  analyze(goal: Goal): GoalAnalysis {
    const draft = this.analyzer.analyze(goal);
    if (draft.objectives.length === 0) {
      throw new GoalValidationError([
        { field: 'objectives', reason: 'analysis produced no objectives' },
      ]);
    }

    const keyToId = new Map<string, ObjectiveId>();
    const objectives: Objective[] = draft.objectives.map((o) => {
      const id = this.idGenerator.generate() as UUID as ObjectiveId;
      keyToId.set(o.key, id);
      return {
        id,
        title: o.title,
        description: o.description,
        priority: o.priority,
        complexity: o.complexity,
        capabilities: dedupeCapabilities(o.capabilities),
      };
    });

    const milestones: Milestone[] = draft.milestones
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m, index) => {
        const id = this.idGenerator.generate() as UUID as MilestoneId;
        const objectiveIds = m.objectiveKeys
          .map((key) => keyToId.get(key))
          .filter((value): value is ObjectiveId => value !== undefined);
        return {
          id,
          title: m.title,
          description: m.description,
          order: index,
          objectiveIds,
        };
      });

    const estimatedCapabilities = dedupeCapabilities(objectives.flatMap((o) => o.capabilities));
    const requiredRoles = deriveRoleEstimates(objectives);

    return {
      goalId: goal.id,
      objectives,
      milestones,
      requiredRoles,
      estimatedCapabilities,
      summary: draft.summary.trim(),
      analysedAt: this.clock.now() as Timestamp,
    };
  }

  /**
   * Build the {@link MissionTree} from an analysis. Each milestone becomes a
   * parent proposed mission; each objective in it becomes a child. Dependencies
   * are derived from milestone ordering (a milestone's parent depends on the
   * previous milestone's parent). The result is validated for structural
   * integrity and a topological {@link MissionTree.executionOrder} is computed.
   * Throws {@link MissionTreeError} on any structural problem.
   */
  buildMissionTree(goal: Goal, analysis: GoalAnalysis): MissionTree {
    const objectivesById = new Map<ObjectiveId, Objective>(
      analysis.objectives.map((o) => [o.id, o]),
    );

    const nodes: ProposedMission[] = [];
    const rootIds: ProposedMissionId[] = [];
    const dependencies: Dependency[] = [];
    const milestoneParentId = new Map<MilestoneId, ProposedMissionId>();

    let order = 0;
    let previousParent: ProposedMissionId | null = null;

    for (const milestone of analysis.milestones) {
      const parentId = this.idGenerator.generate() as UUID as ProposedMissionId;
      milestoneParentId.set(milestone.id, parentId);
      rootIds.push(parentId);

      const childObjectives = milestone.objectiveIds
        .map((id) => objectivesById.get(id))
        .filter((value): value is Objective => value !== undefined);

      const parentCapabilities = dedupeCapabilities(childObjectives.flatMap((o) => o.capabilities));
      const parentRoles = deriveRoleEstimates(childObjectives);
      const parentComplexity = maxComplexity(childObjectives.map((o) => o.complexity));

      nodes.push({
        id: parentId,
        parentId: null,
        title: milestone.title,
        brief: milestone.description,
        priority: goal.priority,
        complexity: parentComplexity,
        order: order++,
        objectiveId: null,
        milestoneId: milestone.id,
        requiredRoles: parentRoles,
        requiredCapabilities: parentCapabilities,
      });

      if (previousParent !== null) {
        dependencies.push({
          from: parentId,
          to: previousParent,
          reason: `milestone "${milestone.title}" follows the previous milestone`,
        });
      }
      previousParent = parentId;

      for (const objective of childObjectives) {
        const childId = this.idGenerator.generate() as UUID as ProposedMissionId;
        nodes.push({
          id: childId,
          parentId,
          title: objective.title,
          brief: objective.description,
          priority: objective.priority,
          complexity: objective.complexity,
          order: order++,
          objectiveId: objective.id,
          milestoneId: milestone.id,
          requiredRoles: deriveRoleEstimates([objective]),
          requiredCapabilities: objective.capabilities,
        });
        dependencies.push({
          from: childId,
          to: parentId,
          reason: 'child objective belongs to its milestone',
        });
      }
    }

    const executionOrder = topologicalOrder(goal.id, nodes, dependencies);

    const tree: MissionTree = {
      goalId: goal.id,
      nodes,
      rootIds,
      dependencies,
      executionOrder,
      generatedAt: this.clock.now() as Timestamp,
    };

    validateMissionTree(tree);
    return tree;
  }

  /**
   * Assemble the {@link MissionProposal} — the analysis, the Mission Tree, and a
   * rolled-up {@link ApprovalPackage} — that the Coordinator receives. The
   * Producer proposes; the Coordinator decides execution.
   */
  buildProposal(goal: Goal, analysis: GoalAnalysis, tree: MissionTree): MissionProposal {
    const proposalId = this.idGenerator.generate() as UUID as ProposalId;
    const now = this.clock.now() as Timestamp;

    const approvalPackage: ApprovalPackage = {
      goalId: goal.id,
      proposalId,
      title: goal.title,
      summary: analysis.summary,
      missionCount: tree.nodes.length,
      milestoneCount: analysis.milestones.length,
      objectiveCount: analysis.objectives.length,
      requiredRoles: analysis.requiredRoles,
      estimatedCapabilities: analysis.estimatedCapabilities,
      estimatedComplexity: maxComplexity(tree.nodes.map((n) => n.complexity)),
      preparedAt: now,
    };

    return {
      id: proposalId,
      goalId: goal.id,
      projectId: goal.projectId,
      analysis,
      missionTree: tree,
      approvalPackage,
      createdAt: now,
    };
  }

  /** Generate a fresh unique id (used by the manager for correlation). */
  generateId(): UUID {
    return this.idGenerator.generate() as UUID;
  }

  /**
   * Apply a lifecycle transition, returning a *new* aggregate (immutability — the
   * original is never mutated). Re-stamps `updatedAt`. Throws
   * {@link GoalValidationError} for illegal moves. Terminal states cannot be left.
   */
  transition(goal: Goal, to: GoalStatus, patch: Partial<Goal> = {}): Goal {
    if (isTerminal(goal.status)) {
      throw new GoalValidationError([
        { field: 'status', reason: `goal is terminal ("${goal.status}")` },
      ]);
    }
    if (!canTransition(goal.status, to)) {
      throw new GoalValidationError([
        { field: 'status', reason: `illegal transition "${goal.status}" → "${to}"` },
      ]);
    }
    return {
      ...goal,
      ...patch,
      status: to,
      updatedAt: this.clock.now() as Timestamp,
    };
  }
}

/**
 * The default, deterministic {@link GoalAnalyzer}. It is **not** an AI model: it
 * decomposes a Goal into a stable set of game-production objectives grouped into
 * ordered milestones, using simple keyword heuristics over the goal description.
 *
 * This exists so the Producer is fully functional today. The future Planner
 * (backed by Memory + Knowledge) will implement the same {@link GoalAnalyzer}
 * interface with far richer, context-aware decomposition — a drop-in replacement.
 */
export class HeuristicGoalAnalyzer implements GoalAnalyzer {
  analyze(goal: Goal): AnalysisDraft {
    const text = `${goal.title} ${goal.description}`.toLowerCase();

    const foundation: ObjectiveDraft = {
      key: 'foundation',
      title: 'Core systems foundation',
      description: `Establish the foundational systems required for: ${goal.title}.`,
      priority: 'high',
      complexity: 'large',
      capabilities: [
        capability('gameplay-engineering', 0.8),
        capability('systems-architecture', 0.7),
      ],
    };

    const content: ObjectiveDraft = {
      key: 'content',
      title: 'Content and assets',
      description: `Produce the content and assets that realize: ${goal.title}.`,
      priority: 'normal',
      complexity: 'moderate',
      capabilities: [capability('3d-modeling', 0.7), capability('level-design', 0.6)],
    };

    const polish: ObjectiveDraft = {
      key: 'polish',
      title: 'Polish and tuning',
      description: `Tune, balance, and polish the experience for: ${goal.title}.`,
      priority: 'normal',
      complexity: 'small',
      capabilities: [capability('game-design', 0.6), capability('qa-testing', 0.6)],
    };

    const objectives: ObjectiveDraft[] = [foundation, content, polish];

    if (/(physics|realistic|simulation|racing|driving)/.test(text)) {
      objectives.push({
        key: 'physics',
        title: 'Physics and simulation',
        description: `Implement realistic physics and simulation for: ${goal.title}.`,
        priority: 'high',
        complexity: 'large',
        capabilities: [
          capability('vehicle-physics', 0.85),
          capability('gameplay-engineering', 0.7),
        ],
      });
    }

    if (/(ai|opponent|enemy|npc|bot)/.test(text)) {
      objectives.push({
        key: 'ai',
        title: 'AI behaviour',
        description: `Design and implement AI behaviour for: ${goal.title}.`,
        priority: 'normal',
        complexity: 'large',
        capabilities: [capability('ai-programming', 0.8)],
      });
    }

    if (/(audio|sound|music|sfx)/.test(text)) {
      objectives.push({
        key: 'audio',
        title: 'Audio design',
        description: `Create audio and sound design for: ${goal.title}.`,
        priority: 'low',
        complexity: 'moderate',
        capabilities: [capability('audio-mixing', 0.7)],
      });
    }

    const foundationKeys = ['foundation'];
    if (objectives.some((o) => o.key === 'physics')) {
      foundationKeys.push('physics');
    }

    const contentKeys = ['content'];
    if (objectives.some((o) => o.key === 'ai')) {
      contentKeys.push('ai');
    }
    if (objectives.some((o) => o.key === 'audio')) {
      contentKeys.push('audio');
    }

    const milestones: MilestoneDraft[] = [
      {
        title: 'Foundations',
        description: 'Stand up the core systems everything else depends on.',
        order: 0,
        objectiveKeys: foundationKeys,
      },
      {
        title: 'Content',
        description: 'Build the content and behaviour on top of the foundations.',
        order: 1,
        objectiveKeys: contentKeys,
      },
      {
        title: 'Polish',
        description: 'Tune, balance, and finalize the experience.',
        order: 2,
        objectiveKeys: ['polish'],
      },
    ];

    return {
      objectives,
      milestones,
      summary: `Decomposed "${goal.title}" into ${objectives.length} objectives across ${milestones.length} milestones.`,
    };
  }
}

// --- Pure helpers ------------------------------------------------------------

/** Validate a creation request. Returns violations (does not throw). */
export function validateRequest(request: GoalRequest): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (typeof request.projectId !== 'string' || (request.projectId as string).length === 0) {
    violations.push({ field: 'projectId', reason: 'projectId is required' });
  }
  if (typeof request.title !== 'string' || request.title.trim().length === 0) {
    violations.push({ field: 'title', reason: 'title is required' });
  }
  if (typeof request.description !== 'string' || request.description.trim().length === 0) {
    violations.push({ field: 'description', reason: 'description is required' });
  }
  if (
    request.constraints !== undefined &&
    (!Array.isArray(request.constraints) ||
      !request.constraints.every((c) => typeof c === 'string'))
  ) {
    violations.push({ field: 'constraints', reason: 'constraints must be an array of strings' });
  }
  return violations;
}

/**
 * Validate a {@link MissionTree}'s structural integrity: every parent/child and
 * dependency reference resolves to a known node, roots are parentless, and the
 * dependency graph is acyclic. Throws {@link MissionTreeError} on any problem.
 */
export function validateMissionTree(tree: MissionTree): void {
  const ids = new Set<ProposedMissionId>(tree.nodes.map((n) => n.id));

  if (ids.size !== tree.nodes.length) {
    throw new MissionTreeError(tree.goalId, 'duplicate proposed mission ids');
  }

  for (const node of tree.nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) {
      throw new MissionTreeError(
        tree.goalId,
        `node "${node.id}" has unknown parent "${node.parentId}"`,
      );
    }
    if (node.parentId === null && !tree.rootIds.includes(node.id)) {
      throw new MissionTreeError(tree.goalId, `root node "${node.id}" missing from rootIds`);
    }
  }

  for (const rootId of tree.rootIds) {
    if (!ids.has(rootId)) {
      throw new MissionTreeError(tree.goalId, `rootIds references unknown node "${rootId}"`);
    }
  }

  for (const dep of tree.dependencies) {
    if (!ids.has(dep.from)) {
      throw new MissionTreeError(tree.goalId, `dependency from unknown node "${dep.from}"`);
    }
    if (!ids.has(dep.to)) {
      throw new MissionTreeError(tree.goalId, `dependency to unknown node "${dep.to}"`);
    }
    if (dep.from === dep.to) {
      throw new MissionTreeError(tree.goalId, `self-dependency on node "${dep.from}"`);
    }
  }

  // executionOrder must be a permutation of every node id.
  if (tree.executionOrder.length !== tree.nodes.length) {
    throw new MissionTreeError(tree.goalId, 'executionOrder does not cover every node');
  }
  const ordered = new Set(tree.executionOrder);
  if (ordered.size !== tree.nodes.length) {
    throw new MissionTreeError(tree.goalId, 'executionOrder contains duplicates');
  }
  for (const id of tree.executionOrder) {
    if (!ids.has(id)) {
      throw new MissionTreeError(tree.goalId, `executionOrder references unknown node "${id}"`);
    }
  }

  // executionOrder must respect dependencies: a prerequisite precedes its dependent.
  const position = new Map<ProposedMissionId, number>();
  tree.executionOrder.forEach((id, index) => position.set(id, index));
  for (const dep of tree.dependencies) {
    const fromPos = position.get(dep.from);
    const toPos = position.get(dep.to);
    if (fromPos !== undefined && toPos !== undefined && toPos > fromPos) {
      throw new MissionTreeError(
        tree.goalId,
        `executionOrder violates dependency "${dep.to}" → "${dep.from}"`,
      );
    }
  }
}

/**
 * Compute a topological order of nodes such that every dependency's prerequisite
 * (`to`) precedes its dependent (`from`). Uses Kahn's algorithm and detects
 * cycles. Ties are broken by the node's declared `order` for stability. Throws
 * {@link MissionTreeError} on a cycle.
 */
export function topologicalOrder(
  goalId: GoalId,
  nodes: ReadonlyArray<ProposedMission>,
  dependencies: ReadonlyArray<Dependency>,
): ReadonlyArray<ProposedMissionId> {
  const orderOf = new Map<ProposedMissionId, number>(nodes.map((n) => [n.id, n.order]));
  const indegree = new Map<ProposedMissionId, number>(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<ProposedMissionId, ProposedMissionId[]>(nodes.map((n) => [n.id, []]));

  for (const dep of dependencies) {
    // Edge: prerequisite (to) → dependent (from).
    const list = adjacency.get(dep.to);
    if (list === undefined || !indegree.has(dep.from)) {
      throw new MissionTreeError(goalId, 'dependency references unknown node');
    }
    list.push(dep.from);
    indegree.set(dep.from, (indegree.get(dep.from) ?? 0) + 1);
  }

  const ready: ProposedMissionId[] = [];
  for (const [id, degree] of indegree) {
    if (degree === 0) {
      ready.push(id);
    }
  }
  sortByOrder(ready, orderOf);

  const result: ProposedMissionId[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as ProposedMissionId;
    result.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) {
        ready.push(next);
      }
    }
    sortByOrder(ready, orderOf);
  }

  if (result.length !== nodes.length) {
    throw new MissionTreeError(goalId, 'dependency cycle detected');
  }
  return result;
}

/** Derive role estimates from objectives, one role per distinct capability. */
export function deriveRoleEstimates(
  objectives: ReadonlyArray<Objective>,
): ReadonlyArray<RoleEstimate> {
  const byRole = new Map<string, CapabilityEstimate[]>();
  for (const objective of objectives) {
    for (const cap of objective.capabilities) {
      const role = capabilityToRole(cap.capability);
      const list = byRole.get(role) ?? [];
      list.push(cap);
      byRole.set(role, list);
    }
  }
  const roles: RoleEstimate[] = [];
  for (const [role, capabilities] of byRole) {
    roles.push({
      role,
      capabilities: dedupeCapabilities(capabilities),
      rationale: 'estimated from required capabilities',
    });
  }
  roles.sort((a, b) => a.role.localeCompare(b.role));
  return roles;
}

/** Map a capability key to the role kind expected to satisfy it. */
export function capabilityToRole(capability: string): string {
  const map: Readonly<Record<string, string>> = {
    'gameplay-engineering': 'gameplay-engineer',
    'systems-architecture': 'systems-architect',
    'vehicle-physics': 'physics-engineer',
    'ai-programming': 'ai-engineer',
    '3d-modeling': 'technical-artist',
    'level-design': 'level-designer',
    'game-design': 'game-designer',
    'qa-testing': 'qa-engineer',
    'audio-mixing': 'audio-designer',
  };
  return map[capability] ?? `${capability}-specialist`;
}

function capability(key: string, confidence: number): CapabilityEstimate {
  return { capability: key, confidence };
}

function dedupeCapabilities(
  capabilities: ReadonlyArray<CapabilityEstimate>,
): ReadonlyArray<CapabilityEstimate> {
  const byKey = new Map<string, CapabilityEstimate>();
  for (const cap of capabilities) {
    const existing = byKey.get(cap.capability);
    if (existing === undefined || cap.confidence > existing.confidence) {
      byKey.set(cap.capability, cap);
    }
  }
  return [...byKey.values()].sort((a, b) => a.capability.localeCompare(b.capability));
}

function maxComplexity(values: ReadonlyArray<Complexity>): Complexity {
  let max = 0;
  for (const value of values) {
    const index = COMPLEXITY_ORDER.indexOf(value);
    if (index > max) {
      max = index;
    }
  }
  return COMPLEXITY_ORDER[max] ?? 'trivial';
}

function sortByOrder(
  ids: ProposedMissionId[],
  orderOf: ReadonlyMap<ProposedMissionId, number>,
): void {
  ids.sort((a, b) => (orderOf.get(a) ?? 0) - (orderOf.get(b) ?? 0));
}
