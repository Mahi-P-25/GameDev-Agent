import type { EventBusContract } from '@gamedev-agent/events';
import type { AssemblyMetrics } from '@gamedev-agent/context';
import type { TokenUsage, ToolCall } from '@gamedev-agent/model-providers';
import type { StepResult, WorkflowExecutionId, WorkflowStepId } from '@gamedev-agent/workflow';
import {
  ExecutionStepCompleted,
  ExecutionStepFailed,
  ExecutionStepProgress,
  ExecutionStepStarted,
} from './events';

export class ProgressTracker {
  constructor(
    private readonly eventBus: EventBusContract,
    private readonly executionId: WorkflowExecutionId,
    private readonly stepId: WorkflowStepId,
  ) {}

  async stepStarted(attempt: number, modelId: string, contextMetrics: AssemblyMetrics): Promise<void> {
    await this.eventBus.publish(ExecutionStepStarted, {
      executionId: this.executionId,
      stepId: this.stepId,
      attempt,
      modelId,
      contextMetrics,
      timestamp: Date.now(),
    });
  }

  async stepProgress(content: string, round: number): Promise<void> {
    await this.eventBus.publish(ExecutionStepProgress, {
      executionId: this.executionId,
      stepId: this.stepId,
      content,
      round,
      timestamp: Date.now(),
    });
  }

  async stepCompleted(
    attempt: number,
    result: StepResult,
    usage: TokenUsage,
    toolCalls: readonly ToolCall[],
    rounds: number,
    totalLatencyMs: number,
  ): Promise<void> {
    await this.eventBus.publish(ExecutionStepCompleted, {
      executionId: this.executionId,
      stepId: this.stepId,
      attempt,
      result,
      usage,
      toolCalls,
      rounds,
      totalLatencyMs,
      timestamp: Date.now(),
    });
  }

  async stepFailed(
    attempt: number,
    error: string,
    code: string,
    usage: TokenUsage,
    rounds: number,
    totalLatencyMs: number,
  ): Promise<void> {
    await this.eventBus.publish(ExecutionStepFailed, {
      executionId: this.executionId,
      stepId: this.stepId,
      attempt,
      error,
      code,
      usage,
      rounds,
      totalLatencyMs,
      timestamp: Date.now(),
    });
  }
}
