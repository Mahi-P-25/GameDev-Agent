import type { Json, Timestamp } from '@gamedev-agent/shared';
import { DuplicateNodeError, InvalidGraphError } from './errors';
import type {
  GraphId,
  NodeId,
  Priority,
  TaskEdge,
  TaskEdgeConfig,
  TaskGraph,
  TaskGraphConfig,
  TaskNode,
  TaskNodeConfig,
} from './types';

interface NodeState {
  id: NodeId;
  label: string;
  priority: Priority;
  status: 'pending';
  metadata: Record<string, Json>;
  progress: number;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
}

export class TaskGraphBuilder {
  private readonly nodes = new Map<NodeId, NodeState>();
  private readonly edges: Array<{
    from: NodeId;
    to: NodeId;
    metadata: Record<string, Json>;
  }> = [];
  private readonly subgraphBuilders: TaskGraphBuilder[] = [];
  private readonly id: string;
  private readonly metadata: Record<string, Json>;
  private built = false;

  constructor(config?: TaskGraphConfig) {
    this.id = config?.id ?? crypto.randomUUID();
    this.metadata = config?.metadata !== undefined ? { ...config.metadata } : {};
  }

  addNode(id: string, config: TaskNodeConfig): this {
    this.assertNotBuilt();
    const nodeId = id as NodeId;
    if (this.nodes.has(nodeId)) {
      throw new DuplicateNodeError(id);
    }
    const now = Date.now();
    this.nodes.set(nodeId, {
      id: nodeId,
      label: config.label,
      priority: config.priority ?? 'normal',
      status: 'pending',
      metadata: config.metadata !== undefined ? { ...config.metadata } : {},
      progress: 0,
      retryCount: 0,
      maxRetries: config.maxRetries ?? 0,
      createdAt: now as Timestamp,
      updatedAt: now as Timestamp,
    });
    return this;
  }

  addEdge(from: string, to: string, config?: TaskEdgeConfig): this {
    this.assertNotBuilt();
    this.edges.push({
      from: from as NodeId,
      to: to as NodeId,
      metadata: config?.metadata !== undefined ? { ...config.metadata } : {},
    });
    return this;
  }

  removeNode(id: string): this {
    this.assertNotBuilt();
    const nodeId = id as NodeId;
    this.nodes.delete(nodeId);
    const filteredEdges = this.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    this.edges.length = 0;
    this.edges.push(...filteredEdges);
    return this;
  }

  removeEdge(from: string, to: string): this {
    this.assertNotBuilt();
    const fromId = from as NodeId;
    const toId = to as NodeId;
    const index = this.edges.findIndex((e) => e.from === fromId && e.to === toId);
    if (index !== -1) {
      this.edges.splice(index, 1);
    }
    return this;
  }

  addSubgraph(builder: TaskGraphBuilder): this {
    this.assertNotBuilt();
    this.subgraphBuilders.push(builder);
    return this;
  }

  build(): TaskGraph {
    this.assertNotBuilt();
    this.built = true;
    const now = Date.now() as Timestamp;

    const nodeMap = new Map<NodeId, TaskNode>();
    for (const [id, state] of this.nodes) {
      nodeMap.set(id, {
        id: state.id,
        label: state.label,
        priority: state.priority,
        status: state.status,
        metadata: { ...state.metadata },
        progress: state.progress,
        retryCount: state.retryCount,
        maxRetries: state.maxRetries,
        createdAt: state.createdAt as Timestamp,
        updatedAt: state.updatedAt as Timestamp,
      });
    }

    const taskEdges: TaskEdge[] = this.edges.map((e) => ({
      from: e.from,
      to: e.to,
      metadata: { ...e.metadata },
    }));

    const subgraphs = this.subgraphBuilders.map((sb) => sb.build());

    const allNodes = this.collectNodesWithSubgraphs(nodeMap, subgraphs);
    this.validateEdgeTargets(allNodes, taskEdges);

    return {
      id: this.id as GraphId,
      nodes: nodeMap,
      edges: taskEdges,
      subgraphs,
      metadata: { ...this.metadata },
      createdAt: now,
      updatedAt: now,
    };
  }

  private collectNodesWithSubgraphs(
    ownNodes: Map<NodeId, TaskNode>,
    subgraphs: TaskGraph[],
  ): Map<NodeId, TaskNode> {
    const combined = new Map(ownNodes);
    for (const sub of subgraphs) {
      for (const [id, node] of sub.nodes) {
        if (!combined.has(id)) {
          combined.set(id, node);
        }
      }
    }
    return combined;
  }

  private validateEdgeTargets(nodes: Map<NodeId, TaskNode>, edges: TaskEdge[]): void {
    for (const edge of edges) {
      if (!nodes.has(edge.from)) {
        throw new InvalidGraphError(`Edge source "${edge.from}" does not exist`);
      }
      if (!nodes.has(edge.to)) {
        throw new InvalidGraphError(`Edge target "${edge.to}" does not exist`);
      }
    }
  }

  private assertNotBuilt(): void {
    if (this.built) {
      throw new InvalidGraphError('Graph builder has already been used to build a graph');
    }
  }
}
