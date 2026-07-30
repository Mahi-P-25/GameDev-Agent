import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface MetricProps {
  readonly label: string;
  readonly value: string;
  readonly percent: number;
}

function MetricRow({ label, value, percent }: MetricProps): ReactNode {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-16 text-xs text-fg-muted shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-bg-inset overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-fg-muted"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium text-fg font-mono tabular-nums">{value}</span>
    </div>
  );
}

const METRICS: ReadonlyArray<MetricProps> = [
  { label: 'CPU', value: '23%', percent: 23 },
  { label: 'GPU', value: '45%', percent: 45 },
  { label: 'Memory', value: '6.2 GB', percent: 52 },
  { label: 'Disk', value: '1.4 TB', percent: 34 },
];

export function SystemMonitorCard(): ReactNode {
  return (
    <div className="rounded-xl border border-border bg-bg-panel overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          System Monitor
        </h3>
      </div>
      <div className="p-4">
        <div className="space-y-1">
          {METRICS.map((metric) => (
            <MetricRow key={metric.label} {...metric} />
          ))}
        </div>
      </div>
    </div>
  );
}
