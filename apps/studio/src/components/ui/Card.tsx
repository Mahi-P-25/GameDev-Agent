import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';
import { cardVariants } from '../../design/variants';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly interactive?: boolean;
  readonly inset?: boolean;
  readonly padded?: boolean;
}

/**
 * Card — the primary elevated surface in Nova. A bordered, radius-lg panel with
 * an optional header (title/subtitle/actions) and content region.
 */
export function Card({
  className,
  title,
  subtitle,
  actions,
  interactive = false,
  inset = false,
  padded = true,
  children,
  ...props
}: CardProps): ReactNode {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <section className={cn(cardVariants({ interactive, inset }), className)} {...props}>
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {title !== undefined && (
              <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
            )}
            {subtitle !== undefined && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
          </div>
          {actions !== undefined && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={cn(padded ? 'p-5' : 'p-0')}>{children}</div>
    </section>
  );
}
