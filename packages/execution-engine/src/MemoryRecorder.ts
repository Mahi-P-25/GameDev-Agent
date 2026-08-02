import type { Logger } from '@gamedev-agent/logging';
import type { MemoryManager } from '@gamedev-agent/memory';
import type { MemoryEntryInput } from '@gamedev-agent/memory';
import { MemoryRecordingError } from './errors';
import type { ExecutionMemoryInput } from './types';

export class MemoryRecorder {
  constructor(
    private readonly memoryManager: MemoryManager,
    private readonly logger?: Logger,
  ) {}

  async record(input: ExecutionMemoryInput): Promise<void> {
    try {
      const { step, context, result } = input;

      const entry: MemoryEntryInput = {
        namespace: `project/${context.projectId}`,
        tier: 'project',
        category: 'execution',
        summary: `Step "${step.title}" — ${result.ok ? 'succeeded' : 'failed'}`,
        content: this.buildContent(step, context, result),
        provenance: {
          source: 'execution-engine',
          timestamp: Date.now() as never,
          actor: 'execution-engine',
          ...(context.missionId !== null ? { missionId: context.missionId } : {}),
        },
        metadata: {
          stepId: step.id,
          executionId: context.executionId,
          workflowId: context.workflowId,
          projectId: context.projectId,
          attempt: context.attempt,
          ok: result.ok,
          totalTokens: result.usage.totalTokens,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalLatencyMs: result.totalLatencyMs,
          rounds: result.rounds,
          toolCallCount: result.toolCalls.length,
          error: result.error,
        },
      } as MemoryEntryInput;

      await this.memoryManager.storeEntry(entry);

      this.logger?.debug('Execution recorded to memory', {
        stepId: step.id,
        ok: result.ok,
        tokens: result.usage.totalTokens,
      });
    } catch (error) {
      throw new MemoryRecordingError(
        `Failed to record step execution: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  private buildContent(
    step: import('@gamedev-agent/workflow').WorkflowStep,
    context: import('@gamedev-agent/workflow').WorkflowStepContext,
    result: import('./types').ExecutionStepResult,
  ): string {
    const lines: string[] = [
      `# Step Execution: ${step.title}`,
      '',
      `**Status**: ${result.ok ? 'Success' : 'Failed'}`,
      `**Attempt**: ${context.attempt}`,
      `**Duration**: ${result.totalLatencyMs}ms`,
      `**Rounds**: ${result.rounds}`,
      `**Tool Calls**: ${result.toolCalls.length}`,
      '',
      `**Description**: ${step.description}`,
      '',
      '## Token Usage',
      `- Prompt: ${result.usage.promptTokens}`,
      `- Completion: ${result.usage.completionTokens}`,
      `- Total: ${result.usage.totalTokens}`,
    ];

    if (result.error !== undefined) {
      lines.push('', '## Error', result.error);
    }

    if (result.toolCalls.length > 0) {
      lines.push('', '## Tool Calls');
      for (const tc of result.toolCalls) {
        lines.push(`- ${tc.function.name}(${tc.function.arguments})`);
      }
    }

    return lines.join('\n');
  }
}
