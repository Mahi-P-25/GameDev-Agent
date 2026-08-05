import { Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, Sparkles, Terminal } from 'lucide-react';
import { cn } from '../../design/cn';

export type ExecutionStatus =
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'running'
  | 'success'
  | 'warning'
  | 'cancelled'
  | 'pending';

interface ExecutionStatusBadgeProps {
  readonly status: ExecutionStatus;
  readonly className?: string;
  readonly labelOverride?: string;
}

export function ExecutionStatusBadge({ status, className, labelOverride }: ExecutionStatusBadgeProps): React.ReactNode {
  switch (status) {
    case 'planning':
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent shadow-sm', className)}>
          <Sparkles className="size-3 text-accent animate-pulse" />
          <span>{labelOverride || 'Planning Goal…'}</span>
        </span>
      );

    case 'executing':
    case 'running':
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent shadow-sm', className)}>
          <Loader2 className="size-3 text-accent animate-spin" />
          <span>{labelOverride || 'Executing Mission…'}</span>
        </span>
      );

    case 'verifying':
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-info/40 bg-info/15 px-2.5 py-0.5 text-[11px] font-medium text-info shadow-sm', className)}>
          <Terminal className="size-3 text-info animate-pulse" />
          <span>{labelOverride || 'Verifying Build…'}</span>
        </span>
      );

    case 'completed':
    case 'success':
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success shadow-sm', className)}>
          <CheckCircle2 className="size-3 text-success" />
          <span>{labelOverride || 'Completed'}</span>
        </span>
      );

    case 'warning':
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-0.5 text-[11px] font-medium text-warning shadow-sm', className)}>
          <AlertTriangle className="size-3 text-warning" />
          <span>{labelOverride || 'Warning'}</span>
        </span>
      );

    case 'failed':
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/15 px-2.5 py-0.5 text-[11px] font-medium text-danger shadow-sm', className)}>
          <XCircle className="size-3 text-danger" />
          <span>{labelOverride || 'Failed'}</span>
        </span>
      );

    case 'cancelled':
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-fg-subtle/30 bg-fg-subtle/15 px-2.5 py-0.5 text-[11px] font-medium text-fg-subtle shadow-sm', className)}>
          <Clock className="size-3 text-fg-subtle" />
          <span>{labelOverride || 'Cancelled'}</span>
        </span>
      );

    case 'pending':
    default:
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-surface px-2.5 py-0.5 text-[11px] font-medium text-fg-subtle shadow-sm', className)}>
          <span className="size-1.5 rounded-full bg-fg-subtle/60" />
          <span>{labelOverride || 'Pending'}</span>
        </span>
      );
  }
}
