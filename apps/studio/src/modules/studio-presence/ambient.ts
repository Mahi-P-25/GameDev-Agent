import type { PresenceStatus } from './PresenceEvents';
import type { PresenceSnapshot } from './PresenceStore';

/**
 * Nova Ambient Presence — derived intelligence from real studio state.
 *
 * Everything here is computed from the live {@link PresenceSnapshot} (activity
 * timestamps, module statuses, pending approvals). Nothing is synthesized or
 * predicted by an AI; this is deterministic projection that makes the studio
 * feel like it has been working alongside the Director — answering "what would a
 * calm, attentive partner surface right now?" with the minimum signal.
 */

export interface AmbientSuggestion {
  readonly label: string;
  /** Where the suggestion should take the Director. */
  readonly to: string;
}

/**
 * The single, most useful next action for the Director right now — derived from
 * real state, prioritized by what unblocks the studio fastest.
 */
export function deriveSuggestion(snapshot: PresenceSnapshot): AmbientSuggestion | null {
  if (snapshot.pendingApprovals > 0) {
    return { label: `Review ${snapshot.pendingApprovals} mission awaiting sign-off`, to: '/inbox' };
  }
  if (snapshot.workflowRunning) {
    return { label: 'Watch the running workflow', to: '/workflows' };
  }
  if (snapshot.missionTitle === null) {
    return { label: 'Set a direction for the studio', to: '/mission-control' };
  }
  if (snapshot.capabilitiesUnhealthy > 0) {
    return { label: 'Check a capability that went down', to: '/workflows' };
  }
  return null;
}

/**
 * How long the Director has been away from the studio, measured from the most
 * recent real activity event. Returns null when the studio has no signal yet
 * (e.g. onboarding) so we never invent an absence.
 */
export function deriveAwayFor(snapshot: PresenceSnapshot, now = Date.now()): number | null {
  const last = snapshot.lastActivity?.timestamp;
  if (last === undefined || last === null) return null;
  const away = now - last;
  // Ignore sub-minute gaps — that is not "being away."
  if (away < 60_000) return null;
  return away;
}

export function formatAway(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** The studio's ambient mode — drives lighting, contrast, and emphasis. */
export type StudioMode = 'building' | 'reviewing' | 'planning' | 'waiting' | 'blocked' | 'idle';

/**
 * Derive the studio's current mode from real state. Each mode is a truthful
 * reading of what the studio is actually doing — never decorative.
 *
 *   reviewing  — a human decision is pending (approvals gate the studio)
 *   building   — a workflow is actively running (construction in progress)
 *   planning   — a goal is in flight but nothing is executing yet (direction)
 *   blocked    — a capability or module cannot proceed
 *   waiting    — signal exists but the studio is between actions
 *   idle       — calm, nothing in flight
 */
export function studioMood(snapshot: PresenceSnapshot, overall: PresenceStatus): StudioMode {
  if (snapshot.pendingApprovals > 0) return 'reviewing';
  if (snapshot.workflowRunning) return 'building';
  if (overall === 'blocked' || snapshot.capabilitiesUnhealthy > 0) return 'blocked';
  if (overall === 'working') return 'planning';
  if (overall === 'waiting') return 'waiting';
  if (snapshot.goalInFlight) return 'planning';
  return 'idle';
}
