import type { Logger } from '@gamedev-agent/logging';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import type {
  StepExecutor,
  StepResult,
  WorkflowStep,
  WorkflowStepContext,
} from '@gamedev-agent/workflow';
import type { Message } from '@gamedev-agent/model-providers';
import type { ToolDefinition } from '@gamedev-agent/model-providers';
import type { EventBusContract } from '@gamedev-agent/events';
import type { ContextAssembler } from './ContextAssembler';
import type { AgentDispatcher } from './AgentDispatcher';
import type { MemoryRecorder } from './MemoryRecorder';
import { StepCancelledError, StepTimeoutError } from './errors';
import { ProgressTracker } from './ProgressTracker';
import { ToolBridge } from './ToolBridge';
import type { ExecutionStepResult } from './types';

export interface ExecutionEngineOptions {
  readonly contextAssembler: ContextAssembler;
  readonly agentDispatcher: AgentDispatcher;
  readonly toolManager: ToolManager;
  readonly memoryRecorder: MemoryRecorder;
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly defaultTimeoutMs?: number;
  readonly maxToolRounds?: number;
}

export class ExecutionEngine implements StepExecutor {
  private readonly contextAssembler: ContextAssembler;
  private readonly agentDispatcher: AgentDispatcher;
  private readonly toolManager: ToolManager;
  private readonly memoryRecorder: MemoryRecorder;
  private readonly eventBus: EventBusContract;
  private readonly logger: Logger | undefined;
  private readonly defaultTimeoutMs: number;
  private readonly maxToolRounds: number;

  constructor(options: ExecutionEngineOptions) {
    this.contextAssembler = options.contextAssembler;
    this.agentDispatcher = options.agentDispatcher;
    this.toolManager = options.toolManager;
    this.memoryRecorder = options.memoryRecorder;
    this.eventBus = options.eventBus;
    this.logger = options.logger;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;
    this.maxToolRounds = options.maxToolRounds ?? 10;
  }

