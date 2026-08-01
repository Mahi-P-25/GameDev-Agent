import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import type { Intent } from '../../design/variants';
import { StatusIndicator } from './StatusIndicator';

export interface StatusChipProps {
  readonly label: ReactNode;
  readonly intent?: Intent;
  readonly pulse?: boolean;
  readonly className?: string;
  readonly title?: string;
}

/**
 * StatusChip — a compact dot + label readout. Used for status lines and live
 * states where a full Badge would be too loud. Quiet by default: a small dot,
 * tertiary text, no background fill.
 */
export function StatusChip({
  label,
  intent = 'neutral',
  pulse = false,
  className,
  title,
}: StatusChipProps): ReactNode {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium leading-none text-fg-muted',
        className,
      )}
    >
      <StatusIndicator intent={intent} pulse={pulse} />
      <span>{label}</span>
    </span>
  );
}
