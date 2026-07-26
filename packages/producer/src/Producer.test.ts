import { describe, expect, it } from 'vitest';
import {
  Producer,
  capabilityToRole,
  deriveRoleEstimates,
  topologicalOrder,
  validateMissionTree,
  validateRequest,
} from './Producer';
import { GoalValidationError, MissionTreeError } from './ProducerErrors';
import type {
  Dependency,
  GoalId,
  MissionTree,
  Objective,
  ObjectiveId,
  ProposedMission,
  ProposedMissionId,
} from './ProducerTypes';
import { FixedClock, SequenceIdGenerator, makeGoalRequest } from './test_helpers';

function newProducer(): Producer {
  return new Producer({
    clock: new FixedClock(1000),
    idGenerator: new SequenceIdGenerator(),
  });
}

describe('Producer.create', () => {
  it('creates a goal in submitted with defaults applied', () => {
    const goal = newProducer().create({
      projectId: 'project-1' as never,
      title: 'Racing',
      description: 'drive fast',
    });
    expect(goal.status).toBe('submitted');
    expect(goal.priority).toBe('normal');
    expect(goal.analysis).toBeNull();
    expect(goal.missionTree).toBeNull();
    expect(goal.proposal).toBeNull();
  });

  it('trims title and description', () => {
    const goal = newProducer().create(
      makeGoalRequest({ title: '  Racing  ', description: '  drive fast  ' }),
    );
    expect(goal.title).toBe('Racing');
    expect(goal.description).toBe('drive fast');
  });

  it('rejects invalid requests', () => {
    expect(() => newProducer().create(makeGoalRequest({ title: '   ' }))).toThrow(
      GoalValidationError,
    );
    expect(() => newProducer().create(makeGoalRequest({ description: '' }))).toThrow(
      GoalValidationError,
    );
  });
});

describe('validateRequest', () => {
  it('reports each missing field', () => {
    const violations = validateRequest({
      projectId: '' as never,
      title: '',
      description: '',
    });
    expect(violations.map((v) => v.field)).toEqual(['projectId', 'title', 'description']);
  });

  it('rejects non-string constraints', () => {
    const violations = validateRequest({
      ...makeGoalRequest(),
      constraints: [1 as never],
    });
    expect(violations.some((v) => v.field === 'constraints')).toBe(true);
  });
});

describe('Producer.analyze', () => {
  it('derives objectives, milestones, roles, and capabilities', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const analysis = producer.analyze(goal);

    expect(analysis.objectives.length).toBeGreaterThan(0);
    expect(analysis.milestones.length).toBe(3);
    expect(analysis.requiredRoles.length).toBeGreaterThan(0);
    expect(analysis.estimatedCapabilities.length).toBeGreaterThan(0);
    expect(analysis.summary).toContain('Realistic Formula racing');
  });

  it('adds physics and AI objectives when the goal mentions them', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const analysis = producer.analyze(goal);
    const titles = analysis.objectives.map((o) => o.title);
    expect(titles).toContain('Physics and simulation');
    expect(titles).toContain('AI behaviour');
  });

  it('orders milestones by their declared order', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const analysis = producer.analyze(goal);
    const orders = analysis.milestones.map((m) => m.order);
    expect(orders).toEqual([0, 1, 2]);
  });

  it('throws when the analyzer produces no objectives', () => {
    const producer = new Producer({
      clock: new FixedClock(1000),
      idGenerator: new SequenceIdGenerator(),
      analyzer: { analyze: () => ({ objectives: [], milestones: [], summary: '' }) },
    });
    const goal = producer.create(makeGoalRequest());
    expect(() => producer.analyze(goal)).toThrow(GoalValidationError);
  });
});

describe('Producer.buildMissionTree', () => {
  it('creates parent milestones and child objectives with dependencies and ordering', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const analysis = producer.analyze(goal);
    const tree = producer.buildMissionTree(goal, analysis);

    expect(tree.rootIds.length).toBe(analysis.milestones.length);
    expect(tree.nodes.length).toBeGreaterThan(analysis.milestones.length);
    expect(tree.executionOrder.length).toBe(tree.nodes.length);
    expect(tree.dependencies.length).toBeGreaterThan(0);

    for (const rootId of tree.rootIds) {
      const root = tree.nodes.find((n) => n.id === rootId);
      expect(root?.parentId).toBeNull();
    }
  });

  it('orders execution so prerequisites precede dependents', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const analysis = producer.analyze(goal);
    const tree = producer.buildMissionTree(goal, analysis);

    const position = new Map(tree.executionOrder.map((id, i) => [id, i]));
    for (const dep of tree.dependencies) {
      const toPos = position.get(dep.to) ?? -1;
      const fromPos = position.get(dep.from) ?? -1;
      expect(toPos).toBeLessThan(fromPos);
    }
  });

  it('produces a structurally valid tree', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const analysis = producer.analyze(goal);
    const tree = producer.buildMissionTree(goal, analysis);
    expect(() => validateMissionTree(tree)).not.toThrow();
  });
});

