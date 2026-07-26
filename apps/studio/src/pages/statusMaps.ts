import type { RoleStatus } from '../adapters/types';
import type { Intent } from '../components/ui/primitives';

/** Map a Studio API status string to a UI intent + label. */
export function missionStatusIntent(status: string): Intent {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'danger';
    case 'execution-started':
    case 'reviewing':
    case 'approved':
    case 'ready':
      return 'info';
    case 'approval-requested':
    case 'analysing':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function projectStatusIntent(status: string): Intent {
  switch (status) {
    case 'open':
      return 'success';
    case 'closed':
      return 'neutral';
    case 'archived':
      return 'neutral';
    case 'active':
      return 'info';
    default:
      return 'neutral';
  }
}

export function missionStatusLabel(status: string): string {
  return status
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Map a {@link RoleStatus} to a UI intent + human label for the Studio Team. */
export function roleStatusIntent(status: RoleStatus): Intent {
  switch (status) {
    case 'working':
      return 'primary';
    case 'planning':
      return 'info';
    case 'ready':
      return 'success';
    case 'waiting':
      return 'warning';
    case 'blocked':
      return 'danger';
    case 'offline':
      return 'neutral';
  }
}

export function roleStatusLabel(status: RoleStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Map a Development Workflow run state to a UI intent. */
export function workflowRunIntent(state: string): Intent {
  switch (state) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'danger';
    case 'running':
      return 'info';
    case 'planned':
    case 'created':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Map a Development Workflow run state to a human label. */
export function workflowRunLabel(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

/** Map a Development Workflow step state to a UI intent. */
export function workflowStepIntent(state: string): Intent {
  switch (state) {
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'danger';
    case 'running':
      return 'info';
    case 'skipped':
      return 'neutral';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Short label for a Development Workflow template kind. */
export function workflowKindLabel(kind: string): string {
  switch (kind) {
    case 'validate-project':
      return 'Validate Project';
    case 'inspect-project':
      return 'Inspect Project';
    case 'open-workspace':
      return 'Open Workspace';
    default:
      return kind;
  }
}
