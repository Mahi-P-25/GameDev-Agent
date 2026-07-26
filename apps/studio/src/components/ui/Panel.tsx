import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Optional sticky header row. */
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
}

/**
 * Panel — a structural region inside a layout (sidebar section, dock, inspector).
 * Lighter than a Card: no elevation by default, used to group related content.
 */
export function Panel({ className, header, footer, children, ...props }: PanelProps): ReactNode {
  return (
    <section className={cn('flex min-h-0 flex-col', className)} {...props}>
      {header !== undefined && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          {header}
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
      {footer !== undefined && (
        <div className="border-t border-border px-4 py-2.5 text-xs text-fg-subtle">{footer}</div>
      )}
    </section>
  );
}
