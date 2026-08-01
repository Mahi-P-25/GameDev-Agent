import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import { MODEL_PROVIDERS_SERVICE_TOKEN } from '@gamedev-agent/model-providers';
import { CapabilityPlanner, TOOL_RUNTIME_TOKEN } from '@gamedev-agent/tool-runtime';
import { WORKFLOW_EXECUTOR_TOKEN } from '@gamedev-agent/workflow';
import { ApprovalGate } from './approval/approval-gate';
import { ApprovalPolicy } from './approval/approval-policy';
import { InMemoryMemoryProvider } from './memory/providers/in-memory-provider';
import { MissionMemoryStore } from './memory/mission-memory-store';
import {
  ModelProvidersLlmAdapter,
  ToolManagerFileSystemAdapter,
  ToolManagerTerminalAdapter,
} from './reasoning/adapters';
import { GoalDecomposer } from './reasoning/goal-decomposer';
import { MissionStateMachine } from './reasoning/mission-state-machine';
import { ObservationCollector } from './reasoning/observation-collector';
import { ProgressEstimator } from './reasoning/progress-estimator';
import { ReasoningEngine } from './reasoning/reasoning-engine';
import { ReasoningEventEmitter } from './reasoning/reasoning-event-emitter';
import { ReasoningLoop } from './reasoning/reasoning-loop';
import { ReflectionEngine } from './reasoning/reflection-engine';
import { RetryStrategyResolver } from './reasoning/retry-strategy-resolver';
import { ToolSelector } from './reasoning/tool-selector';
import { VerificationEngine } from './reasoning/verification-engine';
import { FileStateStrategy } from './reasoning/verification-strategies/file-state-strategy';
import { LintCheckStrategy } from './reasoning/verification-strategies/lint-check-strategy';
import { TestRunStrategy } from './reasoning/verification-strategies/test-run-strategy';
import {
  APPROVAL_GATE_TOKEN,
  GOAL_DECOMPOSER_TOKEN,
  LLM_PROVIDER_TOKEN,
  MISSION_MEMORY_STORE_TOKEN,
  MISSION_STATE_MACHINE_TOKEN,
  OBSERVATION_COLLECTOR_TOKEN,
  PROGRESS_ESTIMATOR_TOKEN,
  REASONING_ENGINE_TOKEN,
  REASONING_LOOP_TOKEN,
  REFLECTION_ENGINE_TOKEN,
  RETRY_STRATEGY_RESOLVER_TOKEN,
  TOOL_SELECTOR_TOKEN,
  VERIFICATION_ENGINE_TOKEN,
} from './tokens';

/**
 * Kernel module installing the full AMI stack. Construction is deferred to the
 * `register` phase so services pull their dependencies (shared Event Bus,
 * Logger, Tool Runtime, Model Providers, Workflow executor) from the container
 * — AMI never constructs or owns those systems. Every token is resolvable so
 * consumers (e.g. MissionAgent integration) can depend on the abstraction.
 */
