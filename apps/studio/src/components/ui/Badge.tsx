import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';
import { type Intent, badgeVariants } from '../../design/variants';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly intent?: Intent;
  readonly size?: 'sm' | 'md';
  readonly dot?: boolean;
}

/** Badge — a compact status/label pill carrying semantic intent. */
export function Badge({
  className,
  intent = 'neutral',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps): ReactNode {
  return (
    <span className={cn(badgeVariants({ intent, size }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}
