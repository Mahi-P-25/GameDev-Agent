import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';

export interface QuickActionChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon?: ReactNode;
  readonly label: string;
}

export function QuickActionChip({
  icon,
  label,
  className,
  ...props
}: QuickActionChipProps): ReactNode {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-panel px-3 py-1.5',
        'text-xs text-fg-muted hover:text-fg hover:border-border-strong hover:bg-bg-hover',
        'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        className,
      )}
      {...props}
    >
      {icon && <span className="size-3.5 text-accent">{icon}</span>}
      {label}
    </button>
  );
}
