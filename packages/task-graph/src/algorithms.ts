import { CycleDetectedError } from './errors';
import type { FlattenedGraph, NodeId, TaskEdge, TaskGraph, TaskNode } from './types';
import { PRIORITY_VALUES } from './types';

export function flattenGraph(graph: TaskGraph): FlattenedGraph {
  const nodes = new Map<NodeId, TaskNode>(graph.nodes);
  const edges: TaskEdge[] = [...graph.edges];

  for (const subgraph of graph.subgraphs) {
    const flat = flattenGraph(subgraph);
    for (const [id, node] of flat.nodes) {
      if (!nodes.has(id)) {
        nodes.set(id, node);
      }
    }
    edges.push(...flat.edges);
  }

  return { nodes, edges };
}

export function detectCycles(flat: FlattenedGraph): TaskEdge[] {
  const adjacency = buildAdjacency(flat.edges);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<NodeId, number>();

  for (const nodeId of flat.nodes.keys()) {
    color.set(nodeId, WHITE);
  }

  const backEdges: TaskEdge[] = [];

  function dfs(nodeId: NodeId): void {
    color.set(nodeId, GRAY);
    const neighbors = adjacency.get(nodeId);
    if (neighbors !== undefined) {
      for (const { to, edge } of neighbors) {
        const c = color.get(to);
        if (c === GRAY) {
          backEdges.push(edge);
        } else if (c === WHITE) {
          dfs(to);
        }
      }
    }
    color.set(nodeId, BLACK);
  }

  for (const nodeId of flat.nodes.keys()) {
    if (color.get(nodeId) === WHITE) {
      dfs(nodeId);
    }
  }

  return backEdges;
}

export function hasCycle(flat: FlattenedGraph): boolean {
  return detectCycles(flat).length > 0;
}

export function topologicalSort(flat: FlattenedGraph): NodeId[] {
  const inDegree = new Map<NodeId, number>();
  const adjacency = new Map<NodeId, NodeId[]>();

  for (const nodeId of flat.nodes.keys()) {
    inDegree.set(nodeId, 0);
    adjacency.set(nodeId, []);
  }

  for (const edge of flat.edges) {
    const list = adjacency.get(edge.from);
    if (list !== undefined) {
      list.push(edge.to);
    }
    const deg = inDegree.get(edge.to);
    if (deg !== undefined) {
      inDegree.set(edge.to, deg + 1);
    }
  }

  const queue: NodeId[] = [];
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) {
      queue.push(nodeId);
    }
  }

  const result: NodeId[] = [];
  let head = 0;
  while (head < queue.length) {
    const nodeId = queue[head] as NodeId;
    head++;
    result.push(nodeId);
    const neighbors = adjacency.get(nodeId);
    if (neighbors !== undefined) {
      for (const neighbor of neighbors) {
        const deg = inDegree.get(neighbor);
        if (deg !== undefined) {
          const newDeg = deg - 1;
          inDegree.set(neighbor, newDeg);
          if (newDeg === 0) {
            queue.push(neighbor);
          }
        }
      }
    }
  }

  if (result.length !== flat.nodes.size) {
    throw new CycleDetectedError();
  }

  return result;
}

export function criticalPath(flat: FlattenedGraph): NodeId[] {
  const order = topologicalSort(flat);

  const adjacency = buildAdjacency(flat.edges);

  const dist = new Map<NodeId, number>();
  const predecessor = new Map<NodeId, NodeId | null>();

  for (const nodeId of order) {
    dist.set(nodeId, 0);
    predecessor.set(nodeId, null);
  }

  for (const nodeId of order) {
    const currentDist = dist.get(nodeId) as number;
    const neighbors = adjacency.get(nodeId);
    if (neighbors !== undefined) {
      for (const { to } of neighbors) {
        const existingDist = dist.get(to) as number;
        const newDist = currentDist + 1;
        if (newDist > existingDist) {
          dist.set(to, newDist);
          predecessor.set(to, nodeId);
        }
      }
    }
  }

  let maxDist = -1;
  let maxNode: NodeId | null = null;
  for (const nodeId of order) {
    const d = dist.get(nodeId) as number;
    if (d > maxDist) {
      maxDist = d;
      maxNode = nodeId;
    }
  }

  const path: NodeId[] = [];
  let current = maxNode;
  while (current !== null) {
    path.push(current);
    current = predecessor.get(current) ?? null;
  }
  path.reverse();

  return path;
}

export function computeLevels(flat: FlattenedGraph): Map<NodeId, number> {
  const order = topologicalSort(flat);

  const levels = new Map<NodeId, number>();
  const reverseAdj = buildReverseAdjacency(flat.edges);

  for (const nodeId of order) {
    if (
      reverseAdj.size === 0 ||
      !reverseAdj.has(nodeId) ||
      (reverseAdj.get(nodeId)?.length ?? 0) === 0
    ) {
      levels.set(nodeId, 0);
    } else {
      const predecessors = reverseAdj.get(nodeId);
      let maxPredLevel = -1;
      if (predecessors !== undefined) {
        for (const pred of predecessors) {
          const predLevel = levels.get(pred);
          if (predLevel !== undefined && predLevel > maxPredLevel) {
            maxPredLevel = predLevel;
          }
        }
      }
      levels.set(nodeId, maxPredLevel + 1);
    }
  }

  return levels;
}

export function computePriorityOrder(flat: FlattenedGraph): NodeId[] {
  const order = topologicalSort(flat);
  const levels = computeLevels(flat);

  return order.sort((a, b) => {
    const levelA = levels.get(a) ?? 0;
    const levelB = levels.get(b) ?? 0;
    if (levelA !== levelB) {
      return levelA - levelB;
    }
    const nodeA = flat.nodes.get(a);
    const nodeB = flat.nodes.get(b);
    const priorityA = nodeA !== undefined ? PRIORITY_VALUES[nodeA.priority] : 0;
    const priorityB = nodeB !== undefined ? PRIORITY_VALUES[nodeB.priority] : 0;
    return priorityB - priorityA;
  });
}

export function nodeCount(graph: TaskGraph): number {
  let count = graph.nodes.size;
  for (const subgraph of graph.subgraphs) {
    count += nodeCount(subgraph);
  }
  return count;
}

export function edgeCount(graph: TaskGraph): number {
  let count = graph.edges.length;
  for (const subgraph of graph.subgraphs) {
    count += edgeCount(subgraph);
  }
  return count;
}

function buildAdjacency(edges: TaskEdge[]): Map<NodeId, Array<{ to: NodeId; edge: TaskEdge }>> {
  const adjacency = new Map<NodeId, Array<{ to: NodeId; edge: TaskEdge }>>();
  for (const edge of edges) {
    let list = adjacency.get(edge.from);
    if (list === undefined) {
      list = [];
      adjacency.set(edge.from, list);
    }
    list.push({ to: edge.to, edge });
  }
  return adjacency;
}

function buildReverseAdjacency(edges: TaskEdge[]): Map<NodeId, NodeId[]> {
  const reverseAdj = new Map<NodeId, NodeId[]>();
  for (const edge of edges) {
    let list = reverseAdj.get(edge.to);
    if (list === undefined) {
      list = [];
      reverseAdj.set(edge.to, list);
    }
    list.push(edge.from);
  }
  return reverseAdj;
}
