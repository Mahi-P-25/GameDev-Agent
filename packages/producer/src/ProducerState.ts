import type { GoalStatus } from './ProducerTypes';

/**
 * The Goal lifecycle state machine, owned by the Producer.
 *
 * This is a pure, dependency-free description of *which transitions are legal*
 * from each status. Centralizing it keeps the {@link ProducerManager}
 * declarative: it asks `canTransition(from, to)` rather than embedding a web of
 * `if` guards. The graph is intentionally explicit so an invalid transition is a
 * single lookup away and is trivially unit-testable.
 *
 * Lifecycle:
 * ```
 * submitted → analysing → objectives_generated → mission_tree_generated
 *          → review_package_generated → waiting_for_approval → approved
 *                                                            ↘ rejected
 * ```
 *
 * Key invariants enforced here:
 *  - `submitted` is the only initial state.
 *  - Analysis must complete before objectives, objectives before the tree, the
 *    tree before the review package — no phase may be skipped.
 *  - Approval is a gate: `waiting_for_approval` may only advance to `approved`
 *    or be `rejected`.
 *  - `rejected` is reachable from any active analysis phase and is terminal.
 *  - Terminal states (`approved`, `rejected`) transition nowhere.
 */

/** Returns the set of statuses a goal in `from` may legally move to. */
export function allowedTransitions(from: GoalStatus): ReadonlyArray<GoalStatus> {
  const targets = TRANSITIONS.get(from);
  return targets ?? EMPTY;
}

/** True when moving `from → to` is a legal lifecycle transition. */
export function canTransition(from: GoalStatus, to: GoalStatus): boolean {
  return allowedTransitions(from).includes(to);
}

/** True when `status` is terminal (no outgoing transitions). */
export function isTerminal(status: GoalStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/** Monotonic progress index of a status in the canonical lifecycle (0-based). */
export function lifecycleIndex(status: GoalStatus): number {
  const index = LIFECYCLE.indexOf(status);
  return index < 0 ? LIFECYCLE.length : index;
}

const EMPTY: ReadonlyArray<GoalStatus> = [];

const TERMINAL_STATES: ReadonlyArray<GoalStatus> = ['approved', 'rejected'];

const LIFECYCLE: ReadonlyArray<GoalStatus> = [
  'submitted',
  'analysing',
  'objectives_generated',
  'mission_tree_generated',
  'review_package_generated',
  'waiting_for_approval',
  'approved',
];

const TRANSITIONS: ReadonlyMap<GoalStatus, ReadonlyArray<GoalStatus>> = new Map([
  ['submitted', ['analysing', 'rejected']],
  ['analysing', ['objectives_generated', 'rejected']],
  ['objectives_generated', ['mission_tree_generated', 'rejected']],
  ['mission_tree_generated', ['review_package_generated', 'rejected']],
  ['review_package_generated', ['waiting_for_approval', 'rejected']],
  ['waiting_for_approval', ['approved', 'rejected']],
  ['approved', EMPTY],
  ['rejected', EMPTY],
]);
