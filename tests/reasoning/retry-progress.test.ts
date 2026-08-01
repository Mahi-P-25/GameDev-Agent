import { describe, expect, it } from 'vitest';
import { DEFAULT_RETRY_POLICY, ProgressEstimator, RetryStrategyResolver } from '@gamedev-agent/ami';
import type { GoalNode, GoalTree } from '@gamedev-agent/ami';

function node(id: string, overrides: Partial<GoalNode> = {}): GoalNode {
  return {
    id,
    missionId: 'm1',
    parentId: null,
    description: id,
    status: 'pending',
    acceptanceCriteria: [],
    dependencies: [],
    estimatedComplexity: 1,
    attempts: 0,
    highImpact: false,
    ...overrides,
  };
}

function tree(nodes: GoalNode[]): GoalTree {
  return {
    missionId: 'm1',
    rootId: nodes[0]?.id ?? 'root',
    nodes: new Map(nodes.map((n) => [n.id, n])),
  };
}

describe('RetryStrategyResolver', () => {
  it('applies the default policy for unknown kinds', () => {
    const resolver = new RetryStrategyResolver();
    expect(resolver.resolve('write-files')).toEqual(DEFAULT_RETRY_POLICY);
  });

  it('applies the default for the default policy shape', () => {
    const resolver = new RetryStrategyResolver();
    const policy = resolver.resolve('any');
    expect(policy.maxAttempts).toBe(3);
    expect(policy.backoffMs).toBe(1000);
    expect(policy.backoffFactor).toBe(2);
    expect(policy.escalateAfter).toBe(2);
    expect(policy.alternateToolAllowed).toBe(true);
  });

  it('merges a partial per-kind policy over the default', () => {
    const resolver = new RetryStrategyResolver({ 'git.commit': { maxAttempts: 1, alternateToolAllowed: false } });
    const policy = resolver.resolve('git.commit');
    expect(policy.maxAttempts).toBe(1);
    expect(policy.alternateToolAllowed).toBe(false);
    expect(policy.backoffMs).toBe(1000);
    expect(policy.escalateAfter).toBe(2);
  });

  it('does not leak a per-kind policy into other kinds', () => {
    const resolver = new RetryStrategyResolver({ 'git.commit': { maxAttempts: 1 } });
    expect(resolver.resolve('git.commit').maxAttempts).toBe(1);
    expect(resolver.resolve('write-files').maxAttempts).toBe(3);
  });
});

describe('ProgressEstimator', () => {
  it('reports 0% for an all-pending tree', () => {
    const report = new ProgressEstimator().estimate(tree([node('a'), node('b')]));
    expect(report.percent).toBe(0);
    expect(report.completedGoals).toBe(0);
    expect(report.totalGoals).toBe(2);
    expect(report.remainingGoals).toBe(2);
  });

  it('reports 100% for a fully-done tree', () => {
    const report = new ProgressEstimator().estimate(
      tree([node('a', { status: 'done' }), node('b', { status: 'done' })]),
    );
    expect(report.percent).toBe(100);
    expect(report.completedGoals).toBe(2);
    expect(report.remainingGoals).toBe(0);
  });

  it('weights progress by estimated complexity', () => {
    // Total weight 1 + 3 = 4; node b (weight 3) done → 75%
    const report = new ProgressEstimator().estimate(
      tree([
        node('a', { estimatedComplexity: 1 }),
        node('b', { estimatedComplexity: 3, status: 'done' }),
      ]),
    );
    expect(report.percent).toBe(75);
    expect(report.estimatedRemainingSteps).toBe(1);
  });

  it('is deterministic for identical trees', () => {
    const estimator = new ProgressEstimator();
    const t = tree([node('a', { estimatedComplexity: 2 }), node('b', { status: 'done' })]);
    const r1 = estimator.estimate(t);
    const r2 = estimator.estimate(t);
    expect(r1).toEqual(r2);
  });

  it('handles an empty tree without dividing by zero', () => {
    const report = new ProgressEstimator().estimate(tree([]));
    expect(report.percent).toBe(0);
    expect(report.totalGoals).toBe(0);
    expect(report.estimatedRemainingSteps).toBe(0);
  });

  it('treats non-positive complexity as 1', () => {
    const report = new ProgressEstimator().estimate(
      tree([node('a', { estimatedComplexity: 0 }), node('b', { estimatedComplexity: -2 })]),
    );
    expect(report.estimatedRemainingSteps).toBe(2);
  });

  it('counts non-done states as remaining', () => {
    const report = new ProgressEstimator().estimate(
      tree([node('a', { status: 'blocked' }), node('b', { status: 'done' })]),
    );
    expect(report.remainingGoals).toBe(1);
    expect(report.estimatedRemainingSteps).toBe(1);
  });
});
