import { cn } from '../../design/cn';
import type { buttonVariants } from '../../design/variants';
import { SignatureRule } from '../brand';
import { useAmbientParallax } from './useAmbientParallax';

/**
 * Nova Layout Primitives — composable structural building blocks.
 *
 * Framework-agnostic presentational primitives used by every future Nova
 * screen. They carry no business logic and reference only design tokens.
 */

// ---------------------------------------------------------------------------
// Container — centered, max-width content rail.
// ---------------------------------------------------------------------------
export function Container({
  className,
  children,
  as: Tag = 'div',
}: {
  className?: string;
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return (
    <Tag className={cn('mx-auto w-full max-w-[1320px] px-5 md:px-8', className)}>{children}</Tag>
  );
}

// ---------------------------------------------------------------------------
// Section — vertical rhythm block.
// ---------------------------------------------------------------------------
export function Section({
  className,
  children,
  as: Tag = 'section',
}: {
  className?: string;
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return <Tag className={cn('py-8 md:py-12', className)}>{children}</Tag>;
}

// ---------------------------------------------------------------------------
// Stack — flex column / row with consistent gap scale.
// ---------------------------------------------------------------------------
export type StackProps = {
  className?: string;
  children: React.ReactNode;
  /** Gap token: 1=4px … 8=32px. */
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  direction?: 'row' | 'col';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
};

const GAP: Record<NonNullable<StackProps['gap']>, string> = {
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  7: 'gap-7',
  8: 'gap-8',
};
const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};
const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

export function Stack({
  className,
  children,
  gap = 4,
  direction = 'col',
  align = 'stretch',
  justify = 'start',
}: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'col' ? 'flex-col' : 'flex-row',
        GAP[gap],
        ALIGN[align],
        JUSTIFY[justify],
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid — responsive auto grid.
// ---------------------------------------------------------------------------
export function Grid({
  className,
  children,
  /** Minimum column width before wrapping. */
  min = 240,
  gap = 5,
}: {
  className?: string;
  children: React.ReactNode;
  min?: number;
  gap?: 4 | 5 | 6 | 8;
}) {
  const gapClass = { 4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8' }[gap];
  return (
    <div
      className={cn('grid', gapClass, className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface — themed elevated panel (replaces ad-hoc bg-border stacks).
// ---------------------------------------------------------------------------
export function Surface({
  className,
  children,
  padded = true,
  interactive = false,
}: {
  className?: string;
  children: React.ReactNode;
  padded?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-panel text-fg shadow-sm',
        padded && 'p-5',
        interactive && 'hover-lift cursor-pointer hover:border-border-strong',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dock — floating glass bar (bottom or side), used for command/palette rails.
// ---------------------------------------------------------------------------
export function Dock({
  className,
  children,
  position = 'bottom',
}: {
  className?: string;
  children: React.ReactNode;
  position?: 'bottom' | 'top' | 'left' | 'right';
}) {
  const pos = {
    bottom: 'fixed inset-x-0 bottom-4 flex justify-center',
    top: 'fixed inset-x-0 top-4 flex justify-center',
    left: 'fixed inset-y-0 left-4 flex items-center',
    right: 'fixed inset-y-0 right-4 flex items-center',
  }[position];
  return (
    <div className={cn(pos, 'pointer-events-none z-40', className)}>
      <div className="glass-strong pointer-events-auto flex items-center gap-1 rounded-full px-2 py-1.5">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CinematicHero — full-bleed cinematic intro region with ambient background.
// Reserved for genuine landing/onboarding moments only.
// ---------------------------------------------------------------------------
export function CinematicHero({
  className,
  children,
  withAurora = true,
}: {
  className?: string;
  children: React.ReactNode;
  withAurora?: boolean;
}) {
  return (
    <div className={cn('bg-aurora relative overflow-hidden', className)}>
      {withAurora && <div className="gradient-overlay absolute inset-0" aria-hidden />}
      <div className="vignette-soft relative">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell — page transition wrapper for route content.
// ---------------------------------------------------------------------------
export function Shell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('selection-accent min-h-full', className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// OpeningStage — the studio canvas. The "room" you enter on boot: a near-black
// field with a single quiet top vignette so the first viewport reads as
// entering a space, not opening a window. Used by the OS opening scene (Home).
// ---------------------------------------------------------------------------
export function OpeningStage({
  className,
  children,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  // Single, subtle parallax on the ambient layer only — depth, not motion.
  const parallax = useAmbientParallax();
  return (
    <div className={cn('nova-stage nova-hero-pad', className)} {...rest}>
      <div className="nova-ambient-layer" style={parallax} aria-hidden />
      <div className="plane-workspace relative">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — the dominant, single focus of a screen. One hero per screen, by
// policy. Occupies the first viewport; everything else is supporting context.
// ---------------------------------------------------------------------------
export function Hero({
  className,
  children,
  withSignature = true,
  signatureLive = false,
}: {
  className?: string;
  children: React.ReactNode;
  /** Render the signature gold rule beneath the hero. Default true. */
  withSignature?: boolean;
  /** When true the gold rule gently widens to acknowledge live studio state. */
  signatureLive?: boolean;
}) {
  return (
    <section className={cn('relative', className)}>
      <div className="nova-rhythm-y">{children}</div>
      {withSignature && (
        <SignatureRule className={cn('mt-5', signatureLive && 'nova-signature-rule--live')} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ContextStrip — supporting panels beneath the hero. Muted, quiet, never
// competing with the hero. Renders 2–3 equal panels.
// ---------------------------------------------------------------------------
export function ContextStrip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('grid gap-4 md:grid-cols-3', className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// ContextPanel — a single quiet supporting panel inside a ContextStrip.
// ---------------------------------------------------------------------------
export function ContextPanel({
  className,
  children,
  title,
  action,
}: {
  className?: string;
  children: React.ReactNode;
  title?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn('matte rounded-xl p-5 text-fg', className)}>
      {(title !== undefined || action !== undefined) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title !== undefined && (
            <span className="font-headline text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
              {title}
            </span>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuietList — a single-column, low-emphasis feed (activity, log, history).
// ---------------------------------------------------------------------------
export function QuietList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('divide-y divide-border', className)}>{children}</div>;
}

// re-export for convenience
export { NovaMark, NovaWordmark } from '../brand';
export type { buttonVariants };
