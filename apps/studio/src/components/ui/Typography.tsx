import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';

/**
 * Nova Typography — the reusable type scale.
 *
 * Every text node in the product should flow through one of these roles so
 * sizing, weight, and tracking never drift. Sizes map to the `--text-*` tokens
 * in tokens-extended.css. Do NOT hardcode font-size elsewhere.
 */

type AsProp = { readonly as?: ElementType };

export interface TypographyProps extends HTMLAttributes<HTMLElement>, AsProp {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Display — expressive serif for hero moments. */
export const Display = forwardRef<HTMLElement, TypographyProps>(function Display(
  { as: Tag = 'div', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn('font-display text-display leading-tight tracking-tight text-fg', className)}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Hero — oversized display for landing surfaces. */
export const HeroTitle = forwardRef<HTMLElement, TypographyProps>(function HeroTitle(
  { as: Tag = 'h1', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn('font-display text-hero leading-[0.95] tracking-tight text-fg', className)}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Headline — section / page titles (Manrope). */
export const Headline = forwardRef<HTMLElement, TypographyProps>(function Headline(
  { as: Tag = 'h2', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn(
        'font-headline text-2xl font-semibold leading-snug tracking-snug text-fg',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Section — subsection heading. */
export const SectionTitle = forwardRef<HTMLElement, TypographyProps>(function SectionTitle(
  { as: Tag = 'h3', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn(
        'font-headline text-lg font-semibold leading-snug tracking-snug text-fg',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Body — default reading text. */
export const Body = forwardRef<HTMLElement, TypographyProps>(function Body(
  { as: Tag = 'p', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn('font-body text-base leading-normal text-fg-muted', className)}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Caption — small supporting text. */
export const Caption = forwardRef<HTMLElement, TypographyProps>(function Caption(
  { as: Tag = 'span', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn('font-body text-xs leading-snug text-fg-subtle', className)}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Eyebrow — uppercase label above a title. */
export const Eyebrow = forwardRef<HTMLElement, TypographyProps>(function Eyebrow(
  { as: Tag = 'span', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn(
        'font-headline text-2xs font-semibold uppercase tracking-wider text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Metric — large numeric readout. */
export const Metric = forwardRef<HTMLElement, TypographyProps>(function Metric(
  { as: Tag = 'span', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn(
        'font-headline text-3xl font-semibold leading-tight tracking-tight tabular-nums text-fg',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
});

/** Code — monospace inline/block. */
export const Code = forwardRef<HTMLElement, TypographyProps>(function Code(
  { as: Tag = 'code', className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={cn('font-mono text-sm leading-normal text-fg', className)}
      {...props}
    >
      {children}
    </Tag>
  );
});
