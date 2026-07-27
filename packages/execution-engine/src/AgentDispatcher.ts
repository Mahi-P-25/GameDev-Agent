import type { AgentRuntime } from '@gamedev-agent/agent-runtime';
import type { Logger } from '@gamedev-agent/logging';
import type {
  Capability,
  ModelProvidersService,
  ModelRequest,
  ToolDefinition,
} from '@gamedev-agent/model-providers';
import type { Message } from '@gamedev-agent/model-providers';
import { AgentDispatchError } from './errors';
import type { AgentDispatchResult, DispatchContext } from './types';

export class AgentDispatcher {
  constructor(
    private readonly agentRuntime: AgentRuntime,
    private readonly modelProviders: ModelProvidersService,
    private readonly logger?: Logger,
  ) {}

  async dispatch(
    messages: readonly Message[],
    tools?: readonly ToolDefinition[],
    capabilities?: readonly Capability[],
    signal?: AbortSignal,
    metadata?: Record<string, unknown>,
  ): Promise<AgentDispatchResult> {
    if (signal?.aborted === true) {
      throw new AgentDispatchError('Dispatch cancelled before request');
    }

    const modelRequest: ModelRequest = {
      messages,
      tools,
      signal,
      metadata,
    };

    this.logger?.debug('Dispatching to model', {
      messageCount: messages.length,
      toolCount: tools?.length ?? 0,
      capabilities,
    });

    try {
      const response = await this.modelProviders.generate(modelRequest);

      this.logger?.debug('Model response received', {
        finishReason: response.finishReason,
        usage: response.usage,
        latencyMs: response.latencyMs,
      });

      return {
        response,
        toolCalls: response.toolCalls,
      };
    } catch (error) {
      if (error instanceof AgentDispatchError) throw error;
      throw new AgentDispatchError(
        `Model dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
