import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { ToolInvocationResult, ToolManager } from '@gamedev-agent/tool-runtime';
import type { ToolCall } from '@gamedev-agent/model-providers';
import { asToolId } from '@gamedev-agent/tool-runtime';
import {
  ExecutionToolInvoked,
  ExecutionToolResult,
} from './events';
import type { ToolInvocation } from './types';

export class ToolBridge {
  constructor(
    private readonly toolManager: ToolManager,
    private readonly eventBus: EventBusContract,
    private readonly executionId: string,
    private readonly stepId: string,
    private readonly round: number,
    private readonly logger?: Logger,
  ) {}

  async invokeAll(toolCalls: readonly ToolCall[]): Promise<readonly ToolInvocation[]> {
    const results: ToolInvocation[] = [];

    for (const toolCall of toolCalls) {
      const invocation = await this.invokeSingle(toolCall);
      results.push(invocation);
    }

    return results;
  }

  private async invokeSingle(toolCall: ToolCall): Promise<ToolInvocation> {
    const { name, arguments: argsStr } = toolCall.function;
    const startTime = Date.now();

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(argsStr) as Record<string, unknown>;
    } catch {
      // If arguments can't be parsed, pass them as-is
    }

    await this.eventBus.publish(ExecutionToolInvoked, {
      executionId: this.executionId as any,
      stepId: this.stepId as any,
      toolId: name,
      action: name,
      round: this.round,
      timestamp: Date.now(),
    });

    this.logger?.debug('Tool invoked', { toolId: name, action: name, round: this.round });

    let result: ToolInvocationResult;
    try {
      result = await this.toolManager.invoke({
        toolId: asToolId(name),
        action: name,
        input: parsedArgs as any,
        actor: { kind: 'execution-engine', id: this.executionId },
        correlationId: null,
      });
    } catch (error) {
      result = {
        ok: false,
        toolId: asToolId(name),
        action: name,
        durationMs: Date.now() - startTime,
        output: null,
        error: {
          code: 'INVOCATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    const durationMs = Date.now() - startTime;

    await this.eventBus.publish(ExecutionToolResult, {
      executionId: this.executionId as any,
      stepId: this.stepId as any,
      toolId: name,
      action: name,
      ok: result.ok,
      round: this.round,
      durationMs,
      timestamp: Date.now(),
    });

    this.logger?.debug('Tool result', {
      toolId: name,
      ok: result.ok,
      durationMs,
    });

    return {
      toolCall,
      result: JSON.stringify(result.output ?? result.error ?? {}),
      ok: result.ok,
      durationMs,
    };
  }
}
