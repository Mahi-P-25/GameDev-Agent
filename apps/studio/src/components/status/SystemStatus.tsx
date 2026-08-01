import type { ReactNode } from 'react';
import { StatusChip } from '../ui/StatusChip';

export interface SystemStatusProps {
  readonly ready?: boolean;
  readonly capabilityCount?: number;
  readonly className?: string;
  /** Collapsed to a single dot — for icon rails and corner strips. */
  readonly compact?: boolean;
}

/**
 * SystemStatus — the quiet, glanceable corner strip. Smallest footprint in the
 * visual hierarchy: a dot, a short line, nothing more. Never competes with the
 * hero or command bar.
 */
export function SystemStatus({
  ready = true,
  capabilityCount = 6,
  className,
  compact = false,
}: SystemStatusProps): ReactNode {
  if (compact) {
    return (
      <span title={ready ? 'Systems ready' : 'Connecting'} className={className}>
        <StatusChip
          intent={ready ? 'success' : 'warning'}
          pulse={ready}
          label=""
          title={ready ? 'Systems ready' : 'Connecting'}
          className="text-fg-subtle"
        />
      </span>
    );
  }
  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-[11px]">
        <StatusChip
          intent={ready ? 'success' : 'warning'}
          pulse={ready}
          label={ready ? 'Systems ready' : 'Connecting'}
          className="text-fg-subtle"
        />
        <span className="text-fg-subtle">·</span>
        <span className="text-fg-subtle">{capabilityCount} capabilities online</span>
      </div>
    </div>
  );
}
