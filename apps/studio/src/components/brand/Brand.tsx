import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../design/cn';

/**
 * Nova Brand System — the visual signature of the studio operating system.
 *
 * Identity is expressed through a small, consistent set of elements — not a logo
 * alone, but a language:
 *   - `NovaMark`   — the studio lens: a precise aperture/orbit monogram. One flat
 *                    color, no gradient, no glow. It reads as "a tool for making,"
 *                    not an AI chat bubble.
 *   - `NovaWordmark` — "Nova" in the display serif + a tracked "STUDIO" eyebrow.
 *   - Signature accent — a single 1px gold rule (`--color-accent`) under the
 *                    active context. One gold moment per screen = the "you are
 *                    here" cue. See `.nova-signature-rule` in brand.css.
 *   - Signature interaction — `focus-ring` + the calm hover-lift already in the
 *                    system; no bespoke flourish.
 *
 * Everything resolves from the existing design tokens. No new color values.
 */

export type MarkSize = 'sm' | 'md' | 'lg';

const MARK_BOX: Record<MarkSize, number> = { sm: 22, md: 28, lg: 40 };

/**
 * The Nova mark — a concentric aperture suggesting a lens, an orbit, and the
 * "N" stroke folded into a single calm gesture. Drawn as flat strokes that
 * inherit `currentColor`, so it takes the surrounding intent color.
 */
export function NovaMark({
  size = 'md',
  className,
  title = 'Nova',
}: {
  readonly size?: MarkSize;
  readonly className?: string;
  readonly title?: string;
}): ReactNode {
  const box = MARK_BOX[size];
  return (
    <svg
      viewBox="0 0 32 32"
      width={box}
      height={box}
      fill="none"
      role="img"
      aria-label={title}
      className={cn('nova-mark', className)}
    >
      {/* outer orbit */}
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      {/* inner aperture ring */}
      <circle cx="16" cy="16" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      {/* the N stroke, folded into the aperture center */}
      <path
        d="M12 21V11l8 10V11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface NovaWordmarkProps {
  readonly size?: MarkSize;
  readonly className?: string;
  /** Show the "STUDIO" eyebrow beneath the wordmark. */
  readonly withEyebrow?: boolean;
  /** Render the mark before the wordmark. */
  readonly withMark?: boolean;
  readonly style?: CSSProperties;
}

/**
 * The Nova wordmark. "Nova" set in the display serif (Instrument Serif); a
 * tracked, uppercase "STUDIO" eyebrow carries the product line. Quiet,
 * confident — never a loud logotype.
 */
export function NovaWordmark({
  size = 'md',
  className,
  withEyebrow = false,
  withMark = true,
  style,
}: NovaWordmarkProps): ReactNode {
  const wordSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  const eyebrowSize = size === 'lg' ? 'text-[10px]' : 'text-[9px]';
  return (
    <span className={cn('nova-wordmark inline-flex items-center gap-2.5', className)} style={style}>
      {withMark && (
        <span className="text-fg">
          <NovaMark size={size} />
        </span>
      )}
      <span className="flex flex-col leading-none">
        <span className={cn('font-display font-normal tracking-tight text-fg', wordSize)}>
          Nova
        </span>
        {withEyebrow && (
          <span
            className={cn(
              'mt-1 font-headline font-semibold uppercase tracking-[0.22em] text-fg-subtle',
              eyebrowSize,
            )}
          >
            Studio
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * The signature accent rule — the single gold moment on a screen. Place it under
 * the active hero/context to anchor "you are here." One per screen, by policy.
 */
export function SignatureRule({ className }: { readonly className?: string }): ReactNode {
  return <span className={cn('nova-signature-rule', className)} aria-hidden />;
}
