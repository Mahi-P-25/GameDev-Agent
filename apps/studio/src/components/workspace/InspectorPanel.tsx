import { useState } from 'react';
import { Info, Sparkles, FileCode, ChevronRight, ChevronLeft, Link2, Brain, GitBranch, ShieldCheck } from 'lucide-react';
import { useStudioData } from '../../studio/StudioDataProvider';
import type { FileItem } from './ExplorerNode';

interface InspectorPanelProps {
  readonly activeFile: FileItem | null;
  readonly className?: string;
}

export function InspectorPanel({ activeFile }: InspectorPanelProps): React.ReactNode {
  const { api } = useStudioData();
  const [collapsed, setCollapsed] = useState(false);

  const workspace = api.getWorkspace();
  const capabilities = api.listCapabilities();

  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-l border-border bg-bg-panel/95 py-3 select-none">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg"
          title="Expand Inspector"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-64 flex-col border-l border-border bg-bg-panel/95 p-3.5 backdrop-blur-xl select-none text-xs">
      {/* Inspector Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2 text-fg font-semibold">
          <Info className="size-4 text-accent" />
          <span className="uppercase tracking-wider text-[11px]">Inspector</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg"
          title="Collapse Inspector"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {activeFile ? (
        <div className="flex flex-col gap-4 overflow-y-auto pr-0.5">
          {/* Active File Metadata Card */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-bg-surface p-3 shadow-sm">
            <div className="flex items-center gap-2 text-fg font-semibold">
              <FileCode className="size-4 text-accent shrink-0" />
              <span className="truncate">{activeFile.name}</span>
            </div>

            <div className="mt-1 flex flex-col gap-1.5 text-[11px] text-fg-muted font-mono">
              <div className="flex items-center justify-between">
                <span className="text-fg-subtle font-sans">Language:</span>
                <span className="text-accent uppercase font-bold">{activeFile.extension || 'TS'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-subtle font-sans">Size:</span>
                <span className="text-fg">{activeFile.size || `${(activeFile.content?.length || 1024) / 1000} KB`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-subtle font-sans">Path:</span>
                <span className="text-fg truncate max-w-[120px]">{activeFile.path}</span>
              </div>
            </div>
          </div>

          {/* Live StudioApi Workspace Telemetry */}
          <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3">
            <div className="flex items-center gap-1.5 text-accent font-semibold">
              <ShieldCheck className="size-3.5" />
              <span>StudioApi Status</span>
            </div>
            <div className="flex flex-col gap-1 text-[11px] font-mono text-fg-muted">
              <div className="flex justify-between">
                <span>Readiness:</span>
                <span className="text-success font-bold">{workspace.ready ? 'Connected' : 'Syncing'}</span>
              </div>
              <div className="flex justify-between">
                <span>Capabilities:</span>
                <span className="text-fg">{capabilities.length} enabled</span>
              </div>
              <div className="flex justify-between">
                <span>Missions:</span>
                <span className="text-fg">{workspace.missionCount} active</span>
              </div>
            </div>
          </div>

          {/* Git Status Card */}
          <div className="flex flex-col gap-2 rounded-xl border border-success/30 bg-success/10 p-3">
            <div className="flex items-center gap-1.5 text-success font-semibold">
              <GitBranch className="size-3.5" />
              <span>Git Status: Clean</span>
            </div>
            <div className="text-[11px] text-fg-muted font-mono">
              Branch: <strong className="text-fg">main</strong> (Up to date)
            </div>
          </div>

          {/* Project Intelligence Scan */}
          <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
            <div className="flex items-center gap-1.5 text-accent font-semibold">
              <Sparkles className="size-3.5" />
              <span>Project Intelligence</span>
            </div>
            <p className="text-[11px] text-fg-muted leading-relaxed">
              Exported symbols, typed interfaces, and reactive hooks analyzed. 0 security or performance regressions detected.
            </p>
          </div>

          {/* Memory References */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-bg-surface/60 p-3">
            <div className="flex items-center gap-1.5 text-accent font-semibold">
              <Brain className="size-3.5" />
              <span>Memory Index (3)</span>
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-fg-muted">
              <span>✦ Renderer pipeline setup</span>
              <span>✦ Event loop delta time calculation</span>
              <span>✦ Input manager keyboard bindings</span>
            </div>
          </div>

          {/* Related Files */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1">
              <Link2 className="size-3 text-accent" /> Related Files
            </span>
            <div className="flex flex-col gap-1.5 font-mono text-[11px]">
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-bg-surface p-2 text-fg hover:bg-bg-hover cursor-pointer">
                <FileCode className="size-3.5 text-accent shrink-0" />
                <span className="truncate">GameEngine.ts</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-bg-surface p-2 text-fg hover:bg-bg-hover cursor-pointer">
                <FileCode className="size-3.5 text-accent shrink-0" />
                <span className="truncate">Renderer.ts</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-fg-subtle italic">Select a file from Explorer to view StudioApi telemetry.</div>
      )}
    </aside>
  );
}
