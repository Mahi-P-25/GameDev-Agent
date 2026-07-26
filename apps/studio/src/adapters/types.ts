/**
 * Typed placeholder adapters for Nova Studio data that the Studio API does not
 * yet surface.
 *
 * Per the Sprint-10 architecture directive: "If backend data is unavailable, use
 * typed placeholder adapters with clear separation." Each adapter lives behind a
 * small interface and returns clearly-labelled, typed sample data. When the
 * corresponding backend subsystem lands (Goals, Role System, Notifications), the
 * UI swaps the adapter implementation for a real client — the component
 * contracts (types) do not change.
 *
 * These are NOT hardcoded mock data sprinkled through components. They are
 * isolated adapters with an explicit `source: 'placeholder'` marker so the UI
 * can render a "preview data" badge and so they are trivial to replace.
 */

export type DataSource = 'placeholder' | 'live';

export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: GoalStatus;
  readonly progress: number;
  readonly dueLabel: string;
  readonly projectId?: string;
}

export type GoalStatus = 'on-track' | 'at-risk' | 'achieved' | 'paused';

/**
 * A role's live working status. These are the canonical states the Studio Home
 * screen renders for the team — they describe *what the role is doing right now*,
 * not a lifecycle. The Role System (future) will supply the real values; the
 * placeholder adapter below mocks them.
 */
export type RoleStatus =
  | 'ready' // available, nothing in flight
  | 'planning' // thinking / designing before work
  | 'working' // actively executing
  | 'waiting' // blocked on a dependency, approval, or another role
  | 'blocked' // cannot proceed (dependency missing / failed)
  | 'offline'; // not provisioned / unavailable this session

/**
 * A member of the studio's working team. Derived today from a placeholder
 * adapter; the live Role System will fill `currentMission`, `lastActivity`, and
 * `availability` with real telemetry.
 */
export interface StudioRole {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly members: number;
  /** Live working status (see {@link RoleStatus}). */
  readonly status: RoleStatus;
  /** Human-readable availability summary, e.g. "2 of 3 available". */
  readonly availability: string;
  /** The mission this role is currently on, if any. */
  readonly currentMission: string | null;
  /** Epoch ms of the last recorded activity for this role. */
  readonly lastActivity: number | null;
}

export interface Notification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly kind: 'info' | 'success' | 'warning' | 'approval';
  readonly timestamp: number;
  readonly read: boolean;
}

export interface PlaceholderAdapter<T> {
  readonly source: DataSource;
  list(): ReadonlyArray<T>;
}
