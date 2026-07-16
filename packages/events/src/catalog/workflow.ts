import type { EventDefinition } from '../types';

export interface WorkflowStartedPayload {
  readonly workflowId: string;
  readonly missionId?: string;
  readonly namespace: string;
}

export interface WorkflowCompletedPayload {
  readonly workflowId: string;
  readonly missionId?: string;
  readonly namespace: string;
  readonly success: boolean;
}

export const WorkflowStarted = define<WorkflowStartedPayload>('workflow.started');
export const WorkflowCompleted = define<WorkflowCompletedPayload>('workflow.completed');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
