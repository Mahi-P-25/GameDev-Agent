import * as Lucide from 'lucide-react';
import { forwardRef } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '../../design/cn';

/** Every Lucide icon name is a valid key. */
export type LucideIconName = keyof typeof Lucide;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Lucide icon name (e.g. "Sparkles", "Command"). */
  readonly name: LucideIconName;
  /** Rendered size in px. Defaults to 18 to match the shell. */
  readonly size?: number;
  /** Stroke width — Nova uses 1.6 for a refined, calm line weight. */
  readonly strokeWidth?: number;
  /** Subtle hover spin/scale hint for interactive icons. */
  readonly interactive?: boolean;
  /** Optional animation: gentle pulse or hover lift. */
  readonly animate?: 'none' | 'pulse' | 'spin';
}

/**
 * Nova Icon — centralized wrapper over lucide-react.
 *
 * One control surface for stroke weight, size, and motion so every icon in the
 * product shares a consistent visual rhythm. Inherits `currentColor`.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  {
    name,
    size = 18,
    strokeWidth = 1.6,
    interactive = false,
    animate = 'none',
    className,
    ...props
  },
  ref,
) {
  const Glyph = Lucide[name] as ComponentType<SVGProps<SVGSVGElement>>;
  if (Glyph === undefined) {
    return null;
  }
  return (
    <Glyph
      ref={ref}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      className={cn(
        'shrink-0',
        interactive && 'transition-transform duration-fast ease-standard hover:scale-110',
        animate === 'pulse' && 'animate-pulse',
        animate === 'spin' && 'animate-spin',
        className,
      )}
      {...props}
    />
  );
});
