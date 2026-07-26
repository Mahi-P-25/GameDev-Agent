import type { Dependency } from '@gamedev-agent/producer';
import { describe, expect, it } from 'vitest';
import { Planner } from './Planner';
import { PlanGraphError, PlanValidationError } from './PlannerErrors';
import { DependencyGraphStrategy, SequentialPlanningStrategy } from './PlanningStrategy';
import { FixedClock, SequenceIdGenerator, makeMissionProposal, makeNode } from './test_helpers';

function makePlanner(): Planner {
  return new Planner({
    clock: new FixedClock(),
    idGenerator: new SequenceIdGenerator(),
  });
}

describe('Planner.validation', () => {
  it('rejects an empty mission tree', () => {
    const planner = makePlanner();
    const proposal = makeMissionProposal({ nodes: [] });
    expect(() => planner.plan(proposal, new DependencyGraphStrategy(), null, 'sequential')).toThrow(
      PlanValidationError,
    );
  });

  it('rejects dangling dependency edges', () => {
    const planner = makePlanner();
    const deps: Array<Dependency> = [{ from: 'a' as never, to: 'ghost' as never }];
    const proposal = makeMissionProposal({ dependencies: deps });
    expect(() => planner.plan(proposal, new DependencyGraphStrategy(), null, 'sequential')).toThrow(
      PlanGraphError,
    );
  });

  it('rejects a dangling parent reference', () => {
    const planner = makePlanner();
    const proposal = makeMissionProposal({
      nodes: [
        {
          id: 'a' as never,
          parentId: 'ghost' as never,
          title: 'A',
          brief: 'b',
          priority: 'medium',
          complexity: 'moderate',
          order: 0,
          objectiveId: null,
          milestoneId: null,
          requiredRoles: [],
          requiredCapabilities: [],
        },
      ],
    });
    expect(() => planner.plan(proposal, new DependencyGraphStrategy(), null, 'sequential')).toThrow(
      PlanGraphError,
    );
  });

  it('rejects a dependency cycle', () => {
    const planner = makePlanner();
    const deps: Array<Dependency> = [
      { from: 'a' as never, to: 'b' as never },
      { from: 'b' as never, to: 'a' as never },
    ];
    const proposal = makeMissionProposal({
      nodes: [makeNode({ id: 'a', order: 0 }), makeNode({ id: 'b', order: 1 })],
      dependencies: deps,
    });
    expect(() => planner.plan(proposal, new DependencyGraphStrategy(), null, 'sequential')).toThrow(
      PlanGraphError,
    );
  });
});

describe('Planner.dependency-graph strategy', () => {
  it('produces an immutable plan with phases keyed to milestones', () => {
    const planner = makePlanner();
    const proposal = makeMissionProposal();
    const plan = planner.plan(proposal, new DependencyGraphStrategy(), null, 'sequential');

    expect(plan.phases.length).toBe(1);
    expect(plan.phases[0]?.title).toBe('Foundation');
    expect(plan.steps.size).toBe(2);
    expect(plan.strategy).toBe('dependency-graph');
    expect(plan.order).toEqual(['a', 'b']);
  });

  it('packs an acyclic dependency chain into ordered waves', () => {
    const planner = makePlanner();
    const deps: Array<Dependency> = [{ from: 'b' as never, to: 'a' as never }];
    const proposal = makeMissionProposal({
      nodes: [
        makeNode({ id: 'a', order: 0, milestoneId: 'm1' }),
        makeNode({ id: 'b', order: 1, milestoneId: 'm1' }),
      ],
      milestones: [
        { id: 'm1' as never, title: 'Foundation', description: 'd', order: 0, objectiveIds: [] },
      ],
      dependencies: deps,
    });
    const plan = planner.plan(proposal, new DependencyGraphStrategy(), null, 'parallel');

    // a has no in-phase deps; b depends on a, so a leads and b follows.
    expect(plan.order).toEqual(['a', 'b']);
    const groups = plan.phases[0]?.groups ?? [];
    // parallel mode: each wave is one multi-step group; here two single-step waves.
    expect(groups.length).toBe(2);
    expect(groups[0]?.mode).toBe('parallel');
    expect(groups[1]?.mode).toBe('parallel');
  });

  it('records dependency and capability constraints', () => {
    const planner = makePlanner();
    const proposal = makeMissionProposal();
    const plan = planner.plan(proposal, new DependencyGraphStrategy(), null, 'sequential');

    const kinds = plan.constraints.map((c) => c.kind);
    expect(kinds).toContain('approval-gate');
    expect(kinds).toContain('capability');
  });

  it('bridges to a WorkflowSource the Workflow Engine can consume', () => {
    const planner = makePlanner();
    const proposal = makeMissionProposal();
    const plan = planner.plan(proposal, new DependencyGraphStrategy(), null, 'sequential');
    const source = plan.toWorkflowSource();

    expect(source.steps.length).toBe(2);
    expect(source.mode).toBe('sequential');
    expect(source.projectId).toBe('project-1');
    expect(source.steps.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('Planner.sequential strategy', () => {
  it('flattens every node into a single phase in declared order', () => {
    const planner = makePlanner();
    const proposal = makeMissionProposal({
      nodes: [makeNode({ id: 'b', order: 1 }), makeNode({ id: 'a', order: 0 })],
    });
    const plan = planner.plan(proposal, new SequentialPlanningStrategy(), null, 'sequential');

    expect(plan.phases.length).toBe(1);
    expect(plan.order).toEqual(['a', 'b']);
    expect(plan.steps.size).toBe(2);
  });
});

describe('Planner.immutability', () => {
  it('returns a frozen plan that callers cannot mutate', () => {
    const planner = makePlanner();
    const plan = planner.plan(
      makeMissionProposal(),
      new DependencyGraphStrategy(),
      null,
      'sequential',
    );
    expect(Object.isFrozen(plan)).toBe(true);
  });
});
