import type { EventDefinition } from '@gamedev-agent/events';
import type {
  StepResult,
  WorkflowExecutionId,
  WorkflowStepId,
} from '@gamedev-agent/workflow';
import type { AssemblyMetrics } from '@gamedev-agent/context';
import type { TokenUsage, ToolCall } from '@gamedev-agent/model-providers';

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

// ─── Payloads ──────────────────────────────────────────────────────────────

export interface ExecutionStepStartedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly stepId: WorkflowStepId;
  readonly attempt: number;
  readonly modelId: string;
  readonly contextMetrics: AssemblyMetrics;
  readonly timestamp: number;
}

export interface ExecutionStepProgressPayload {
  readonly executionId: WorkflowExecutionId;
  readonly stepId: WorkflowStepId;
  readonly content: string;
  readonly round: number;
  readonly timestamp: number;
}

export interface ExecutionToolInvokedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly stepId: WorkflowStepId;
  readonly toolId: string;
  readonly action: string;
  readonly round: number;
  readonly timestamp: number;
}

export interface ExecutionToolResultPayload {
  readonly executionId: WorkflowExecutionId;
  readonly stepId: WorkflowStepId;
  readonly toolId: string;
  readonly action: string;
  readonly ok: boolean;
  readonly round: number;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface ExecutionStepCompletedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly stepId: WorkflowStepId;
  readonly attempt: number;
  readonly result: StepResult;
  readonly usage: TokenUsage;
  readonly toolCalls: readonly ToolCall[];
  readonly rounds: number;
  readonly totalLatencyMs: number;
  readonly timestamp: number;
}

export interface ExecutionStepFailedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly stepId: WorkflowStepId;
  readonly attempt: number;
  readonly error: string;
  readonly code: string;
  readonly usage: TokenUsage;
  readonly rounds: number;
  readonly totalLatencyMs: number;
  readonly timestamp: number;
}

// ─── Event Definitions ─────────────────────────────────────────────────────

export const ExecutionStepStarted = define<ExecutionStepStartedPayload>('execution.step-started');
export const ExecutionStepProgress = define<ExecutionStepProgressPayload>('execution.step-progress');
export const ExecutionToolInvoked = define<ExecutionToolInvokedPayload>('execution.tool-invoked');
export const ExecutionToolResult = define<ExecutionToolResultPayload>('execution.tool-result');
export const ExecutionStepCompleted = define<ExecutionStepCompletedPayload>('execution.step-completed');
export const ExecutionStepFailed = define<ExecutionStepFailedPayload>('execution.step-failed');

export type ExecutionEventPayloads =
  | ExecutionStepStartedPayload
  | ExecutionStepProgressPayload
  | ExecutionToolInvokedPayload
  | ExecutionToolResultPayload
  | ExecutionStepCompletedPayload
  | ExecutionStepFailedPayload;
