/**
 * Nova Execution Engine — bridges Workflow steps to Context Pipeline,
 * Model Providers, Tool Runtime, and Memory.
 */

// ─── Errors ────────────────────────────────────────────────────────────────
export {
  ExecutionError,
  StepTimeoutError,
  StepCancelledError,
  ContextAssemblyError,
  AgentDispatchError,
  ToolInvocationError,
  MemoryRecordingError,
} from './errors';

// ─── Events ────────────────────────────────────────────────────────────────
export {
  ExecutionStepStarted,
  ExecutionStepProgress,
  ExecutionToolInvoked,
  ExecutionToolResult,
  ExecutionStepCompleted,
  ExecutionStepFailed,
} from './events';
export type {
  ExecutionStepStartedPayload,
  ExecutionStepProgressPayload,
  ExecutionToolInvokedPayload,
  ExecutionToolResultPayload,
  ExecutionStepCompletedPayload,
  ExecutionStepFailedPayload,
  ExecutionEventPayloads,
} from './events';

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  AssembledContext,
  DispatchContext,
  AgentDispatchResult,
  ToolInvocation,
  ExecutionStepResult,
  CapabilityMapping,
  ExecutionOptions,
  ToolDefinition,
  ExecutionMemoryInput,
} from './types';
export { mapStepToCapabilities } from './types';

// ─── Components ────────────────────────────────────────────────────────────
export { ContextAssembler } from './ContextAssembler';
export { AgentDispatcher } from './AgentDispatcher';
export { ToolBridge } from './ToolBridge';
export { MemoryRecorder } from './MemoryRecorder';
export { ProgressTracker } from './ProgressTracker';

// ─── Engine ────────────────────────────────────────────────────────────────
export { ExecutionEngine } from './ExecutionEngine';
export type { ExecutionEngineOptions } from './ExecutionEngine';

// ─── MissionAgent ─────────────────────────────────────────────────────────
export { MissionAgent } from './MissionAgent';
export type { MissionAgentOptions } from './MissionAgentTypes';
export type {
  AgentState,
  AgentDecision as AgentDecisionType,
  AgentObservation as AgentObservationType,
  AgentThought as AgentThoughtType,
  AgentAction,
  AgentVerification as AgentVerificationType,
  ShortTermMemory,
  MissionReport,
} from './MissionAgentTypes';
export {
  AgentStateChanged,
  AgentThought,
  AgentObservation,
  AgentDecisionEvent,
  AgentActionStarted,
  AgentActionResult,
  AgentVerification,
  AgentProgress,
  AgentMissionComplete,
  AgentArtifactCreated,
} from './MissionAgentEvents';
export type {
  AgentStateChangedPayload,
  AgentThoughtPayload,
  AgentObservationPayload,
  AgentDecisionPayload,
  AgentActionStartedPayload,
  AgentActionResultPayload,
  AgentVerificationPayload,
  AgentProgressPayload,
  AgentMissionCompletePayload,
  AgentArtifactCreatedPayload,
  AgentEventPayloads,
} from './MissionAgentEvents';

// ─── Memory Integration ───────────────────────────────────────────────────
export { MissionMemoryIntegration } from './MissionMemoryIntegration';
export type { MissionMemoryContext } from './MissionMemoryIntegration';
export {
  MissionMemoryRetrieved,
  MissionMemoryRecorded,
  MissionMemoryPersisted,
} from './MissionMemoryEvents';
export type {
  MissionMemoryRetrievedPayload,
  MissionMemoryRecordedPayload,
  MissionMemoryPersistedPayload,
  MissionMemoryEventPayloads,
} from './MissionMemoryEvents';

// ─── DI Module ─────────────────────────────────────────────────────────────
export {
  executionEngineModule,
  EXECUTION_ENGINE_TOKEN,
  CONTEXT_ASSEMBLER_TOKEN,
  AGENT_DISPATCHER_TOKEN,
  MEMORY_RECORDER_TOKEN,
} from './ExecutionModule';
export {
  missionAgentModule,
  MISSION_AGENT_TOKEN,
} from './MissionAgentModule';
