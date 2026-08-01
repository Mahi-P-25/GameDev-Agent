import { Clock, ListTree } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import type { MissionEvent } from '../../adapters/missionTypes';
import { Artifacts } from '../artifacts/Artifacts';
import { ReasoningPanel } from '../reasoning/ReasoningPanel';
import { Card } from '../ui/Card';
import { StatusChip } from '../ui/StatusChip';
import { type Tab, TabBar } from './TabBar';

const TABS: ReadonlyArray<Tab> = [
  { id: 'execution', label: 'Execution' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'graph', label: 'Graph' },
];

export interface DetailPanelProps {
  readonly events: ReadonlyArray<MissionEvent>;
  readonly missionText?: string;
}

export function DetailPanel({ events, missionText }: DetailPanelProps): ReactNode {
  const [activeTab, setActiveTab] = useState('execution');

  const activeEvent = events[events.length - 1];

  return (
    <Card
      title={missionText ?? 'Mission Detail'}
      actions={
        activeEvent !== undefined ? (
          <span className="flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
            <Clock className="size-3" />
            {activeEvent.timestamp}
          </span>
        ) : undefined
      }
      padded={false}
    >
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'execution' && <ExecutionTab />}
            {activeTab === 'reasoning' && <ReasoningPanel />}
            {activeTab === 'artifacts' && <Artifacts />}
            {activeTab === 'graph' && <GraphTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}

function ExecutionTab(): ReactNode {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-bg-inset p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <StatusChip intent="accent" pulse label="Current step" />
          </span>
          <span className="flex items-center gap-1 rounded-full border border-border bg-bg-hover px-2 py-0.5 text-[10px] text-fg-muted">
            <Clock className="size-3" />
            2.3s elapsed
          </span>
        </div>
        <div className="text-sm font-medium text-fg">Performance Profiling</div>
        <div className="mt-0.5 text-xs text-fg-muted">
          Analyzing frame render times across 3 scenes
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-inset p-3">
        <div className="mb-1.5 text-xs font-semibold text-fg-subtle">Tool in use</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] text-fg">profiler.ts</span>
          <span className="rounded-full border border-border-accent bg-accent-soft px-2 py-0.5 text-[10px] text-accent">
            editing
          </span>
        </div>
      </div>
    </div>
  );
}

function GraphTab(): ReactNode {
  return (
    <div className="rounded-lg border border-border bg-bg-inset p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListTree className="size-3.5 text-fg-muted" />
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Task Dependency Graph
        </span>
      </div>
      <div className="space-y-1 text-sm text-fg-muted">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" />
          <span>Project analysis</span>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-fg">Performance profiling</span>
        </div>
        <div className="ml-8 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-fg-subtle" />
          <span>Asset optimization</span>
        </div>
        <div className="ml-8 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-fg-subtle" />
          <span>Code refactoring</span>
        </div>
      </div>
    </div>
  );
}
