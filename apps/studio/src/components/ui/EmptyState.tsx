import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

/**
 * EmptyState — the "nothing here yet" surface. Calm, centered, with an optional
 * icon and a single primary action. Never an error state; use it to invite the
 * next action (e.g. "Create your first project").
 */
export function EmptyState({ icon, title, hint, action, className }: EmptyStateProps): ReactNode {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon !== undefined && (
        <div className="grid size-12 place-items-center rounded-xl border border-border bg-bg-inset text-fg-subtle">
          {icon}
        </div>
      )}
      <div className="text-[15px] font-semibold text-fg">{title}</div>
      {hint !== undefined && <p className="max-w-sm text-[13px] text-fg-subtle">{hint}</p>}
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  );
}
