import { AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '../../design/cn';
import { Card } from '../ui/Card';

export type ActivityKind = 'success' | 'progress' | 'warning';

export interface ActivityEvent {
  readonly id: number;
  readonly kind: ActivityKind;
  readonly message: string;
  readonly timestamp: string;
}

const SAMPLE_ACTIVITY: ReadonlyArray<string> = [
  'Started performance profiling',
  'Scanned the WebGL render passes',
  'Found 12 uniform update sites',
  'Benchmarking frame times',
  'Avg 16.7 ms — target 8.3 ms',
  'Optimization window identified',
  'Uniform cache implementation underway',
];

const KIND_META: Record<ActivityKind, { icon: ReactNode; iconClass: string }> = {
  success: {
    icon: <CheckCircle2 className="size-3.5" />,
    iconClass: 'text-success',
  },
  progress: {
    icon: <Zap className="size-3.5" />,
    iconClass: 'text-accent',
  },
  warning: {
    icon: <AlertTriangle className="size-3.5" />,
    iconClass: 'text-warning',
  },
};

let activityCounter = 0;

export interface ActivityFeedProps {
  /** Live events from the caller. When omitted, the feed self-simulates. */
  readonly events?: ReadonlyArray<ActivityEvent>;
  readonly className?: string;
  readonly maxRows?: number;
}

/**
 * ActivityFeed — the renamed "Live Logs". Never a terminal wall: each event is a
 * single calm row with an icon (✓ success, ⚡ in-progress, ⚠ warning), a short
 * human-readable line, and a timestamp. Rows fade and slide in as they arrive.
 */
export function ActivityFeed({ events, className, maxRows = 40 }: ActivityFeedProps): ReactNode {
  const [local, setLocal] = useState<ReadonlyArray<ActivityEvent>>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = events ?? local;

  useEffect(() => {
    if (events !== undefined) {
      return;
    }
    const interval = window.setInterval(() => {
      const msg = SAMPLE_ACTIVITY[activityCounter % SAMPLE_ACTIVITY.length] ?? '';
      const now = new Date();
      const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLocal((prev) => {
        const next = [
          ...prev,
          { id: activityCounter++, kind: 'progress' as const, message: msg, timestamp: ts },
        ];
        return next.length > maxRows ? next.slice(-maxRows) : next;
      });
    }, 2600);
    return () => window.clearInterval(interval);
  }, [events, maxRows]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  });

  const handleClear = () => {
    if (events === undefined) {
      setLocal([]);
    }
  };

  return (
    <Card
      size="sm"
      title="Activity"
      subtitle="What Nova is doing right now"
      actions={
        rows.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-fg-subtle transition-colors duration-fast hover:text-fg"
          >
            Clear
          </button>
        ) : undefined
      }
      className={className}
    >
      <div
        ref={listRef}
        className="scrollbar-thin h-48 overflow-y-auto pr-1"
        role="log"
        aria-live="polite"
      >
        {rows.length === 0 ? (
          <p className="py-3 text-xs text-fg-subtle">Waiting for activity…</p>
        ) : (
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {rows.slice(-maxRows).map((row) => (
                <ActivityRow key={row.id} event={row} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Card>
  );
}

/** ActivityRow — a single feed event: icon, human text, timestamp. */
export function ActivityRow({ event }: { readonly event: ActivityEvent }): ReactNode {
  const meta = KIND_META[event.kind];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex items-start gap-2.5 border-b border-border/60 py-2 last:border-b-0')}
    >
      <span className={cn('mt-[1px] shrink-0', meta.iconClass)} aria-hidden>
        {meta.icon}
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-fg-muted">{event.message}</span>
      <span className="shrink-0 font-mono text-[11px] leading-snug text-fg-subtle">
        {event.timestamp}
      </span>
    </motion.div>
  );
}