describe('validateMissionTree', () => {
  const goalId = 'goal-1' as GoalId;
  const a = 'a' as ProposedMissionId;
  const b = 'b' as ProposedMissionId;

  function node(
    id: ProposedMissionId,
    parentId: ProposedMissionId | null,
    order: number,
  ): ProposedMission {
    return {
      id,
      parentId,
      title: id,
      brief: id,
      priority: 'normal',
      complexity: 'small',
      order,
      objectiveId: null,
      milestoneId: null,
      requiredRoles: [],
      requiredCapabilities: [],
    };
  }

  it('rejects dangling parent references', () => {
    const tree: MissionTree = {
      goalId,
      nodes: [node(a, b, 0)],
      rootIds: [],
      dependencies: [],
      executionOrder: [a],
      generatedAt: 1000 as never,
    };
    expect(() => validateMissionTree(tree)).toThrow(MissionTreeError);
  });

  it('rejects dependencies to unknown nodes', () => {
    const tree: MissionTree = {
      goalId,
      nodes: [node(a, null, 0)],
      rootIds: [a],
      dependencies: [{ from: a, to: b }],
      executionOrder: [a],
      generatedAt: 1000 as never,
    };
    expect(() => validateMissionTree(tree)).toThrow(MissionTreeError);
  });

  it('rejects self-dependencies', () => {
    const tree: MissionTree = {
      goalId,
      nodes: [node(a, null, 0)],
      rootIds: [a],
      dependencies: [{ from: a, to: a }],
      executionOrder: [a],
      generatedAt: 1000 as never,
    };
    expect(() => validateMissionTree(tree)).toThrow(MissionTreeError);
  });

  it('rejects an execution order that violates a dependency', () => {
    const tree: MissionTree = {
      goalId,
      nodes: [node(a, null, 0), node(b, null, 1)],
      rootIds: [a, b],
      dependencies: [{ from: a, to: b }],
      executionOrder: [a, b],
      generatedAt: 1000 as never,
    };
    expect(() => validateMissionTree(tree)).toThrow(MissionTreeError);
  });

  it('rejects an incomplete execution order', () => {
    const tree: MissionTree = {
      goalId,
      nodes: [node(a, null, 0), node(b, null, 1)],
      rootIds: [a, b],
      dependencies: [],
      executionOrder: [a],
      generatedAt: 1000 as never,
    };
    expect(() => validateMissionTree(tree)).toThrow(MissionTreeError);
  });
});

describe('topologicalOrder', () => {
  const goalId = 'goal-1' as GoalId;

  function node(id: string, order: number): ProposedMission {
    return {
      id: id as ProposedMissionId,
      parentId: null,
      title: id,
      brief: id,
      priority: 'normal',
      complexity: 'small',
      order,
      objectiveId: null,
      milestoneId: null,
      requiredRoles: [],
      requiredCapabilities: [],
    };
  }

  it('orders prerequisites before dependents', () => {
    const nodes = [node('a', 0), node('b', 1), node('c', 2)];
    const deps: Dependency[] = [
      { from: 'c' as ProposedMissionId, to: 'b' as ProposedMissionId },
      { from: 'b' as ProposedMissionId, to: 'a' as ProposedMissionId },
    ];
    const order = topologicalOrder(goalId, nodes, deps);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('detects cycles', () => {
    const nodes = [node('a', 0), node('b', 1)];
    const deps: Dependency[] = [
      { from: 'a' as ProposedMissionId, to: 'b' as ProposedMissionId },
      { from: 'b' as ProposedMissionId, to: 'a' as ProposedMissionId },
    ];
    expect(() => topologicalOrder(goalId, nodes, deps)).toThrow(MissionTreeError);
  });

  it('breaks ties by declared order', () => {
    const nodes = [node('a', 2), node('b', 0), node('c', 1)];
    const order = topologicalOrder(goalId, nodes, []);
    expect(order).toEqual(['b', 'c', 'a']);
  });
});

describe('deriveRoleEstimates & capabilityToRole', () => {
  it('maps known capabilities to specific roles', () => {
    expect(capabilityToRole('vehicle-physics')).toBe('physics-engineer');
    expect(capabilityToRole('ai-programming')).toBe('ai-engineer');
  });

  it('falls back to a specialist role for unknown capabilities', () => {
    expect(capabilityToRole('quantum-shading')).toBe('quantum-shading-specialist');
  });

  it('derives one role per distinct capability', () => {
    const objectives: Objective[] = [
      {
        id: 'o1' as ObjectiveId,
        title: 'x',
        description: 'x',
        priority: 'normal',
        complexity: 'small',
        capabilities: [
          { capability: 'vehicle-physics', confidence: 0.8 },
          { capability: 'ai-programming', confidence: 0.7 },
        ],
      },
    ];
    const roles = deriveRoleEstimates(objectives);
    expect(roles.map((r) => r.role).sort()).toEqual(['ai-engineer', 'physics-engineer']);
  });
});

describe('Producer.buildProposal', () => {
  it('assembles an approval package rolling up the analysis and tree', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const analysis = producer.analyze(goal);
    const tree = producer.buildMissionTree(goal, analysis);
    const proposal = producer.buildProposal(goal, analysis, tree);

    expect(proposal.goalId).toBe(goal.id);
    expect(proposal.approvalPackage.missionCount).toBe(tree.nodes.length);
    expect(proposal.approvalPackage.milestoneCount).toBe(analysis.milestones.length);
    expect(proposal.approvalPackage.objectiveCount).toBe(analysis.objectives.length);
    expect(proposal.approvalPackage.requiredRoles.length).toBeGreaterThan(0);
    expect(proposal.approvalPackage.estimatedComplexity).toBeDefined();
  });
});

describe('Producer.transition', () => {
  it('refuses to leave terminal states', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    const rejected = producer.transition(goal, 'rejected', { rejectionReason: 'no' });
    expect(() => producer.transition(rejected, 'analysing')).toThrow(GoalValidationError);
  });

  it('refuses illegal transitions', () => {
    const producer = newProducer();
    const goal = producer.create(makeGoalRequest());
    expect(() => producer.transition(goal, 'approved')).toThrow(GoalValidationError);
  });
});
