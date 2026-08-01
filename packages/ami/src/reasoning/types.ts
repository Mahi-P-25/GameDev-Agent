/**
 * PHASE 0 — Reconnaissance summary (drift check).
 *
 * The Nova codebase is a pnpm monorepo (packages/*), not a single `src/` tree:
 *  - MissionAgent (packages/execution-engine/src/MissionAgent.ts) is constructed
 *    with a single `MissionAgentOptions` object (NOT positional constructor
 *    params) and its public surface is `run(source, signal?)` / `cancel()` /
 *    `dispose()`. There is no `start/pause/resume` — `run` is the mission
 *    entry point. The spec's "start/pause/resume/cancel" maps to this real
 *    surface; see the DEVIATION note in MissionAgent integration (Phase 10).
 *  - Event Bus (packages/events): `publish<T>(definition, payload, options?)`,
 *    `subscribe<T>(definition, handler)` → `Disposable`, `once`, `unsubscribe`,
 *    `replay`. Envelope = `{ definition, metadata, payload }`. Definitions are
 *    `{ type, version, validate? }`. Source for this: packages/events/src/types.ts.
 *  - Capability Planner (packages/tool-runtime/src/CapabilityPlanner.ts):
 *    `resolveAbilities(abilities): readonly ResolvedCapability[]` and
 *    `getAvailableAbilities(): readonly MissionAbility[]`. ResolvedCapability
 *    carries `{ ability, toolId, capabilityId, capabilityName, confidence, ... }`.
 *  - Execution Engine (packages/execution-engine/src/ExecutionEngine.ts)
 *    implements `StepExecutor` with `execute(step, context): Promise<StepResult>`
 *    and emits `ExecutionStepStarted`/`ExecutionStepCompleted`/`ExecutionStepFailed`
 *    through the shared bus. Source: packages/execution-engine/src/events.ts.
 *  - DI (packages/di + packages/kernel): `createServiceToken<T>(id)` +
 *    `kernel.registerService({ token, singleton, factory })`, factories receive
 *    the ServiceContainer and resolve deps with `container.resolve(token)`.
 *    Kernel modules are `{ name, register(kernel) }`.
 *  - Tests: vitest (globals: false — `describe/expect/it/vi` imported), tests
 *    are co-located in package `src/`; the root vitest.config.ts also includes
 *    the top-level `tests/` directory, which is where this package's tests live.
 *
 * All interfaces below follow Nova naming/typing conventions (readonly fields,
 * branded-free plain strings for AMI-internal ids, `import type` everywhere).
 */

/**
 * A mission-level goal AMI is asked to achieve. Root of the decomposition tree.
 */
export interface MissionGoal {
  readonly id: string;
  readonly missionId: string;
  readonly description: string;
  readonly acceptanceCriteria: readonly AcceptanceCriteria[];
  readonly priority?: number;
}

/**
 * A single checkable acceptance criterion for a mission or goal node.
 */
export interface AcceptanceCriteria {
  readonly id: string;
  readonly kind: string;
  readonly description: string;
  readonly params: Record<string, unknown>;
}

/**
 * A node in the goal tree — one unit of work the reasoning loop executes.
 */
export interface GoalNode {
  readonly id: string;
  readonly missionId: string;
  readonly parentId: string | null;
  readonly description: string;
  readonly status: GoalNodeStatus;
  readonly acceptanceCriteria: readonly AcceptanceCriteria[];
  readonly dependencies: readonly string[];
  readonly estimatedComplexity: number;
  readonly attempts: number;
  readonly highImpact: boolean;
}

export type GoalNodeStatus =
  | 'pending'
  | 'ready'
  | 'thinking'
  | 'planning'
  | 'tool_selecting'
  | 'executing'
  | 'observing'
  | 'verifying'
  | 'reflecting'
  | 'done'
  | 'retry'
  | 'blocked'
  | 'replan';

/**
 * The dependency-ordered tree of goals for one mission.
 */
export interface GoalTree {
  readonly missionId: string;
  readonly rootId: string;
  readonly nodes: Map<string, GoalNode>;
}

/**
 * Everything the reasoning engine needs to reason about one goal node.
 */
export interface ReasoningContext {
  readonly missionId: string;
  readonly node: GoalNode;
  readonly memorySummary: string;
  readonly priorFailures: readonly FailureInfo[];
  readonly projectContext?: Record<string, unknown>;
}

/**
 * The output of a single "think" step.
 */
export interface Thought {
  readonly id: string;
  readonly reasoning: string;
  readonly candidateActions: readonly string[];
  readonly confidence: number;
}

/**
 * A concrete plan for one goal node produced from a thought.
 */
export interface StepPlan {
  readonly id: string;
  readonly goalNodeId: string;
  readonly description: string;
  readonly requiredCapabilityKind: string;
  readonly params: Record<string, unknown>;
  readonly highImpact: boolean;
  readonly requiresApproval?: boolean;
}

