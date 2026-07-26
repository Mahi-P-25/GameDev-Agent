import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import type { Intent } from '../../design/variants';

export interface ProgressProps {
  readonly value: number;
  readonly intent?: Intent;
  readonly className?: string;
  readonly size?: 'sm' | 'md';
  readonly label?: string;
}

const INTENT_BAR: Record<Intent, string> = {
  neutral: 'bg-fg-muted',
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Progress — a determinate bar (0–100). Animates width on change. */
export function Progress({
  value,
  intent = 'primary',
  className,
  size = 'md',
  label,
}: ProgressProps): ReactNode {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      tabIndex={-1}
      className={cn(
        'w-full overflow-hidden rounded-full bg-bg-hover',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-base ease-standard',
          INTENT_BAR[intent],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
