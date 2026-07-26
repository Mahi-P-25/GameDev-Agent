import type { Intent } from '../../components/ui/primitives';

/**
 * Studio Presence — the vocabulary of "what is the studio doing right now".
 *
 * These types are the contract between the presence store (which reads real
 * Nova state) and the presence cards (which only render). They are deliberately
 * small and stable so a future AI system can replace the *source* of a module's
 * status without the UI components changing — the cards consume
 * {@link ModulePresence}, never the subsystems directly.
 */

/** The six lifecycle states every studio module can report. */
export type PresenceStatus = 'idle' | 'working' | 'waiting' | 'completed' | 'blocked';

/** The fixed set of studio modules shown in Team Presence. */
export type ModuleId = 'producer' | 'planner' | 'workflow' | 'qa' | 'terminal' | 'git';

/** Live presence for a single studio module. */
export interface ModulePresence {
  readonly id: ModuleId;
  readonly name: string;
  /** A short, human description of what this module does. */
  readonly description: string;
  readonly status: PresenceStatus;
  /** Optional detail line (e.g. "3 missions", "2 capabilities"). */
  readonly detail?: string | undefined;
}

/** Map a presence status to its design-system intent (color role). */
export function presenceIntent(status: PresenceStatus): Intent {
  switch (status) {
    case 'working':
      return 'primary';
    case 'waiting':
      return 'warning';
    case 'completed':
      return 'success';
    case 'blocked':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Map a presence status to a human label. */
export function presenceLabel(status: PresenceStatus): string {
  switch (status) {
    case 'working':
      return 'Working';
    case 'waiting':
      return 'Waiting';
    case 'completed':
      return 'Completed';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Idle';
  }
}

/** Order modules are shown: the studio's production pipeline, left to right. */
export const MODULE_ORDER: ReadonlyArray<ModuleId> = [
  'producer',
  'planner',
  'workflow',
  'qa',
  'terminal',
  'git',
];

/** Stable display metadata for each module. */
export const MODULE_META: Readonly<Record<ModuleId, { name: string; description: string }>> = {
  producer: { name: 'Producer', description: 'Owns studio goals and direction' },
  planner: { name: 'Planner', description: 'Breaks goals into mission plans' },
  workflow: { name: 'Workflow', description: 'Runs development workflows' },
  qa: { name: 'QA', description: 'Validates quality and health' },
  terminal: { name: 'Terminal', description: 'Executes commands and scripts' },
  git: { name: 'Git', description: 'Tracks version control state' },
};

/**
 * A single normalized presence event, projected from the Studio activity feed.
 * The cards render these as "recent activity" and the store uses them to derive
 * liveness (e.g. a module is "working" if it recently emitted an event).
 */
export interface PresenceEvent {
  readonly id: string;
  readonly message: string;
  readonly timestamp: number;
  readonly kind: string;
}