/**
 * A concrete tool/capability chosen to execute a step plan.
 */
export interface ToolSelection {
  readonly stepPlanId: string;
  readonly capabilityId: string;
  readonly toolName: string;
  readonly params: Record<string, unknown>;
  readonly excludedCapabilityIds: readonly string[];
}

/**
 * A normalized observation of what happened when a step plan executed.
 */
export interface Observation {
  readonly id: string;
  readonly stepPlanId: string;
  readonly toolSelectionId: string;
  readonly rawResult: unknown;
  readonly normalizedPayload: Record<string, unknown>;
  readonly success: boolean;
  readonly errors: readonly string[];
}

/**
 * The aggregate result of verifying an observation.
 */
export interface VerificationResult {
  readonly id: string;
  readonly observationId: string;
  readonly status: 'passed' | 'failed' | 'partial' | 'inconclusive';
  readonly evidence: Record<string, unknown>;
  readonly strategyResults: readonly StrategyResult[];
}

/**
 * The result of one verification strategy.
 */
export interface StrategyResult {
  readonly strategyKind: string;
  readonly passed: boolean;
  readonly detail: string;
}

/**
 * A recorded failure, used by retry/escalation decision logic.
 */
export interface FailureInfo {
  readonly kind: string;
  readonly message: string;
  readonly capabilityId?: string;
  readonly attempt: number;
}

/**
 * Retry policy for a capability kind. Applied (possibly merged over a default)
 * by the retry strategy resolver.
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly backoffFactor: number;
  readonly escalateAfter: number;
  readonly alternateToolAllowed: boolean;
}

/**
 * The decision the reflection engine makes after a verification result.
 */
export type Decision =
  | { readonly type: 'retry' }
  | { readonly type: 'retry_alternate_tool' }
  | { readonly type: 'replan_subgoal'; readonly reason: string }
  | { readonly type: 'escalate_to_human'; readonly reason: string }
  | { readonly type: 'continue_to_next_goal' }
  | { readonly type: 'complete_mission' }
  | { readonly type: 'abort_mission'; readonly reason: string };

/**
 * A progress report derived from the goal tree.
 */
export interface ProgressReport {
  readonly missionId: string;
  readonly percent: number;
  readonly completedGoals: number;
  readonly totalGoals: number;
  readonly remainingGoals: number;
  readonly estimatedRemainingSteps: number;
}

/**
 * A single record in mission/project memory.
 */
export interface MemoryRecord {
  readonly id: string;
  readonly missionId: string;
  readonly projectId: string;
  readonly scope: 'mission' | 'project';
  readonly kind: 'decision' | 'failure' | 'success-pattern' | 'fact' | 'approval';
  readonly goalNodeId?: string;
  readonly content: string;
  readonly evidence?: Record<string, unknown>;
  readonly createdAt: string;
}

/**
 * A query against mission memory.
 */
export interface MemoryQuery {
  readonly missionId?: string;
  readonly projectId?: string;
  readonly scope?: 'mission' | 'project';
  readonly kind?: MemoryRecord['kind'];
  readonly goalNodeId?: string;
  readonly limit?: number;
}

/**
 * A request for a human to approve (or reject/modify) a high-impact step.
 */
export interface ApprovalRequest {
  readonly id: string;
  readonly missionId: string;
  readonly stepPlan: StepPlan;
  readonly reasoningTrace: string;
  readonly riskSummary: string;
  readonly createdAt: string;
}

/**
 * The human's response to an approval request.
 */
export interface ApprovalResponse {
  readonly requestId: string;
  readonly decision: 'approved' | 'rejected' | 'modified';
  readonly modifiedParams?: Record<string, unknown>;
  readonly respondedBy: string;
}

/**
 * AMI mission lifecycle state machine.
 */
export type MissionState =
  | 'created'
  | 'decomposing'
  | 'reasoning'
  | 'executing'
  | 'verifying'
  | 'reflecting'
  | 'paused_approval'
  | 'failed'
  | 'completed'
  | 'canceled';

export type MissionFSMEvent =
  | 'start'
  | 'goalTreeReady'
  | 'needsApproval'
  | 'approvalGranted'
  | 'approvalDenied'
  | 'planReady'
  | 'executionDone'
  | 'verificationDone'
  | 'reflectionRetry'
  | 'reflectionContinue'
  | 'reflectionReplan'
  | 'reflectionFail'
  | 'allGoalsComplete'
  | 'cancel';

/**
 * Outcome returned by {@link IReasoningLoop.run} — the loop's single result.
 */
export interface MissionOutcome {
  readonly missionId: string;
  readonly state: MissionState;
  readonly decisions: readonly Decision[];
  readonly goalTree: GoalTree | null;
  /** Present when the mission ended in `failed`/`canceled`. */
  readonly reason?: string;
}