  async execute(step: WorkflowStep, context: WorkflowStepContext): Promise<StepResult> {
    const stepStartTime = Date.now();
    const tracker = new ProgressTracker(this.eventBus, context.executionId, step.id);
    const timeoutMs = this.getTimeoutMs(step);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new StepTimeoutError(`Step "${step.id}" timed out after ${timeoutMs}ms`, timeoutMs, step.id)),
        timeoutMs,
      );
    });

    try {
      this.logger?.info('Executing step', {
        stepId: step.id,
        workflowId: context.workflowId,
        attempt: context.attempt,
      });

      const result = await Promise.race([
        this.executeStep(step, context, stepStartTime, tracker),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      const totalLatencyMs = Date.now() - stepStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof StepCancelledError ? 'STEP_CANCELLED'
        : error instanceof StepTimeoutError ? 'STEP_TIMEOUT'
        : 'EXECUTION_ERROR';

      this.logger?.error('Step failed', {
        stepId: step.id,
        error: errorMessage,
        code: errorCode,
        totalLatencyMs,
      });

      const stepResult: StepResult = {
        ok: false,
        error: errorMessage,
      };

      try {
        await tracker.stepFailed(
          context.attempt,
          errorMessage,
          errorCode,
          { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          0,
          totalLatencyMs,
        );
      } catch {
        // Event emission failures should not mask the original error
      }

      return stepResult;
    }
  }

  private async executeStep(
    step: WorkflowStep,
    context: WorkflowStepContext,
    stepStartTime: number,
    tracker: ProgressTracker,
  ): Promise<StepResult> {
    this.logger?.info('Executing step', {
      stepId: step.id,
      workflowId: context.workflowId,
      attempt: context.attempt,
    });

    // 1. Assemble context
    const assembled = await this.contextAssembler.assemble(step, context);

    await tracker.stepStarted(context.attempt, assembled.modelId, assembled.contextPackage.metrics);

    // 2. Tool-call loop
    let messages = [...assembled.messages];
    const loaded = await this.loadTools(step);
    const stepTools = loaded?.tools;
    const actionRegistry = loaded?.registry ?? new Map();
    let round = 0;
    let finalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const allToolCalls: import('@gamedev-agent/model-providers').ToolCall[] = [];

    while (round < this.maxToolRounds) {
      round += 1;

      // Dispatch to model
      const dispatchResult = await this.agentDispatcher.dispatch(
        messages,
        stepTools,
        assembled.requiredCapabilities,
        undefined,
        { stepId: step.id, executionId: context.executionId, round },
      );

      finalUsage = dispatchResult.response.usage;

      // Track progress
      if (dispatchResult.response.content) {
        await tracker.stepProgress(dispatchResult.response.content, round);
      }

      // Handle tool calls
      if (dispatchResult.response.toolCalls.length > 0) {
        allToolCalls.push(...dispatchResult.response.toolCalls);

        const toolBridge = new ToolBridge(
          this.toolManager,
          this.eventBus,
          context.executionId as string,
          step.id as string,
          round,
          actionRegistry,
          this.logger,
        );

        const toolResults = await toolBridge.invokeAll(dispatchResult.response.toolCalls);

        // Append assistant response and tool results to messages
        const assistantMessage: Message = {
          role: 'assistant',
          content: dispatchResult.response.content,
          toolCallId: undefined,
        };
        messages = [...messages, assistantMessage];

        for (const tr of toolResults) {
          const toolMessage: Message = {
            role: 'tool',
            content: tr.result,
            toolCallId: tr.toolCall.id,
          };
          messages = [...messages, toolMessage];
        }
      } else {
        // No tool calls — execution complete
        break;
      }
    }

    const totalLatencyMs = Date.now() - stepStartTime;
    const execResult: ExecutionStepResult = {
      ok: true,
      usage: finalUsage,
      toolCalls: allToolCalls,
      rounds: round,
      totalLatencyMs,
    };

    // 3. Record to memory
    await this.memoryRecorder.record({ step, context, result: execResult, startTime: stepStartTime });

    const stepResult: StepResult = { ok: true };

    await tracker.stepCompleted(context.attempt, stepResult, finalUsage, allToolCalls, round, totalLatencyMs);

    this.logger?.info('Step completed', {
      stepId: step.id,
      rounds: round,
      toolCalls: allToolCalls.length,
      totalLatencyMs,
    });

    return stepResult;
  }

  private async loadTools(step: WorkflowStep): Promise<{ tools: ToolDefinition[]; registry: Map<string, { toolId: string; action: string }> } | undefined> {
    if (step.requiredCapability === undefined) {
      return undefined;
    }

    try {
      const registeredTools = this.toolManager.list();
      if (registeredTools.length === 0) return undefined;

      const registry = new Map<string, { toolId: string; action: string }>();
      const tools: ToolDefinition[] = [];

      for (const tool of registeredTools) {
        for (const cap of tool.descriptor.capabilities) {
          for (const action of cap.actions) {
            registry.set(action, { toolId: tool.descriptor.id, action });
            tools.push({
              name: action,
              description: `${cap.name}: ${action}`,
              inputSchema: this.buildActionSchema(action),
            });
          }
        }
      }

      return { tools, registry };
    } catch {
      return undefined;
    }
  }

  private buildActionSchema(action: string): Record<string, unknown> {
    switch (action) {
      case 'files.create':
        return {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to create' },
            kind: { type: 'string', description: 'Kind: "file" or "directory"' },
            content: { type: 'string', description: 'Initial content for file' },
          },
          required: ['path'],
          additionalProperties: false,
        };
      case 'files.write':
        return {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'File content' },
            force: { type: 'boolean', description: 'Overwrite if exists' },
          },
          required: ['path', 'content'],
          additionalProperties: false,
        };
      case 'files.read':
        return {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' },
          },
          required: ['path'],
          additionalProperties: false,
        };
      case 'files.list':
        return {
          type: 'object',
          properties: {
            dirPath: { type: 'string', description: 'Directory path (defaults to workspace root)' },
          },
          additionalProperties: false,
        };
      case 'files.delete':
        return {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to delete' },
            recursive: { type: 'boolean', description: 'Delete recursively' },
          },
          required: ['path'],
          additionalProperties: false,
        };
      case 'files.rename':
        return {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source path' },
            to: { type: 'string', description: 'Destination path' },
          },
          required: ['from', 'to'],
          additionalProperties: false,
        };
      case 'terminal.run':
        return {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
            cwd: { type: 'string', description: 'Working directory' },
            timeoutMs: { type: 'number', description: 'Timeout in milliseconds' },
          },
          required: ['command'],
          additionalProperties: false,
        };
      case 'terminal.start':
        return {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to start' },
            args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
            cwd: { type: 'string', description: 'Working directory' },
          },
          required: ['command'],
          additionalProperties: false,
        };
      case 'terminal.stop':
        return {
          type: 'object',
          properties: {
            processId: { type: 'string', description: 'Process ID to stop' },
            signal: { type: 'string', description: 'Signal to send (e.g. SIGTERM)' },
          },
          required: ['processId'],
          additionalProperties: false,
        };
      case 'terminal.output':
        return {
          type: 'object',
          properties: {
            processId: { type: 'string', description: 'Process ID' },
          },
          required: ['processId'],
          additionalProperties: false,
        };
      case 'git.init':
        return {
          type: 'object',
          properties: {},
          additionalProperties: false,
        };
      case 'git.status':
        return {
          type: 'object',
          properties: {},
          additionalProperties: false,
        };
      case 'git.commit':
        return {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Commit message' },
          },
          additionalProperties: false,
        };
      default:
        return {
          type: 'object',
          properties: {},
          additionalProperties: true,
        };
    }
  }

  private getTimeoutMs(step: WorkflowStep): number {
    if (step.metadata?.timeoutMs !== undefined) {
      return step.metadata.timeoutMs as number;
    }
    return this.defaultTimeoutMs;
  }

  private checkCancelled(signal: AbortSignal, stepId: string): void {
    if (signal.aborted) {
      const reason = signal.reason instanceof Error ? signal.reason.message : 'Execution cancelled';
      throw new StepCancelledError(stepId);
    }
  }
}
