import type { Brand, Json, Timestamp } from '@gamedev-agent/shared';

export type NodeId = Brand<string, 'NodeId'>;
export type GraphId = Brand<string, 'GraphId'>;

export type NodeStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export type Priority = 'low' | 'normal' | 'high' | 'critical';

export const PRIORITY_VALUES: Record<Priority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

export const NODE_STATUSES: ReadonlyArray<NodeStatus> = [
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'cancelled',
  'skipped',
];

export const NODE_TERMINAL_STATUSES: ReadonlyArray<NodeStatus> = [
  'completed',
  'failed',
  'cancelled',
  'skipped',
];

export interface TaskNodeConfig {
  readonly label: string;
  readonly priority?: Priority;
  readonly metadata?: Readonly<Record<string, Json>>;
  readonly maxRetries?: number;
}

export interface TaskNode {
  readonly id: NodeId;
  readonly label: string;
  readonly priority: Priority;
  readonly status: NodeStatus;
  readonly metadata: Readonly<Record<string, Json>>;
  readonly progress: number;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface TaskEdgeConfig {
  readonly metadata?: Readonly<Record<string, Json>>;
}

export interface TaskEdge {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly metadata: Readonly<Record<string, Json>>;
}

export interface TaskGraphConfig {
  readonly id?: string;
  readonly metadata?: Readonly<Record<string, Json>>;
}

export interface TaskGraph {
  readonly id: GraphId;
  readonly nodes: ReadonlyMap<NodeId, TaskNode>;
  readonly edges: ReadonlyArray<TaskEdge>;
  readonly subgraphs: ReadonlyArray<TaskGraph>;
  readonly metadata: Readonly<Record<string, Json>>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface TaskStage {
  readonly id: number;
  readonly nodeIds: ReadonlyArray<NodeId>;
  readonly dependsOn: ReadonlyArray<number>;
}

export interface TaskExecutionPlan {
  readonly graphId: GraphId;
  readonly stages: ReadonlyArray<TaskStage>;
  readonly criticalPath: ReadonlyArray<NodeId>;
  readonly topologicalOrder: ReadonlyArray<NodeId>;
  readonly estimatedTotalProgress: number;
  readonly createdAt: Timestamp;
}

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: NodeId;
  readonly edge?: { readonly from: NodeId; readonly to: NodeId };
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: NodeId;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
  readonly warnings: ReadonlyArray<ValidationWarning>;
}

export interface FlattenedGraph {
  readonly nodes: Map<NodeId, TaskNode>;
  readonly edges: TaskEdge[];
}
