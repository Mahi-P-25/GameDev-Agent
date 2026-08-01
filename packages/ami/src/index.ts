/**
 * Autonomous Mission Intelligence — public API.
 *
 * AMI adds a reasoning layer on top of Nova's existing Planner/Coordinator/
 * Workflow/Execution systems. It owns the mission lifecycle (state machine),
 * goal decomposition, memory, verification, approval gating, retry/escalation,
 * and the reasoning loop that sequences every stage. It never replaces the
 * systems it orchestrates — it depends on their existing interfaces.
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export * from './reasoning/types';

// ─── Interfaces ──────────────────────────────────────────────────────────────
export * from './reasoning/interfaces';

// ─── Reasoning ───────────────────────────────────────────────────────────────
export { MissionStateMachine } from './reasoning/mission-state-machine';
export { InvalidTransitionError } from './reasoning/mission-state-machine';
export { addNode, getReadyNodes, markStatus, setAttempts, isComplete, hasBlockedNodes } from './reasoning/goal-tree';
export * as goalTree from './reasoning/goal-tree';
export { GoalDecomposer } from './reasoning/goal-decomposer';
export { VerificationEngine } from './reasoning/verification-engine';
export { NoCapabilityFoundError } from './reasoning/tool-selector';
export { FileStateStrategy } from './reasoning/verification-strategies/file-state-strategy';
export { TestRunStrategy } from './reasoning/verification-strategies/test-run-strategy';
export { LintCheckStrategy } from './reasoning/verification-strategies/lint-check-strategy';
export { CustomPredicateStrategy } from './reasoning/verification-strategies/custom-predicate-strategy';
export { RetryStrategyResolver, DEFAULT_RETRY_POLICY } from './reasoning/retry-strategy-resolver';
export { ProgressEstimator } from './reasoning/progress-estimator';
export { ReasoningEngine } from './reasoning/reasoning-engine';
export { ToolSelector } from './reasoning/tool-selector';
export { ObservationCollector } from './reasoning/observation-collector';
export { ReflectionEngine } from './reasoning/reflection-engine';
export { ReasoningEventEmitter } from './reasoning/reasoning-event-emitter';
export { ReasoningLoop } from './reasoning/reasoning-loop';
export { ModelProvidersLlmAdapter } from './reasoning/adapters';
export { ToolManagerFileSystemAdapter, ToolManagerTerminalAdapter } from './reasoning/adapters';

// ─── Events ──────────────────────────────────────────────────────────────────
export * from './reasoning/reasoning-events';

// ─── Memory ──────────────────────────────────────────────────────────────────
export * from './memory/memory-record';
export * from './memory/memory-query';
export { InMemoryMemoryProvider } from './memory/providers/in-memory-provider';
export { MissionMemoryStore } from './memory/mission-memory-store';

// ─── Approval ────────────────────────────────────────────────────────────────
export * from './approval/approval-request';
export { ApprovalPolicy } from './approval/approval-policy';
export { ApprovalGate, ApprovalTimeoutError } from './approval/approval-gate';

// ─── DI ──────────────────────────────────────────────────────────────────────
export { amiModule } from './ami-module';
export {
  MISSION_STATE_MACHINE_TOKEN,
  MISSION_MEMORY_STORE_TOKEN,
  GOAL_DECOMPOSER_TOKEN,
  VERIFICATION_ENGINE_TOKEN,
  RETRY_STRATEGY_RESOLVER_TOKEN,
  PROGRESS_ESTIMATOR_TOKEN,
  APPROVAL_GATE_TOKEN,
  REASONING_ENGINE_TOKEN,
  TOOL_SELECTOR_TOKEN,
  OBSERVATION_COLLECTOR_TOKEN,
  REFLECTION_ENGINE_TOKEN,
  REASONING_LOOP_TOKEN,
  LLM_PROVIDER_TOKEN,
} from './tokens';
