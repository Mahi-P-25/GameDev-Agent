import { AlertTriangle, CheckCircle2, Info, type LucideIcon, X, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import { type Toast, type ToastIntent, useToastStore } from './toastStore';

const ICON: Record<ToastIntent, LucideIcon> = {
  neutral: Info,
  info: Info,
  primary: Info,
  accent: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const ACCENT: Record<ToastIntent, string> = {
  neutral: 'text-fg-muted',
  info: 'text-info',
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function ToastCard({ t }: { readonly t: Toast }): ReactNode {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICON[t.intent ?? 'neutral'];
  const duration = t.duration ?? 4200;

  useEffect(() => {
    const id = window.setTimeout(() => dismiss(t.id), duration);
    return () => window.clearTimeout(id);
  }, [t.id, duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-md border border-border-strong bg-bg-elevated p-3.5 shadow-lg"
      aria-live="polite"
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', ACCENT[t.intent ?? 'neutral'])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-fg">{t.title}</div>
        {t.description !== undefined && (
          <div className="mt-0.5 text-xs text-fg-subtle">{t.description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
        className="rounded p-0.5 text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

/**
 * ToastViewport — fixed bottom-right stack of active toasts. Mount once near
 * the app root. Animations respect reduced motion via Motion's global handling.
 */
export function ToastViewport(): ReactNode {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastCard key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
