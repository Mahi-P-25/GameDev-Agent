/**
 * The Workflow execution state machine, owned exclusively by the Workflow Engine.
 *
 * This is a pure, dependency-free description of *which transitions are legal*
 * from each state. Centralizing it keeps the {@link WorkflowManager} declarative:
 * it asks `canTransition(from, to)` rather than embedding a web of `if` guards.
 * The graph is intentionally explicit so an invalid transition is a single lookup
 * away and is trivially unit-testable.
 *
 * Lifecycle:
 * ```
 * created → planned → running → (paused) → running → completed
 *                          ↘ failed | cancelled
 * ```
 *
 * Key invariants enforced here:
 *  - `created` is the only initial state.
 *  - `planned` is reached once the engine has produced a valid execution plan
 *    from an approved Mission Tree. A workflow cannot run before it is planned.
 *  - `running` is the active execution state. `pause` keeps the workflow in
 *    `running` (it is a signal that halts forward progress, not a distinct
 *    state), mirroring the Coordinator's `mission.execution-` model. The
 *    `paused` flag is tracked on the execution record, not here.
 *  - `completed`/`failed`/`cancelled` are terminal; no outgoing transitions.
 *  - `failed` supports a `retry`, which the engine models by re-entering
 *    `running` from `failed` (see {@link WorkflowState} handling in the manager).
 */

/** The complete execution lifecycle of a Workflow run. */
export type WorkflowState =
  | 'created'
  | 'planned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Canonical lifecycle order, used for display and monotonic-progress checks. */
export const WORKFLOW_LIFECYCLE: ReadonlyArray<WorkflowState> = [
  'created',
  'planned',
  'running',
  'completed',
];

/** Terminal states from which no further transition is possible. */
export const WORKFLOW_TERMINAL_STATES: ReadonlyArray<WorkflowState> = [
  'completed',
  'failed',
  'cancelled',
];

/** Returns the set of states a workflow in `from` may legally move to. */
export function allowedTransitions(from: WorkflowState): ReadonlyArray<WorkflowState> {
  const targets = TRANSITIONS.get(from);
  return targets ?? EMPTY;
}

/** True when moving `from → to` is a legal lifecycle transition. */
export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return allowedTransitions(from).includes(to);
}

/** True when `state` is terminal (no outgoing transitions). */
export function isTerminal(state: WorkflowState): boolean {
  return WORKFLOW_TERMINAL_STATES.includes(state);
}

const EMPTY: ReadonlyArray<WorkflowState> = [];

const TRANSITIONS: ReadonlyMap<WorkflowState, ReadonlyArray<WorkflowState>> = new Map([
  ['created', ['planned', 'cancelled']],
  ['planned', ['running', 'cancelled']],
  ['running', ['completed', 'failed', 'cancelled']],
  ['completed', EMPTY],
  ['failed', EMPTY],
  ['cancelled', EMPTY],
]);
