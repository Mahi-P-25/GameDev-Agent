import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

interface MetricProps {
  readonly label: string;
  readonly value: string;
  readonly percent: number;
}

function MetricRow({ label, value, percent }: MetricProps): ReactNode {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-12 shrink-0 text-xs text-fg-subtle">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-inset">
        <motion.div
          className="h-full rounded-full bg-fg-muted"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-fg-subtle">
        {value}
      </span>
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
    <Card size="sm" title="System">
      <div className="flex flex-col">
        {METRICS.map((metric) => (
          <MetricRow key={metric.label} {...metric} />
        ))}
      </div>
    </Card>
  );
}
