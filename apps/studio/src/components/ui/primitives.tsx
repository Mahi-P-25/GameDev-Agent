import type { CSSProperties, ReactNode } from 'react';

/** Visual intent used by badges, dots, and accents. */
export type Intent = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const INTENT_VAR: Record<Intent, string> = {
  neutral: 'var(--color-text-subtle)',
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  accent: 'var(--color-accent)',
};

export function intentColor(intent: Intent): string {
  return INTENT_VAR[intent];
}

export interface CardProps {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly padded?: boolean;
}

/** A bordered, elevated surface — the primary container primitive. */
export function Card({
  children,
  title,
  subtitle,
  actions,
  className,
  style,
  padded = true,
}: CardProps): ReactNode {
  return (
    <section
      className={`nova-card${className ? ` ${className}` : ''}`}
      style={{
        background: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      {(title !== undefined || actions !== undefined) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            {title !== undefined && <h3 style={{ fontSize: 15 }}>{title}</h3>}
            {subtitle !== undefined && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions}
        </header>
      )}
      <div style={{ padding: padded ? 'var(--space-5)' : 0 }}>{children}</div>
    </section>
  );
}

export interface BadgeProps {
  readonly children: ReactNode;
  readonly intent?: Intent;
  readonly dot?: boolean;
}

/** A small status/label pill. */
export function Badge({ children, intent = 'neutral', dot = false }: BadgeProps): ReactNode {
  const color = intentColor(intent);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

export interface StatusDotProps {
  readonly intent: Intent;
  readonly title?: string;
}

/** A small colored status indicator dot. */
export function StatusDot({ intent, title }: StatusDotProps): ReactNode {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 999,
        background: intentColor(intent),
        boxShadow: `0 0 0 3px color-mix(in srgb, ${intentColor(intent)} 20%, transparent)`,
      }}
    />
  );
}

export interface ProgressBarProps {
  readonly value: number;
  readonly intent?: Intent;
}

/** A thin, determinate progress bar (0–100). */
export function ProgressBar({ value, intent = 'primary' }: ProgressBarProps): ReactNode {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        height: 6,
        width: '100%',
        background: 'var(--color-bg-hover)',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          background: intentColor(intent),
          borderRadius: 999,
          transition: 'width 200ms ease',
        }}
      />
    </div>
  );
}

export function Tag({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        color: 'var(--color-text-muted)',
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border)',
      }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  readonly title: string;
  readonly hint?: string;
}): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 'var(--space-6)',
        color: 'var(--color-text-subtle)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 15, color: 'var(--color-text-muted)', fontWeight: 500 }}>{title}</div>
      {hint !== undefined && <div style={{ fontSize: 13 }}>{hint}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { readonly label?: string }): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 'var(--space-5)',
        color: 'var(--color-text-muted)',
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          border: '2px solid var(--color-border-strong)',
          borderTopColor: 'var(--color-primary)',
          display: 'inline-block',
        }}
      />
      {label}
    </div>
  );
}

/** A small badge marking data that comes from a placeholder adapter. */
export function PlaceholderBadge(): ReactNode {
  return (
    <span
      className="nova-badge"
      data-intent="warning"
      style={{ cursor: 'help' }}
      title="Preview data — backend subsystem not yet connected"
    >
      preview
    </span>
  );
}
