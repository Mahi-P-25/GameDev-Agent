import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import type { Intent } from '../../design/variants';

const INTENT_BG: Record<Intent, string> = {
  neutral: 'bg-fg-subtle',
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export interface StatusIndicatorProps {
  readonly intent?: Intent;
  readonly pulse?: boolean;
  readonly title?: string;
  readonly className?: string;
}

/**
 * StatusIndicator — a small colored dot. `pulse` adds a soft halo for
 * live/active states (e.g. "studio ready"). Purely decorative; pass `title`
 * for an accessible label.
 */
export function StatusIndicator({
  intent = 'neutral',
  pulse = false,
  title,
  className,
}: StatusIndicatorProps): ReactNode {
  return (
    <span
      title={title}
      role={title !== undefined ? 'img' : undefined}
      aria-label={title}
      className={cn('relative inline-flex size-2', className)}
    >
      <span className={cn('size-2 rounded-full', INTENT_BG[intent])} />
      {pulse && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping',
            INTENT_BG[intent],
          )}
          style={{ animationDuration: '1.6s' }}
        />
      )}
    </span>
  );
}
