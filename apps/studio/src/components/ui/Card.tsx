import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';
import { cardVariants } from '../../design/variants';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
  readonly interactive?: boolean;
  readonly inset?: boolean;
  readonly padded?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
}

/**
 * Card — the single elevated surface primitive for Nova. A hairline-bordered,
 * radius-lg panel with an optional header row (title / subtitle / actions),
 * a padded body, and an optional footer action. Every piece of content sits on
 * the token padding scale — never flush against an edge.
 *
 * Lower-hierarchy cards pass `size="sm"`: same surface, quieter scale, so the
 * eye lands on the hero and command bar first.
 */
export function Card({
  className,
  title,
  subtitle,
  actions,
  footer,
  interactive = false,
  inset = false,
  padded = true,
  size = 'md',
  children,
  ...props
}: CardProps): ReactNode {
  const hasHeader = title !== undefined || actions !== undefined;
  const padding = size === 'sm' ? 'p-4' : size === 'lg' ? 'p-6' : 'p-5';
  const headerPad = size === 'sm' ? 'px-4 py-3' : size === 'lg' ? 'px-6 py-4' : 'px-5 py-3.5';
  return (
    <section className={cn(cardVariants({ interactive, inset }), className)} {...props}>
      {hasHeader && (
        <header
          className={cn(
            'flex items-center justify-between gap-3 border-b border-border',
            headerPad,
          )}
        >
          <div className="min-w-0">
            {title !== undefined && (
              <h3
                className={cn(
                  'font-medium leading-tight text-fg',
                  size === 'sm' ? 'text-[13px]' : size === 'lg' ? 'text-[17px]' : 'text-[15px]',
                )}
              >
                {title}
              </h3>
            )}
            {subtitle !== undefined && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
          </div>
          {actions !== undefined && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={cn(padded ? padding : 'p-0')}>{children}</div>
      {footer !== undefined && (
        <div className={cn('border-t border-border', headerPad)}>{footer}</div>
      )}
    </section>
  );
}
