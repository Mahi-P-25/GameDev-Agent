import type { Intent } from '../../design/variants';

/**
 * Mission Control — the vocabulary of "what should I work on next?".
 *
 * These types are the contract between the mission store (which reads real Nova
 * state) and the mission components (which only render). They are intentionally
 * small and stable so a future AI system can replace the *source* of a mission's
 * objectives / next step without any UI component changing — the components
 * consume {@link MissionView}, never the Coordinator internals.
 */

/** Normalized lifecycle of a single Mission, collapsed from the raw API string. */
export type MissionStatusKey = 'pending' | 'working' | 'blocked' | 'completed' | 'cancelled';

/** The four objective states Mission Control tracks. */
export type ObjectiveStatus = 'pending' | 'working' | 'completed' | 'blocked';

/** One workstream the mission requires (derived from real Coordinator output). */
export interface Objective {
  readonly id: string;
  readonly title: string;
  readonly detail?: string | undefined;
  readonly status: ObjectiveStatus;
}

/** A real subsystem the mission depends on being healthy to proceed. */
export interface MissionDependency {
  readonly id: string;
  readonly name: string;
  readonly status: 'up' | 'degraded' | 'down';
  readonly detail?: string | undefined;
}

/** The single, actionable recommendation the screen answers with. */
export interface NextStep {
  readonly label: string;
  /** Where tapping the Next Step should navigate. */
  readonly to: string;
  readonly intent: Intent;
}

/** The full, presentation-ready Mission projection. */
export interface MissionView {
  readonly id: string | null;
  readonly title: string | null;
  readonly description: string | null;
  readonly priority: string | null;
  readonly statusKey: MissionStatusKey;
  readonly statusRaw: string | null;
  readonly progress: number;
  readonly approvalPending: boolean;
  readonly blocker: string | null;
  readonly objectives: ReadonlyArray<Objective>;
  readonly dependencies: ReadonlyArray<MissionDependency>;
  readonly relatedProjectId: string | null;
  readonly relatedProjectName: string | null;
  readonly relatedWorkflowId: string | null;
  readonly relatedWorkflowName: string | null;
  readonly lastUpdated: number | null;
  readonly nextStep: NextStep | null;
  readonly hasMission: boolean;
}

/* ------------------------------------------------------------------ */
/* Intent + label maps — the single source of visual meaning.           */
/* ------------------------------------------------------------------ */

export function missionStatusIntent(status: MissionStatusKey): Intent {
  switch (status) {
    case 'working':
      return 'primary';
    case 'blocked':
      return 'danger';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'neutral';
    case 'pending':
      return 'warning';
  }
}

export function missionStatusLabel(status: MissionStatusKey): string {
  switch (status) {
    case 'working':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'pending':
      return 'Pending';
  }
}

export function objectiveStatusIntent(status: ObjectiveStatus): Intent {
  switch (status) {
    case 'working':
      return 'primary';
    case 'blocked':
      return 'danger';
    case 'completed':
      return 'success';
    case 'pending':
      return 'warning';
  }
}

export function objectiveStatusLabel(status: ObjectiveStatus): string {
  switch (status) {
    case 'working':
      return 'Working';
    case 'blocked':
      return 'Blocked';
    case 'completed':
      return 'Completed';
    case 'pending':
      return 'Pending';
  }
}

export function dependencyIntent(status: MissionDependency['status']): Intent {
  switch (status) {
    case 'up':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'down':
      return 'danger';
  }
}

/** Collapse a raw Coordinator status string into a normalized UI key. */
export function normalizeMissionStatus(raw: string | null | undefined): MissionStatusKey {
  switch ((raw ?? '').toLowerCase()) {
    case 'in_progress':
    case 'in progress':
    case 'running':
    case 'active':
    case 'working':
      return 'working';
    case 'blocked':
    case 'failed':
      return 'blocked';
    case 'completed':
    case 'done':
    case 'success':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'canceled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/** Map a priority string to an intent for visual weight. */
export function priorityIntent(priority: string | null | undefined): Intent {
  switch ((priority ?? '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'danger';
    case 'medium':
    case 'normal':
      return 'warning';
    case 'low':
      return 'neutral';
    default:
      return 'neutral';
  }
}