export const amiModule: KernelModule = {
  name: 'nova.ami',
  async register(kernel: StudioKernel): Promise<void> {
    const bus = kernel.events;
    const logger = kernel.logger.child('ami');

    kernel.registerService({
      token: MISSION_STATE_MACHINE_TOKEN,
      singleton: true,
      factory: async () => new MissionStateMachine(),
    });

    kernel.registerService({
      token: MISSION_MEMORY_STORE_TOKEN,
      singleton: true,
      factory: async () => new MissionMemoryStore(new InMemoryMemoryProvider()),
    });

    kernel.registerService({
      token: LLM_PROVIDER_TOKEN,
      singleton: true,
      factory: async () => {
        const modelProviders = await kernel.services.resolve(MODEL_PROVIDERS_SERVICE_TOKEN);
        return new ModelProvidersLlmAdapter(modelProviders);
      },
    });

    kernel.registerService({
      token: GOAL_DECOMPOSER_TOKEN,
      singleton: true,
      factory: async () => {
        const llm = await kernel.services.resolve(LLM_PROVIDER_TOKEN);
        return new GoalDecomposer(llm);
      },
    });

    kernel.registerService({
      token: RETRY_STRATEGY_RESOLVER_TOKEN,
      singleton: true,
      factory: async () => new RetryStrategyResolver(),
    });

    kernel.registerService({
      token: PROGRESS_ESTIMATOR_TOKEN,
      singleton: true,
      factory: async () => new ProgressEstimator(),
    });

    kernel.registerService({
      token: APPROVAL_GATE_TOKEN,
      singleton: true,
      factory: async () => new ApprovalGate({ policy: new ApprovalPolicy(), bus }),
    });

    kernel.registerService({
      token: VERIFICATION_ENGINE_TOKEN,
      singleton: true,
      factory: async () => {
        const toolManager = await kernel.services.resolve(TOOL_RUNTIME_TOKEN);
        const engine = new VerificationEngine();
        engine.registerStrategy(
          new FileStateStrategy(new ToolManagerFileSystemAdapter(toolManager)),
        );
        engine.registerStrategy(
          new TestRunStrategy(new ToolManagerTerminalAdapter(toolManager)),
        );
        engine.registerStrategy(
          new LintCheckStrategy(new ToolManagerTerminalAdapter(toolManager)),
        );
        return engine;
      },
    });

    kernel.registerService({
      token: REASONING_ENGINE_TOKEN,
      singleton: true,
      factory: async () => {
        const [llm, memory] = await Promise.all([
          kernel.services.resolve(LLM_PROVIDER_TOKEN),
          kernel.services.resolve(MISSION_MEMORY_STORE_TOKEN),
        ]);
        return new ReasoningEngine(llm, memory);
      },
    });

    kernel.registerService({
      token: TOOL_SELECTOR_TOKEN,
      singleton: true,
      factory: async () => {
        const toolManager = await kernel.services.resolve(TOOL_RUNTIME_TOKEN);
        return new ToolSelector(new CapabilityPlanner({ toolManager, logger }));
      },
    });

    kernel.registerService({
      token: OBSERVATION_COLLECTOR_TOKEN,
      singleton: true,
      factory: async () => new ObservationCollector(bus),
    });

    kernel.registerService({
      token: REFLECTION_ENGINE_TOKEN,
      singleton: true,
      factory: async () => {
        const [retryResolver, memory] = await Promise.all([
          kernel.services.resolve(RETRY_STRATEGY_RESOLVER_TOKEN),
          kernel.services.resolve(MISSION_MEMORY_STORE_TOKEN),
        ]);
        return new ReflectionEngine(retryResolver, memory);
      },
    });

    kernel.registerService({
      token: REASONING_LOOP_TOKEN,
      singleton: true,
      factory: async () => {
        const [
          stateMachine,
          decomposer,
          memory,
          reasoning,
          toolSelector,
          approval,
          verification,
          collector,
          reflection,
          retryResolver,
          progress,
          executor,
        ] = await Promise.all([
          kernel.services.resolve(MISSION_STATE_MACHINE_TOKEN),
          kernel.services.resolve(GOAL_DECOMPOSER_TOKEN),
          kernel.services.resolve(MISSION_MEMORY_STORE_TOKEN),
          kernel.services.resolve(REASONING_ENGINE_TOKEN),
          kernel.services.resolve(TOOL_SELECTOR_TOKEN),
          kernel.services.resolve(APPROVAL_GATE_TOKEN),
          kernel.services.resolve(VERIFICATION_ENGINE_TOKEN),
          kernel.services.resolve(OBSERVATION_COLLECTOR_TOKEN),
          kernel.services.resolve(REFLECTION_ENGINE_TOKEN),
          kernel.services.resolve(RETRY_STRATEGY_RESOLVER_TOKEN),
          kernel.services.resolve(PROGRESS_ESTIMATOR_TOKEN),
          kernel.services.resolve(WORKFLOW_EXECUTOR_TOKEN),
        ]);
        return new ReasoningLoop({
          stateMachine,
          decomposer,
          memory,
          reasoning,
          toolSelector,
          approval,
          verification,
          collector,
          reflection,
          retryResolver,
          progress,
          emitter: new ReasoningEventEmitter(bus),
          executor,
        });
      },
    });
  },
};
