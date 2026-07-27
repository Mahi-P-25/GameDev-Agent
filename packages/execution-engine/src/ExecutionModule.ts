import { createServiceToken } from '@gamedev-agent/di';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import type { StepExecutor } from '@gamedev-agent/workflow';
import { WORKFLOW_EXECUTOR_TOKEN } from '@gamedev-agent/workflow';
import { CONTEXT_PIPELINE_TOKEN, CONTEXT_MANAGER_TOKEN } from '@gamedev-agent/context';
import { MODEL_PROVIDERS_SERVICE_TOKEN } from '@gamedev-agent/model-providers';
import { AGENT_RUNTIME_TOKEN } from '@gamedev-agent/agent-runtime';
import { MEMORY_MANAGER_TOKEN } from '@gamedev-agent/memory';
import { TOOL_RUNTIME_TOKEN } from '@gamedev-agent/tool-runtime';
import { AgentDispatcher } from './AgentDispatcher';
import { ContextAssembler } from './ContextAssembler';
import { ExecutionEngine } from './ExecutionEngine';
import { MemoryRecorder } from './MemoryRecorder';

export const EXECUTION_ENGINE_TOKEN = createServiceToken<StepExecutor>('nova.execution-engine');
export const CONTEXT_ASSEMBLER_TOKEN = createServiceToken<ContextAssembler>('nova.context-assembler');
export const AGENT_DISPATCHER_TOKEN = createServiceToken<AgentDispatcher>('nova.agent-dispatcher');
export const MEMORY_RECORDER_TOKEN = createServiceToken<MemoryRecorder>('nova.memory-recorder');

export const executionEngineModule: KernelModule = {
  name: 'nova.execution-engine',
  async register(kernel: StudioKernel): Promise<void> {
    const logger = kernel.logger.child('execution-engine');
    const eventBus = kernel.events;

    // Register ContextAssembler with lazy factory
    kernel.registerService({
      token: CONTEXT_ASSEMBLER_TOKEN,
      singleton: true,
      factory: async () => {
        const [contextPipeline, contextManager, modelProvidersService] = await Promise.all([
          kernel.services.resolve(CONTEXT_PIPELINE_TOKEN),
          kernel.services.resolve(CONTEXT_MANAGER_TOKEN),
          kernel.services.resolve(MODEL_PROVIDERS_SERVICE_TOKEN),
        ]);
        return new ContextAssembler(contextPipeline, contextManager, modelProvidersService, logger);
      },
    });

    // Register AgentDispatcher with lazy factory
    kernel.registerService({
      token: AGENT_DISPATCHER_TOKEN,
      singleton: true,
      factory: async () => {
        const [agentRuntime, modelProvidersService] = await Promise.all([
          kernel.services.resolve(AGENT_RUNTIME_TOKEN),
          kernel.services.resolve(MODEL_PROVIDERS_SERVICE_TOKEN),
        ]);
        return new AgentDispatcher(agentRuntime, modelProvidersService, logger);
      },
    });

    // Register MemoryRecorder with lazy factory
    kernel.registerService({
      token: MEMORY_RECORDER_TOKEN,
      singleton: true,
      factory: async () => {
        const memoryManager = await kernel.services.resolve(MEMORY_MANAGER_TOKEN);
        return new MemoryRecorder(memoryManager, logger);
      },
    });

    // Register ExecutionEngine with lazy factory.
    // Resolve sub-services sequentially (not Promise.all) so that shared
    // dependencies (e.g. MODEL_PROVIDERS_SERVICE_TOKEN) are cached before
    // the next factory tries to resolve them — otherwise the container's
    // in-flight "building" set throws a spurious CircularDependencyError.
    kernel.registerService({
      token: EXECUTION_ENGINE_TOKEN,
      singleton: true,
      factory: async () => {
        const contextAssembler = await kernel.services.resolve(CONTEXT_ASSEMBLER_TOKEN);
        const agentDispatcher = await kernel.services.resolve(AGENT_DISPATCHER_TOKEN);
        const memoryRecorder = await kernel.services.resolve(MEMORY_RECORDER_TOKEN);
        const toolManager = await kernel.services.resolve(TOOL_RUNTIME_TOKEN);
        return new ExecutionEngine({
          contextAssembler,
          agentDispatcher,
          toolManager,
          memoryRecorder,
          eventBus,
          logger,
        });
      },
    });

    // Register as the Workflow Engine's executor token
    kernel.registerService({
      token: WORKFLOW_EXECUTOR_TOKEN,
      singleton: true,
      factory: async () => {
        return kernel.services.resolve<StepExecutor>(EXECUTION_ENGINE_TOKEN);
      },
    });
  },
};
