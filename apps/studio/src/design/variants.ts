import { cva } from 'class-variance-authority';

/**
 * Nova component variants — the visual vocabulary of the design system.
 * Built with `class-variance-authority` so every component shares one source of
 * truth for its looks. Colors reference the `@theme` tokens published in
 * tokens.css, so they re-theme from a single place.
 */

/** Intent = semantic color role used by Badge, StatusDot, Progress, Button. */
export type Intent = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/** Button — the primary action primitive. */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 select-none',
    'font-medium whitespace-nowrap rounded-md',
    'transition-[background,border-color,color,box-shadow,transform] duration-fast ease-standard',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
    'disabled:opacity-50 disabled:pointer-events-none active:translate-y-px',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white border border-primary hover:bg-primary-strong shadow-sm',
        accent:
          'bg-accent text-bg-base border border-accent hover:bg-accent-strong shadow-sm shadow-accent/20',
        secondary:
          'bg-bg-hover text-fg border border-border hover:bg-bg-active hover:border-border-strong',
        ghost:
          'bg-transparent text-fg-muted border border-transparent hover:bg-bg-hover hover:text-fg',
        danger: 'bg-danger-soft text-danger border border-danger/40 hover:bg-danger/20',
        outline:
          'bg-transparent text-fg border border-border-strong hover:border-accent hover:text-accent',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-[13px]',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

/** Badge — compact status/label pill. */
export const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 rounded-full font-medium leading-none',
    'border whitespace-nowrap',
  ],
  {
    variants: {
      intent: {
        neutral: 'text-fg-muted bg-bg-hover border-border',
        primary: 'text-primary bg-primary-soft border-primary/30',
        accent: 'text-accent bg-accent-soft border-border-accent',
        success: 'text-success bg-success-soft border-success/30',
        warning: 'text-warning bg-warning-soft border-warning/30',
        danger: 'text-danger bg-danger-soft border-danger/30',
        info: 'text-info bg-info-soft border-info/30',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2 py-1 text-xs',
      },
    },
    defaultVariants: { intent: 'neutral', size: 'md' },
  },
);

/** Card — the primary elevated surface. Hairline border, soft diffuse shadow. */
export const cardVariants = cva(
  [
    'rounded-lg border border-border bg-bg-panel text-fg shadow-sm',
    'transition-[border-color,box-shadow,transform] duration-base ease-standard',
  ],
  {
    variants: {
      interactive: {
        true: 'cursor-pointer hover:border-border-strong hover:shadow-md hover:-translate-y-0.5',
        false: '',
      },
      inset: {
        true: 'bg-bg-inset border-border shadow-none',
        false: '',
      },
    },
    defaultVariants: { interactive: false, inset: false },
  },
);

/** Surface elevation helper for panels/modals. */
export const elevationVariants = cva('', {
  variants: {
    level: {
      none: 'shadow-none',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
    },
  },
  defaultVariants: { level: 'sm' },
});
