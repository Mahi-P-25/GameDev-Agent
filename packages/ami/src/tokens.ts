import { createServiceToken } from '@gamedev-agent/di';
import type {
  IApprovalGate,
  IGoalDecomposer,
  ILLMProvider,
  IMissionMemoryStore,
  IMissionStateMachine,
  IObservationCollector,
  IProgressEstimator,
  IReasoningEngine,
  IReasoningLoop,
  IReflectionEngine,
  IRetryStrategyResolver,
  IToolSelector,
  IVerificationEngine,
} from './reasoning/interfaces';

/** DI tokens for every AMI service. Following the repo convention of
 *  `createServiceToken<T>('nova.<package>.<name>')`; tokens never carry
 *  implementation state. */

export const MISSION_STATE_MACHINE_TOKEN = createServiceToken<IMissionStateMachine>('nova.ami.state-machine');
export const MISSION_MEMORY_STORE_TOKEN = createServiceToken<IMissionMemoryStore>('nova.ami.memory-store');
export const GOAL_DECOMPOSER_TOKEN = createServiceToken<IGoalDecomposer>('nova.ami.goal-decomposer');
export const VERIFICATION_ENGINE_TOKEN = createServiceToken<IVerificationEngine>('nova.ami.verification-engine');
export const RETRY_STRATEGY_RESOLVER_TOKEN = createServiceToken<IRetryStrategyResolver>('nova.ami.retry-resolver');
export const PROGRESS_ESTIMATOR_TOKEN = createServiceToken<IProgressEstimator>('nova.ami.progress-estimator');
export const APPROVAL_GATE_TOKEN = createServiceToken<IApprovalGate>('nova.ami.approval-gate');
export const REASONING_ENGINE_TOKEN = createServiceToken<IReasoningEngine>('nova.ami.reasoning-engine');
export const TOOL_SELECTOR_TOKEN = createServiceToken<IToolSelector>('nova.ami.tool-selector');
export const OBSERVATION_COLLECTOR_TOKEN = createServiceToken<IObservationCollector>('nova.ami.observation-collector');
export const REFLECTION_ENGINE_TOKEN = createServiceToken<IReflectionEngine>('nova.ami.reflection-engine');
export const REASONING_LOOP_TOKEN = createServiceToken<IReasoningLoop>('nova.ami.reasoning-loop');
export const LLM_PROVIDER_TOKEN = createServiceToken<ILLMProvider>('nova.ami.llm-provider');
