import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'task-graph' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface TaskNode {
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly priority: string;
}

export interface TaskGraphData {
  readonly id: string;
  readonly nodes: readonly TaskNode[];
  readonly stages: readonly { readonly id: string; readonly nodeIds: readonly string[] }[];
  readonly criticalPath: readonly string[];
}

export class TaskGraphProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.7,
    latency: 'fast',
    estimatedTokens: 1_500,
    freshness: 'session',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides the Task Graph — nodes, execution plan, critical path.',
  };

  private readonly fetchTaskGraph: () => Promise<TaskGraphData | undefined>;

  constructor(fetchTaskGraph: () => Promise<TaskGraphData | undefined>) {
    this.fetchTaskGraph = fetchTaskGraph;
  }

  async collect(_context: AssemblyContext): Promise<readonly ContextItem[]> {
    const graph = await this.fetchTaskGraph();
    if (graph === undefined) {
      return [];
    }

    const now = asTimestamp(Date.now());
    const items: ContextItem[] = [];

    items.push({
      id: asContextItemId(`taskgraph-${graph.id}`),
      content: `Task Graph: ${graph.nodes.length} nodes, ${graph.criticalPath.length} critical path steps`,
      tokens: 25,
      priority: 0.7,
      relevance: 0,
      attribution: { source: SOURCE_NAME, origin: `taskgraph:${graph.id}`, timestamp: now },
      compressed: false,
      metadata: {
        graphId: graph.id,
        nodeCount: graph.nodes.length,
        stageCount: graph.stages.length,
      },
    });

    for (const node of graph.nodes.slice(0, 20)) {
      items.push({
        id: asContextItemId(`taskgraph-node-${node.id}`),
        content: `[${node.status}] ${node.label} (${node.priority})`,
        tokens: 10,
        priority: node.priority === 'critical' ? 0.9 : node.priority === 'high' ? 0.7 : 0.5,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: `task:${node.id}`, timestamp: now },
        dedupKey: `task:${node.id}`,
        compressed: false,
        metadata: {
          nodeId: node.id,
          status: node.status,
          priority: node.priority,
        },
      });
    }

    return items;
  }
}
