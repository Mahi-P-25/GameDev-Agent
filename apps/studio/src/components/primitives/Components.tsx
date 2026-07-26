import { Slot } from '@radix-ui/react-slot';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';
import { buttonVariants } from '../../design/variants';
import { Icon, type LucideIconName } from '../ui/Icon';

/**
 * Nova Component Primitives (Sprint 11).
 *
 * Glass + interactive building blocks layered on the existing Button/Badge/
 * Card system. Every component references tokens via `cn` / `variants` and the
 * `glass*` / `glow*` utility classes from effects.css. No magic numbers.
 */

// ---------------------------------------------------------------------------
// GlassCard — translucent elevated surface.
// ---------------------------------------------------------------------------
export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly strong?: boolean;
  readonly glow?: 'none' | 'accent' | 'primary' | 'soft';
  readonly interactive?: boolean;
  readonly noise?: boolean;
}

const GLOW: Record<NonNullable<GlassCardProps['glow']>, string> = {
  none: '',
  accent: 'glow-accent',
  primary: 'glow-primary',
  soft: 'glow-soft',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  {
    className,
    children,
    strong = false,
    glow = 'none',
    interactive = false,
    noise = false,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        strong ? 'glass-strong' : 'glass-card',
        noise && 'noise',
        GLOW[glow],
        interactive && 'hover-lift cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

// ---------------------------------------------------------------------------
// IconButton — square icon-only button.
// ---------------------------------------------------------------------------
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon: LucideIconName;
  readonly label: string;
  readonly variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'outline';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly asChild?: boolean;
}

const ICON_SIZE: Record<NonNullable<IconButtonProps['size']>, number> = { sm: 16, md: 18, lg: 20 };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', className, asChild, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant, size }), 'rounded-full', className)}
      {...props}
    >
      <Icon name={icon} size={ICON_SIZE[size]} />
    </Comp>
  );
});

// ---------------------------------------------------------------------------
// Chip — compact glass pill with optional icon / dot.
// ---------------------------------------------------------------------------
export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  readonly children: ReactNode;
  readonly icon?: LucideIconName;
  readonly active?: boolean;
}

export function Chip({
  className,
  children,
  icon,
  active = false,
  ...props
}: ChipProps): ReactNode {
  return (
    <span
      className={cn(
        'glass-pill text-xs font-medium',
        active ? 'glow-ring text-fg' : 'text-fg-muted',
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Input — themed text field.
// ---------------------------------------------------------------------------
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border bg-bg-inset px-3 text-sm text-fg',
        'placeholder:text-fg-subtle transition-smooth',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        invalid ? 'border-danger/60' : 'border-border focus:border-primary/60',
        className,
      )}
      {...props}
    />
  );
});

// ---------------------------------------------------------------------------
// Divider — hairline separator.
// ---------------------------------------------------------------------------
export function Divider({ className }: { className?: string }): ReactNode {
  return <div className={cn('h-px w-full bg-border', className)} role="separator" />;
}

// ---------------------------------------------------------------------------
// Avatar — circular identity token (initials or image).
// ---------------------------------------------------------------------------
export interface AvatarProps {
  readonly name: string;
  readonly src?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const AVATAR_SIZE = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' };

export function Avatar({ name, src, size = 'md', className }: AvatarProps): ReactNode {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn(
        'inline-grid place-items-center overflow-hidden rounded-full border border-border-strong',
        'bg-bg-hover font-semibold text-fg-muted select-none',
        AVATAR_SIZE[size],
        className,
      )}
      title={name}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat — metric + label readout.
// ---------------------------------------------------------------------------
export interface StatProps {
  readonly value: ReactNode;
  readonly label: string;
  readonly hint?: string;
  readonly className?: string;
}

export function Stat({ value, label, hint, className }: StatProps): ReactNode {
  return (
    <div className={cn('nova-stat', className)}>
      <span className="text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</span>
      <span className="text-xs text-fg-subtle">{label}</span>
      {hint && <span className="text-2xs text-fg-subtle/80">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingSkeleton — shimmering placeholder block.
// ---------------------------------------------------------------------------
export function LoadingSkeleton({ className }: { className?: string }): ReactNode {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-bg-hover',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-shimmer before:bg-gradient-to-r',
        'before:from-transparent before:via-white/5 before:to-transparent',
        className,
      )}
      aria-hidden
    />
  );
}
