import { describe, expect, it } from 'vitest';
import {
  computeLevels,
  criticalPath,
  detectCycles,
  edgeCount,
  flattenGraph,
  hasCycle,
  nodeCount,
  topologicalSort,
} from './algorithms';
import { TaskGraphBuilder } from './builder';
import {
  makeDiamondGraph,
  makeForkJoinGraph,
  makeLayeredDAG,
  makeLinearGraph,
} from './test_helpers';
import type { NodeId } from './types';

describe('flattenGraph', () => {
  it('flattens a simple graph unchanged', () => {
    const graph = makeLinearGraph(3);
    const flat = flattenGraph(graph);
    expect(flat.nodes.size).toBe(3);
    expect(flat.edges).toHaveLength(2);
  });

  it('flattens subgraphs into a single level', () => {
    const builder = new TaskGraphBuilder({ id: 'parent' });
    builder.addNode('extra', { label: 'Extra' });
    const subBuilder = new TaskGraphBuilder({ id: 'sub' })
      .addNode('s1', { label: 'Sub 1' })
      .addNode('s2', { label: 'Sub 2' })
      .addEdge('s1', 's2');
    builder.addSubgraph(subBuilder);
    builder.addEdge('extra', 's1');
    const graph = builder.build();
    const flat = flattenGraph(graph);
    expect(flat.nodes.size).toBe(3);
    expect(flat.edges).toHaveLength(2);
  });
});

describe('detectCycles / hasCycle', () => {
  it('detects no cycles in a linear graph', () => {
    const graph = makeLinearGraph(5);
    const flat = flattenGraph(graph);
    expect(hasCycle(flat)).toBe(false);
    expect(detectCycles(flat)).toHaveLength(0);
  });

  it('detects no cycles in a DAG', () => {
    const graph = makeDiamondGraph(3);
    const flat = flattenGraph(graph);
    expect(hasCycle(flat)).toBe(false);
  });

  it('detects a cycle', () => {
    const builder = new TaskGraphBuilder();
    builder.addNode('a', { label: 'A' });
    builder.addNode('b', { label: 'B' });
    builder.addNode('c', { label: 'C' });
    builder.addEdge('a', 'b');
    builder.addEdge('b', 'c');
    builder.addEdge('c', 'a');
    const graph = builder.build();
    const flat = flattenGraph(graph);
    expect(hasCycle(flat)).toBe(true);
    expect(detectCycles(flat)).toHaveLength(1);
  });

  it('detects a self-loop as a cycle', () => {
    const builder = new TaskGraphBuilder();
    builder.addNode('a', { label: 'A' });
    builder.addEdge('a', 'a');
    const graph = builder.build();
    const flat = flattenGraph(graph);
    expect(hasCycle(flat)).toBe(true);
  });
});

describe('topologicalSort', () => {
  it('sorts a linear graph in order', () => {
    const graph = makeLinearGraph(5);
    const flat = flattenGraph(graph);
    const order = topologicalSort(flat);
    expect(order).toEqual([
      'n0' as NodeId,
      'n1' as NodeId,
      'n2' as NodeId,
      'n3' as NodeId,
      'n4' as NodeId,
    ]);
  });

  it('sorts a diamond graph with sources first', () => {
    const graph = makeDiamondGraph(3);
    const flat = flattenGraph(graph);
    const order = topologicalSort(flat);
    expect(order[0]).toBe('source');
    expect(order[order.length - 1]).toBe('sink');
  });

  it('throws for a cyclic graph', () => {
    const builder = new TaskGraphBuilder();
    builder.addNode('a', { label: 'A' });
    builder.addNode('b', { label: 'B' });
    builder.addNode('c', { label: 'C' });
    builder.addEdge('a', 'b');
    builder.addEdge('b', 'c');
    builder.addEdge('c', 'a');
    const graph = builder.build();
    const flat = flattenGraph(graph);
    expect(() => topologicalSort(flat)).toThrow();
  });

  it('produces a valid topological order', () => {
    const graph = makeLayeredDAG(4, 3);
    const flat = flattenGraph(graph);
    const order = topologicalSort(flat);
    const positions = new Map<NodeId, number>();
    order.forEach((id, i) => positions.set(id, i));
    for (const edge of flat.edges) {
      const fromPos = positions.get(edge.from);
      const toPos = positions.get(edge.to);
      expect(fromPos).toBeDefined();
      expect(toPos).toBeDefined();
      expect(fromPos).toBeLessThan(toPos as number);
    }
  });
});

describe('criticalPath', () => {
  it('finds the full path in a linear graph', () => {
    const graph = makeLinearGraph(5);
    const flat = flattenGraph(graph);
    const path = criticalPath(flat);
    expect(path).toEqual([
      'n0' as NodeId,
      'n1' as NodeId,
      'n2' as NodeId,
      'n3' as NodeId,
      'n4' as NodeId,
    ]);
  });

  it('finds the longest path in a diamond', () => {
    const graph = makeForkJoinGraph();
    const flat = flattenGraph(graph);
    const path = criticalPath(flat);
    expect(path[0]).toBe('start');
    expect(path[path.length - 1]).toBe('end');
    expect(path).toHaveLength(3);
  });

  it('path respects topological order', () => {
    const graph = makeLayeredDAG(5, 2);
    const flat = flattenGraph(graph);
    const path = criticalPath(flat);
    expect(path.length).toBeGreaterThanOrEqual(5);
    const order = topologicalSort(flat);
    for (let i = 1; i < path.length; i++) {
      const index = order.indexOf(path[i] as NodeId);
      const prevIndex = order.indexOf(path[i - 1] as NodeId);
      expect(prevIndex).toBeLessThan(index);
    }
  });
});

describe('computeLevels', () => {
  it('levels a linear graph incrementally', () => {
    const graph = makeLinearGraph(4);
    const flat = flattenGraph(graph);
    const levels = computeLevels(flat);
    expect(levels.get('n0' as NodeId)).toBe(0);
    expect(levels.get('n1' as NodeId)).toBe(1);
    expect(levels.get('n2' as NodeId)).toBe(2);
    expect(levels.get('n3' as NodeId)).toBe(3);
  });

  it('parallel nodes share the same level', () => {
    const graph = makeDiamondGraph(3);
    const flat = flattenGraph(graph);
    const levels = computeLevels(flat);
    expect(levels.get('source' as NodeId)).toBe(0);
    expect(levels.get('p0' as NodeId)).toBe(1);
    expect(levels.get('p1' as NodeId)).toBe(1);
    expect(levels.get('p2' as NodeId)).toBe(1);
    expect(levels.get('sink' as NodeId)).toBe(2);
  });
});

describe('nodeCount / edgeCount', () => {
  it('counts nodes in a simple graph', () => {
    const graph = makeLinearGraph(10);
    expect(nodeCount(graph)).toBe(10);
  });

  it('counts edges in a diamond graph', () => {
    const graph = makeDiamondGraph(5);
    expect(nodeCount(graph)).toBe(7);
    expect(edgeCount(graph)).toBe(10);
  });
});
