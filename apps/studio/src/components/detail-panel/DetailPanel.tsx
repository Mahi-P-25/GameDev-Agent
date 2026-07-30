import { AnimatePresence, motion } from 'motion/react';
import { Clock, Cpu, FileCode, GitBranch, ListTree } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { MissionEvent } from '../../adapters/missionTypes';
import { TabBar, type Tab } from './TabBar';

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

function ReasoningTab(): ReactNode {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-bg-inset p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="size-3.5 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Current Decision
          </span>
        </div>
        <p className="text-sm text-fg leading-relaxed">
          Analyzing the project structure to identify performance bottlenecks in the rendering pipeline. 
          The <code className="rounded bg-bg-hover px-1 py-0.5 font-mono text-[13px] text-accent">WebGLRenderer.tsx</code> 
          component shows repeated uniform updates that could be batched. Recommend implementing 
          a uniform cache with dirty-flag checking to reduce GPU state changes.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-bg-inset p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="size-3.5 text-fg-muted" />
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Approach
          </span>
        </div>
        <p className="text-sm text-fg leading-relaxed">
          Phase 1: Audit all <code className="rounded bg-bg-hover px-1 py-0.5 font-mono text-[13px] text-accent">gl.uniform*</code> 
          calls across 3 render passes. Phase 2: Design a batch update system. Phase 3: Implement 
          and verify against benchmark scenes.
        </p>
      </div>
    </div>
  );
}

function ArtifactsTab(): ReactNode {
  return (
    <div className="space-y-2">
      {['uniform-cache.ts', 'render-optimizer.ts', 'batch-update-system.md'].map((file) => (
        <div
          key={file}
          className="flex items-center gap-3 rounded-lg border border-border bg-bg-inset px-3 py-2.5 hover:bg-bg-hover transition-colors duration-fast cursor-pointer"
        >
          <FileCode className="size-4 text-fg-muted" />
          <span className="text-sm text-fg font-mono">{file}</span>
        </div>
      ))}
      <div className="pt-2 text-xs text-fg-subtle">
        3 artifacts generated so far
      </div>
    </div>
  );
}

function GraphTab(): ReactNode {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-bg-inset p-4">
        <div className="flex items-center gap-2 mb-3">
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
          <div className="flex items-center gap-2 ml-4">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-fg">Performance profiling</span>
          </div>
          <div className="flex items-center gap-2 ml-8">
            <span className="size-1.5 rounded-full bg-fg-subtle" />
            <span>Asset optimization</span>
          </div>
          <div className="flex items-center gap-2 ml-8">
            <span className="size-1.5 rounded-full bg-fg-subtle" />
            <span>Code refactoring</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailPanel({ events, missionText }: DetailPanelProps): ReactNode {
  const [activeTab, setActiveTab] = useState('execution');

  const activeEvent = events[events.length - 1];

  return (
    <div className="rounded-xl border border-border bg-bg-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {missionText ?? 'Mission Detail'}
        </h3>
        {activeEvent && (
          <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
            <Clock className="size-3" />
            {activeEvent.timestamp}
          </span>
        )}
      </div>

      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'execution' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-bg-inset p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs font-semibold text-accent">Current Step</span>
                  </div>
                  <div className="text-sm font-medium text-fg">Performance Profiling</div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    Analyzing frame render times across 3 scenes
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-bg-hover px-2 py-0.5 text-[10px] text-fg-muted">
                    <Clock className="size-3" />
                    2.3s elapsed
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-bg-inset p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Cpu className="size-3.5 text-fg-muted" />
                    <span className="text-xs font-semibold text-fg-muted">Tool in Use</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-fg font-mono">profiler.ts</span>
                    <span className="rounded-full border border-accent/20 bg-accent-soft px-2 py-0.5 text-[10px] text-accent">
                      editing
                    </span>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'reasoning' && <ReasoningTab />}
            {activeTab === 'artifacts' && <ArtifactsTab />}
            {activeTab === 'graph' && <GraphTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
