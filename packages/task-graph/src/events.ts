import type { EventDefinition } from '@gamedev-agent/events';
import type { GraphId } from './types';

export interface GraphCreatedPayload {
  readonly graphId: GraphId;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly subgraphCount: number;
  readonly timestamp: number;
}

export interface GraphValidatedPayload {
  readonly graphId: GraphId;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly timestamp: number;
}

export interface GraphInvalidPayload {
  readonly graphId: GraphId;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly errors: ReadonlyArray<string>;
  readonly timestamp: number;
}

export interface PlanGeneratedPayload {
  readonly graphId: GraphId;
  readonly stageCount: number;
  readonly criticalPathLength: number;
  readonly nodeCount: number;
  readonly timestamp: number;
}

export const GraphCreated = define<GraphCreatedPayload>('task-graph.created');
export const GraphValidated = define<GraphValidatedPayload>('task-graph.validated');
export const GraphInvalid = define<GraphInvalidPayload>('task-graph.invalid');
export const PlanGenerated = define<PlanGeneratedPayload>('task-graph.plan-generated');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

export type TaskGraphEventPayloads =
  | GraphCreatedPayload
  | GraphValidatedPayload
  | GraphInvalidPayload
  | PlanGeneratedPayload;
