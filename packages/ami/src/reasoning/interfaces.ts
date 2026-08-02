import type { Disposable } from '@gamedev-agent/shared';
import type { ResolvedCapability } from '@gamedev-agent/tool-runtime';
import type {
  ApprovalRequest,
  ApprovalResponse,
  Decision,
  GoalNode,
  GoalTree,
  MemoryQuery,
  MemoryRecord,
  MissionFSMEvent,
  MissionGoal,
  MissionOutcome,
  MissionState,
  Observation,
  ProgressReport,
  ReasoningContext,
  RetryPolicy,
  StepPlan,
  StrategyResult,
  Thought,
  ToolSelection,
  VerificationResult,
} from './types';

/**
 * The seam around the LLM/reasoning provider. Reuses Nova's existing
 * ModelProvidersService via a thin adapter at the DI boundary (see
 * `src/reasoning/adapters.ts`) — AMI never creates its own LLM client or
 * hardcodes an API key/endpoint.
 */
export interface ILLMProvider {
  complete(prompt: string): Promise<string>;
}

/**
 * Mission lifecycle state machine. Transitions are explicit; illegal
 * transitions throw {@link InvalidTransitionError}.
 */
export interface IMissionStateMachine {
  current(): MissionState;
  can(event: MissionFSMEvent): boolean;
  transition(event: MissionFSMEvent): MissionState;
  reset(initial?: MissionState): void;
}

/**
 * Mission-scoped memory: write, query, and summarize memory records.
 */
export interface IMissionMemoryStore {
  write(record: MemoryRecord): Promise<void>;
  query(query: MemoryQuery): Promise<MemoryRecord[]>;
  summarize(missionId: string): Promise<string>;
}

/**
 * Decomposes a mission goal into a dependency-ordered goal tree.
 */
export interface IGoalDecomposer {
  decompose(goal: MissionGoal): Promise<GoalTree>;
}

/**
 * A single verification strategy. Registered into the verification engine via
 * its `kind` key — dispatch is by registry lookup, never a switch statement.
 */
export interface VerificationStrategy {
  readonly kind: string;
  verify(observation: Observation, context?: Record<string, unknown>): Promise<StrategyResult>;
}

/**
 * Aggregates per-strategy verification results into a single verdict.
 */
export interface IVerificationEngine {
  registerStrategy(strategy: VerificationStrategy): void;
  verify(observation: Observation): Promise<VerificationResult>;
}

/**
 * Resolves the retry policy for a capability kind.
 */
export interface IRetryStrategyResolver {
  resolve(capabilityKind: string): RetryPolicy;
}

/**
 * Estimates mission progress from the goal tree (pure, deterministic).
 */
export interface IProgressEstimator {
  estimate(tree: GoalTree): ProgressReport;
}

/**
 * Decides whether a step plan needs human approval and, if so, waits for it.
 */
export interface IApprovalGate {
  requiresApproval(stepPlan: StepPlan): boolean;
  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
}

/**
 * The reasoning engine: think (LLM) and plan (deterministic mapping).
 */
export interface IReasoningEngine {
  think(context: ReasoningContext): Promise<Thought>;
  plan(thought: Thought, node: GoalNode): StepPlan;
}

/**
 * Thin ranking/filtering layer on top of the existing Capability Planner.
 */
export interface IToolSelector {
  select(
    stepPlan: StepPlan,
    excludedCapabilityIds?: readonly string[],
  ): Promise<ToolSelection>;
}

/**
 * Normalizes Execution Engine completion events into Observation objects.
 */
export interface IObservationCollector {
  attach(): Disposable;
  collect(stepPlanId: string, toolSelectionId: string): Observation | null;
  latest(): Observation | null;
}

/**
 * Reflects on a verification result and returns a decision + memory write.
 */
export interface IReflectionEngine {
  reflect(
    context: ReasoningContext,
    verification: VerificationResult,
  ): Promise<{ readonly decision: Decision; readonly memoryRecord: MemoryRecord | null }>;
}

/**
 * The reasoning loop — the composition root that sequences every stage.
 */
export interface IReasoningLoop {
  run(mission: MissionGoal): Promise<MissionOutcome>;
  cancel(): void;
}

/**
 * The filesystem surface verification strategies need. Implemented at the DI
 * boundary by an adapter over Nova's FilesystemToolAdapter (its public
 * `invoke` method) — strategies never touch the concrete adapter.
 */
export interface FileSystemAdapter {
  readFile(path: string): Promise<string>;
  listFiles(
    dirPath: string,
  ): Promise<ReadonlyArray<{ readonly name: string; readonly path: string; readonly isDirectory: boolean }>>;
}

/**
 * The terminal surface verification strategies need. Implemented at the DI
 * boundary by an adapter over Nova's TerminalToolAdapter / TerminalClient.
 */
export interface TerminalAdapter {
  run(
    command: string,
    args: ReadonlyArray<string>,
    options?: { readonly cwd?: string; readonly timeoutMs?: number },
  ): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }>;
}

/**
 * Type-only import re-exports used by consumers so they never import from
 * `../memory/memory-query` directly.
 */
export type {
  MemoryQuery,
  MemoryRecord,
  ResolvedCapability,
};