/**
 * Nova Context Engine — public API.
 *
 * The Context Engine tracks *what the Creative Director is doing right now*
 * (CurrentContext via ContextManager) AND assembles optimal context packages
 * for AI agents via the ContextPipeline.
 *
 * --- Existing (unchanged) ---
 * ContextManager, CurrentContext, events, errors — all backward compatible.
 *
 * --- New (Context Pipeline) ---
 * ContextRequest / ContextPackage contracts, ContextProvider interface,
 * ProviderRegistry, ContextPipeline, ContextCache, built-in providers,
 * role-based ContextPolicies.
 *
 * Only the surface below is exported; internal modules stay private so future
 * refactors do not break consumers.
 */

// --- Domain model & types (existing) ---------------------------------------
export type {
  ContextId,
  CurrentContext,
  ContextInit,
  ContextPatch,
  AbsolutePath,
  BranchName,
  ProjectId,
  WorkspaceId,
  MissionId,
  GoalId,
  WorkflowId,
  WorkflowExecutionId,
} from './ContextTypes';
export { RECENT_FILES_LIMIT, RECENT_WORKFLOWS_LIMIT } from './ContextTypes';

// --- Errors (existing) ------------------------------------------------------
export {
  ContextError,
  ContextValidationError,
  ContextNotFoundError,
  ContextStateError,
} from './ContextErrors';
export type { ValidationViolation } from './ContextErrors';

// --- Pipeline Errors (new) --------------------------------------------------
export {
  ContextPipelineError,
  ContextProviderError,
  ContextPolicyError,
  ContextBudgetExceededError,
} from './ContextPipelineErrors';

// --- Events (existing) ------------------------------------------------------
export {
  ContextInitialized,
  ContextWorkspaceChanged,
  ContextProjectChanged,
  ContextGoalChanged,
  ContextMissionChanged,
  ContextWorkflowChanged,
  ContextActiveFileChanged,
  ContextBranchChanged,
  ContextRecentFileAdded,
  ContextRecentWorkflowAdded,
  ContextReset,
  ContextChanged,
} from './ContextEvents';
export type {
  ContextInitializedPayload,
  ContextWorkspaceChangedPayload,
  ContextProjectChangedPayload,
  ContextGoalChangedPayload,
  ContextMissionChangedPayload,
  ContextWorkflowChangedPayload,
  ContextActiveFileChangedPayload,
  ContextBranchChangedPayload,
  ContextRecentFileAddedPayload,
  ContextRecentWorkflowAddedPayload,
  ContextResetPayload,
  ContextChangedPayload,
  ContextEventPayloads,
} from './ContextEvents';

// --- Core components (existing) ---------------------------------------------
export { ContextFactory } from './ContextFactory';
export type { ContextFactoryOptions } from './ContextFactory';
export { ContextRegistry } from './ContextRegistry';
export { ContextHistory } from './ContextHistory';
export { ContextManager } from './ContextManager';
export type { ContextManagerOptions } from './ContextManager';

// --- Validation (existing) --------------------------------------------------
export {
  validateContext,
  validateContextFields,
  assertValidContext,
  isContextJsonSafe,
} from './ContextValidator';

// --- Input / Output Contracts (new) -----------------------------------------
export type {
  AgentRole,
  ContextPurpose,
  ContextRequest,
} from './ContextRequest';
export type {
  ContextPackageId,
  ContextItemId,
  ContextSourceName,
  SourceAttribution,
  ContextItem,
  AssemblyMetrics,
  ContextPackage,
} from './ContextPackage';
export { CONTEXT_VERSION } from './ContextPackage';

// --- Provider Interface (new) -----------------------------------------------
export type {
  SourceType,
  ProviderMetadata,
  AssemblyContext,
  ContextProvider,
} from './ContextProvider';

// --- Policy & Resolver (new) ------------------------------------------------
export type {
  ProviderPolicyConfig,
  RankingWeights,
  BudgetConfig,
  CompressionConfig,
  ContextPolicy,
} from './ContextPolicy';
export {
  DEFAULT_RANKING_WEIGHTS,
  DEFAULT_BUDGET_CONFIG,
  DEFAULT_COMPRESSION_CONFIG,
  createDefaultPolicy,
  EXECUTOR_POLICY,
  ANALYST_POLICY,
  ARCHITECT_POLICY,
  CREATIVE_DIRECTOR_POLICY,
  REVIEWER_POLICY,
  BUILT_IN_POLICIES,
  findPolicyForRole,
} from './ContextPolicy';
export { ContextResolver } from './ContextResolver';
export type { ResolvedProviders } from './ContextResolver';
export { ProviderRegistry } from './ProviderRegistry';

// --- Pipeline Components (new) ----------------------------------------------
export { ContextBuilder } from './ContextBuilder';
export { ContextRanker } from './ContextRanker';
export { TokenEstimator, TokenBudget } from './TokenBudget';
export type { BudgetResult } from './TokenBudget';
export { ContextDeduplicator } from './ContextDeduplicator';
export { ContextCompressor } from './ContextCompressor';
export type { CompressionResult } from './ContextCompressor';
export { ContextCache } from './ContextCache';
export type { CacheStats } from './ContextCache';
export { ContextPipeline } from './ContextPipeline';

// --- Built-in Providers (new) -----------------------------------------------
export {
  CurrentContextProvider,
  MemoryProvider,
  StrategyProvider,
  MissionProvider,
  GoalProvider,
  TaskGraphProvider,
  FileProvider,
  GitProvider,
  ToolResultProvider,
  DocumentationProvider,
  ArchitectureProvider,
  UserPreferenceProvider,
} from './providers';
export type {
  MemoryEntry,
  StrategyData,
  MissionData,
  GoalData,
  TaskGraphData,
  TaskNode,
  FileContent,
  GitDiff,
  ToolResult,
  DocumentationEntry,
  ArchitectureNote,
  UserPreference,
} from './providers';

// --- Kernel integration (existing + new) ------------------------------------
export {
  CONTEXT_MANAGER_TOKEN,
  CONTEXT_PROVIDER_REGISTRY_TOKEN,
  CONTEXT_PIPELINE_TOKEN,
  CONTEXT_POLICIES_TOKEN,
  CONTEXT_CACHE_TOKEN,
  contextModule,
} from './ContextModule';
