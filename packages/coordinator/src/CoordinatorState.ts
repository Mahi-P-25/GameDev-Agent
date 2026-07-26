import type { MissionStatus } from './CoordinatorTypes';

/**
 * The Mission lifecycle state machine, owned by the Coordinator.
 *
 * This is a pure, dependency-free description of *which transitions are legal*
 * from each status. Centralizing it keeps the {@link CoordinatorManager}
 * declarative: it asks `canTransition(from, to)` rather than embedding a web of
 * `if` guards. The graph is intentionally explicit so an invalid transition is a
 * single lookup away and is trivially unit-testable.
 *
 * Lifecycle:
 * ```
 * submitted → accepted → analysing → waiting_for_approval → approved
 *          → ready → executing → reviewing → completed
 *                              ↘ failed | cancelled
 * ```
 *
 * Key invariants enforced here:
 *  - `submitted` is the only initial state.
 *  - Approval is a *gate*: `waiting_for_approval` may only advance to `approved`
 *    (or be `cancelled`). It cannot skip to `ready` without approval.
 *  - A mission that needs no approval moves `analysing → ready` directly.
 *  - `executing → reviewing → completed` is the happy execution path.
 *  - `failed`/`cancelled` are reachable from most active states and are terminal.
 *  - Terminal states (`completed`, `failed`, `cancelled`) transition nowhere.
 */

/** Returns the set of statuses a mission in `from` may legally move to. */
export function allowedTransitions(from: MissionStatus): ReadonlyArray<MissionStatus> {
  const targets = TRANSITIONS.get(from);
  return targets ?? EMPTY;
}

/** True when moving `from → to` is a legal lifecycle transition. */
export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return allowedTransitions(from).includes(to);
}

/** True when `status` is terminal (no outgoing transitions). */
export function isTerminal(status: MissionStatus): boolean {
  return MISSION_TERMINAL_STATES.includes(status);
}

/** Monotonic progress index of a status in the canonical lifecycle (0-based). */
export function lifecycleIndex(status: MissionStatus): number {
  const index = MISSION_LIFECYCLE.indexOf(status);
  return index < 0 ? MISSION_LIFECYCLE.length : index;
}

const EMPTY: ReadonlyArray<MissionStatus> = [];

const MISSION_TERMINAL_STATES: ReadonlyArray<MissionStatus> = ['completed', 'failed', 'cancelled'];

const MISSION_LIFECYCLE: ReadonlyArray<MissionStatus> = [
  'submitted',
  'accepted',
  'analysing',
  'waiting_for_approval',
  'approved',
  'ready',
  'executing',
  'reviewing',
  'completed',
];

const TRANSITIONS: ReadonlyMap<MissionStatus, ReadonlyArray<MissionStatus>> = new Map([
  ['submitted', ['accepted', 'cancelled']],
  ['accepted', ['analysing', 'cancelled']],
  ['analysing', ['waiting_for_approval', 'ready', 'failed', 'cancelled']],
  ['waiting_for_approval', ['approved', 'cancelled']],
  ['approved', ['ready', 'cancelled']],
  ['ready', ['executing', 'cancelled']],
  ['executing', ['reviewing', 'failed', 'cancelled']],
  ['reviewing', ['completed', 'executing', 'failed', 'cancelled']],
  ['completed', EMPTY],
  ['failed', EMPTY],
  ['cancelled', EMPTY],
]);
