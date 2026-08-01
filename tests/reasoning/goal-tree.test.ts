import { describe, expect, it, vi } from 'vitest';
import {
  addNode,
  getReadyNodes,
  markStatus,
  isComplete,
  hasBlockedNodes,
  GoalDecomposer,
} from '@gamedev-agent/ami';
import type { GoalNode, GoalTree, MissionGoal } from '@gamedev-agent/ami';

function node(id: string, overrides: Partial<GoalNode> = {}): GoalNode {
  return {
    id,
    missionId: 'm1',
    parentId: null,
    description: `node ${id}`,
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

describe('goalTree — addNode', () => {
  it('adds a node without mutating the input tree', () => {
    const base = tree([node('a')]);
    const next = addNode(base, node('b'));
    expect(base.nodes.has('b')).toBe(false);
    expect(next.nodes.has('b')).toBe(true);
    expect(next.nodes.size).toBe(2);
  });
});

describe('goalTree — getReadyNodes', () => {
  it('returns pending nodes with no unsatisfied dependencies', () => {
    const t = tree([
      node('a'),
      node('b', { dependencies: ['a'] }),
      node('c', { dependencies: ['b'] }),
    ]);
    const ready = getReadyNodes(t);
    expect(ready.map((n) => n.id)).toEqual(['a']);
  });

  it('unlocks dependents once dependencies are done', () => {
    let t = tree([
      node('a'),
      node('b', { dependencies: ['a'] }),
      node('c', { dependencies: ['b'] }),
    ]);
    t = markStatus(t, 'a', 'done');
    expect(getReadyNodes(t).map((n) => n.id)).toEqual(['b']);
    t = markStatus(t, 'b', 'done');
    expect(getReadyNodes(t).map((n) => n.id)).toEqual(['c']);
  });

  it('skips done, executing, and blocked nodes', () => {
    const t = tree([
      node('a', { status: 'done' }),
      node('b', { status: 'executing' }),
      node('c', { status: 'blocked' }),
    ]);
    expect(getReadyNodes(t)).toEqual([]);
  });

  it('treats a dependency missing from the tree as satisfied', () => {
    const t = tree([node('a', { dependencies: ['ghost'] })]);
    expect(getReadyNodes(t).map((n) => n.id)).toEqual(['a']);
  });
});

describe('goalTree — markStatus / isComplete / hasBlockedNodes', () => {
  it('isComplete is false for an empty or partially-done tree', () => {
    expect(isComplete(tree([]))).toBe(false);
    const t = tree([node('a', { status: 'done' }), node('b', { status: 'pending' })]);
    expect(isComplete(t)).toBe(false);
  });

  it('isComplete is true when every node is done', () => {
    const t = tree([node('a', { status: 'done' }), node('b', { status: 'done' })]);
    expect(isComplete(t)).toBe(true);
  });

  it('markStatus returns the same tree for an unknown node id', () => {
    const t = tree([node('a')]);
    expect(markStatus(t, 'nope', 'done')).toBe(t);
  });

  it('hasBlockedNodes detects blocked nodes', () => {
    expect(hasBlockedNodes(tree([node('a')]))).toBe(false);
    expect(hasBlockedNodes(tree([node('a', { status: 'blocked' })]))).toBe(true);
  });
});

describe('GoalDecomposer', () => {
  const mission: MissionGoal = {
    id: 'msn-1',
    missionId: 'm1',
    description: 'Create a Three.js scene',
    acceptanceCriteria: [{ id: 'ac1', kind: 'build', description: 'scene builds', params: {} }],
  };

  function llmResponding(content: string): { complete: (p: string) => Promise<string> } {
    return { complete: vi.fn().mockResolvedValue(content) };
  }

  it('builds a root plus sub-goals in dependency order', async () => {
    const llm = llmResponding(JSON.stringify({
      subgoals: [
        { description: 'init project', estimatedComplexity: 1 },
        { description: 'add scene', dependsOn: [0], estimatedComplexity: 3, highImpact: true },
      ],
    }));
    const decomposer = new GoalDecomposer(llm as never);
    const result = await decomposer.decompose(mission);

    expect(result.rootId).toBe('msn-1-root');
    expect(result.nodes.size).toBe(3);
    const root = result.nodes.get('msn-1-root')!;
    expect(root.parentId).toBeNull();
    expect(root.acceptanceCriteria).toHaveLength(1);

    const g0 = result.nodes.get('msn-1-g0')!;
    const g1 = result.nodes.get('msn-1-g1')!;
    expect(g0.dependencies).toEqual(['msn-1-root']);
    expect(g1.dependencies).toEqual(['msn-1-root', 'msn-1-g0']);
    expect(g1.highImpact).toBe(true);
    expect(g1.estimatedComplexity).toBe(3);
  });

  it('falls back to a root-only tree on invalid LLM output', async () => {
    const decomposer = new GoalDecomposer(llmResponding('not json at all') as never);
    const result = await decomposer.decompose(mission);
    expect(result.nodes.size).toBe(1);
    expect(result.nodes.get(result.rootId)).toBeDefined();
  });

  it('falls back to a root-only tree on missing subgoals field', async () => {
    const decomposer = new GoalDecomposer(llmResponding('{"other": 1}') as never);
    const result = await decomposer.decompose(mission);
    expect(result.nodes.size).toBe(1);
  });

  it('ignores out-of-range dependency indexes', async () => {
    const llm = llmResponding(JSON.stringify({
      subgoals: [
        { description: 'a', dependsOn: [5] },
      ],
    }));
    const decomposer = new GoalDecomposer(llm as never);
    const result = await decomposer.decompose(mission);
    const g0 = result.nodes.get('msn-1-g0')!;
    expect(g0.dependencies).toEqual(['msn-1-root']);
  });

  it('marks the root highImpact for high-priority missions', async () => {
    const decomposer = new GoalDecomposer(llmResponding('{}') as never);
    const result = await decomposer.decompose({ ...mission, priority: 7 });
    expect(result.nodes.get(result.rootId)!.highImpact).toBe(true);
  });

  it('injects the mission description into the LLM prompt', async () => {
    const llm = { complete: vi.fn().mockResolvedValue('{}') };
    const decomposer = new GoalDecomposer(llm as never);
    await decomposer.decompose(mission);
    const prompt = llm.complete.mock.calls[0]![0] as string;
    expect(prompt).toContain('Create a Three.js scene');
  });
});
