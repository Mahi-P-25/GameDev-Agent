import { describe, expect, it } from 'vitest';
import { TaskGraphBuilder } from './builder';
import { DuplicateNodeError, InvalidGraphError } from './errors';

describe('TaskGraphBuilder', () => {
  it('builds an empty graph', () => {
    const graph = new TaskGraphBuilder({ id: 'empty' }).build();
    expect(graph.id).toBe('empty');
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.subgraphs).toHaveLength(0);
    expect(graph.metadata).toEqual({});
  });

  it('builds a graph with nodes', () => {
    const graph = new TaskGraphBuilder({ id: 'test' })
      .addNode('a', { label: 'Node A', priority: 'high' })
      .addNode('b', { label: 'Node B' })
      .build();
    expect(graph.nodes.size).toBe(2);
    const nodeA = graph.nodes.get('a' as never);
    expect(nodeA).toBeDefined();
    expect(nodeA?.label).toBe('Node A');
    expect(nodeA?.priority).toBe('high');
    expect(nodeA?.status).toBe('pending');
    expect(nodeA?.maxRetries).toBe(0);
  });

  it('builds a graph with edges', () => {
    const graph = new TaskGraphBuilder()
      .addNode('a', { label: 'A' })
      .addNode('b', { label: 'B' })
      .addEdge('a', 'b')
      .build();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.from).toBe('a');
    expect(graph.edges[0]?.to).toBe('b');
  });

  it('rejects duplicate node ids', () => {
    expect(() =>
      new TaskGraphBuilder().addNode('x', { label: 'First' }).addNode('x', { label: 'Second' }),
    ).toThrow(DuplicateNodeError);
  });

  it('rejects edges to non-existent nodes at build time', () => {
    expect(() =>
      new TaskGraphBuilder().addNode('a', { label: 'A' }).addEdge('a', 'missing').build(),
    ).toThrow(InvalidGraphError);
  });

  it('rejects edges from non-existent nodes at build time', () => {
    expect(() =>
      new TaskGraphBuilder().addNode('b', { label: 'B' }).addEdge('missing', 'b').build(),
    ).toThrow(InvalidGraphError);
  });

  it('removes a node and its edges', () => {
    const graph = new TaskGraphBuilder()
      .addNode('a', { label: 'A' })
      .addNode('b', { label: 'B' })
      .addNode('c', { label: 'C' })
      .addEdge('a', 'b')
      .addEdge('b', 'c')
      .removeNode('b')
      .build();
    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.has('b' as never)).toBe(false);
    expect(graph.edges).toHaveLength(0);
  });

  it('removes an edge', () => {
    const graph = new TaskGraphBuilder()
      .addNode('a', { label: 'A' })
      .addNode('b', { label: 'B' })
      .addEdge('a', 'b')
      .removeEdge('a', 'b')
      .build();
    expect(graph.edges).toHaveLength(0);
  });

  it('prevents double-build', () => {
    const builder = new TaskGraphBuilder();
    builder.addNode('a', { label: 'A' });
    builder.build();
    expect(() => builder.addNode('b', { label: 'B' })).toThrow(InvalidGraphError);
    expect(() => builder.build()).toThrow(InvalidGraphError);
  });

  it('builds a graph with subgraphs', () => {
    const subBuilder = new TaskGraphBuilder({ id: 'sub' })
      .addNode('s1', { label: 'Sub 1' })
      .addNode('s2', { label: 'Sub 2' })
      .addEdge('s1', 's2');
    const graph = new TaskGraphBuilder({ id: 'parent' })
      .addNode('main', { label: 'Main' })
      .addSubgraph(subBuilder)
      .build();
    expect(graph.subgraphs).toHaveLength(1);
    expect(graph.subgraphs[0]?.nodes.size).toBe(2);
    expect(graph.subgraphs[0]?.edges).toHaveLength(1);
  });

  it('sets metadata on nodes and edges', () => {
    const graph = new TaskGraphBuilder()
      .addNode('a', {
        label: 'A',
        metadata: { key: 'value', number: 42 },
        maxRetries: 3,
      })
      .addEdge('a', 'a', { metadata: { type: 'self' } })
      .build();
    const node = graph.nodes.get('a' as never);
    expect(node?.metadata).toEqual({ key: 'value', number: 42 });
    expect(node?.maxRetries).toBe(3);
  });
});
