import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

export interface LoadingProps {
  readonly label?: string;
  readonly className?: string;
}

/** Loading — inline spinner with a label. For regions fetching/mutating. */
export function Loading({ label = 'Loading…', className }: LoadingProps): ReactNode {
  return (
    <div className={cn('flex items-center gap-2.5 p-5 text-fg-muted', className)}>
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

export interface SkeletonProps {
  readonly className?: string;
  readonly rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const RADII = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const;

/**
 * Skeleton — a shimmering placeholder that mirrors the shape of upcoming
 * content. Use to avoid layout shift while loading; never as a final state.
 */
export function Skeleton({ className, rounded = 'md' }: SkeletonProps): ReactNode {
  return <div aria-hidden className={cn('animate-pulse bg-bg-hover', RADII[rounded], className)} />;
}
