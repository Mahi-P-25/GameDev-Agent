import { motion } from 'motion/react';
import { Code2, Eye, Edit3, MapPin, Copy, Check, Sparkles, CheckCircle2, XCircle, GitCompare } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../design/cn';
import type { FileItem } from './ExplorerNode';

export interface InlineEditDiff {
  readonly active: boolean;
  readonly addedLines?: ReadonlyArray<number>;
  readonly modifiedLines?: ReadonlyArray<number>;
  readonly removedLines?: ReadonlyArray<number>;
  readonly summary?: string;
}

interface MonacoEditorPanelProps {
  readonly file: FileItem | null;
  readonly inlineDiff?: InlineEditDiff;
  readonly onContentChange?: (fileId: string, newContent: string) => void;
  readonly onAcceptDiff?: () => void;
  readonly onRejectDiff?: () => void;
}

export function MonacoEditorPanel({
  file,
  inlineDiff = {
    active: true,
    addedLines: [5, 6, 7],
    modifiedLines: [14, 15],
    removedLines: [22],
    summary: 'Nova AI Refactored Game Loop & Renderer Initialization',
  },
  onContentChange,
  onAcceptDiff,
  onRejectDiff,
}: MonacoEditorPanelProps): React.ReactNode {
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [diffAccepted, setDiffAccepted] = useState(false);

  if (!file) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg-base p-8 text-center text-fg-subtle">
        <Code2 className="size-12 text-accent/40 mb-3" />
        <h3 className="text-sm font-semibold text-fg">No File Open</h3>
        <p className="mt-1 text-xs max-w-sm">Select a file from the left explorer sidebar to view or edit code.</p>
      </div>
    );
  }

  const content = file.content || `// Content for ${file.name}\n// Autonomous AI Code Generation & Inspection\n`;
  const lines = content.split('\n');
  const lang = file.extension || 'typescript';

  const isDiffActive = inlineDiff.active && !diffAccepted;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAccept = () => {
    setDiffAccepted(true);
    onAcceptDiff?.();
  };

  const handleReject = () => {
    setDiffAccepted(true);
    onRejectDiff?.();
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-bg-base">
      {/* Floating AI Inline Edits Control Banner */}
      {isDiffActive && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-20 flex items-center justify-between border-b border-accent/40 bg-accent/15 px-4 py-2 text-xs backdrop-blur-md shadow-md"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent animate-pulse shrink-0" />
            <span className="font-bold text-fg">AI Inline Edit:</span>
            <span className="text-fg-muted truncate">{inlineDiff.summary}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1 text-xs font-bold text-bg-base hover:bg-success/90 transition-transform hover:scale-105 shadow-sm"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Accept</span>
            </button>

            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center gap-1 rounded-lg border border-danger/40 bg-danger/20 px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/30 transition-colors"
            >
              <XCircle className="size-3.5" />
              <span>Reject</span>
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-surface px-2.5 py-1 text-xs font-medium text-fg-muted hover:text-fg"
            >
              <GitCompare className="size-3.5" />
              <span>View Diff</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Editor Control Toolbar */}
      <div className="flex h-9 items-center justify-between border-b border-border/60 bg-bg-panel/80 px-4 text-xs font-mono select-none">
        <div className="flex items-center gap-2">
          <Code2 className="size-3.5 text-accent" />
          <span className="font-semibold text-fg">{file.name}</span>
          <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] text-accent uppercase">{lang}</span>
        </div>

        <div className="flex items-center gap-2 text-fg-subtle">
          <button
            type="button"
            onClick={() => setIsReadOnly((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
              isReadOnly ? 'bg-bg-surface text-fg-muted hover:text-fg' : 'bg-accent/20 text-accent font-bold',
            )}
            title={isReadOnly ? 'Switch to Edit Mode' : 'Switch to Read-Only'}
          >
            {isReadOnly ? <Eye className="size-3.5" /> : <Edit3 className="size-3.5 text-accent" />}
            <span>{isReadOnly ? 'Read-Only' : 'Editing'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMinimap((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              showMinimap ? 'text-accent' : 'text-fg-subtle hover:text-fg',
            )}
            title="Toggle Minimap"
          >
            <MapPin className="size-3" />
            <span className="hidden sm:inline">Minimap</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted hover:text-fg"
            title="Copy file contents"
          >
            {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>

      {/* Editor Canvas & Code Lines */}
      <div className="relative flex flex-1 overflow-hidden font-mono text-[13px] leading-relaxed">
        {/* Line Numbers Track */}
        <div className="w-12 shrink-0 border-r border-border/40 bg-bg-panel/40 py-3 text-right pr-3 text-[11px] text-fg-subtle opacity-50 select-none">
          {lines.map((_, idx) => (
            <div key={idx} className="h-5">
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Code Canvas View with AI Line Highlighting */}
        <div className="flex-1 overflow-auto py-3 text-fg">
          {isReadOnly ? (
            <div className="font-mono">
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                const isAdded = isDiffActive && inlineDiff.addedLines?.includes(lineNum);
                const isModified = isDiffActive && inlineDiff.modifiedLines?.includes(lineNum);
                const isRemoved = isDiffActive && inlineDiff.removedLines?.includes(lineNum);

                return (
                  <div
                    key={idx}
                    className={cn(
                      'px-4 h-5 leading-5 transition-colors',
                      isAdded && 'bg-success/15 border-l-2 border-l-success font-semibold text-success-fg',
                      isModified && 'bg-warning/15 border-l-2 border-l-warning font-semibold',
                      isRemoved && 'bg-danger/15 border-l-2 border-l-danger line-through text-danger',
                    )}
                  >
                    {line || ' '}
                  </div>
                );
              })}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => onContentChange?.(file.id, e.target.value)}
              className="h-full w-full resize-none bg-transparent px-4 font-mono text-[13px] leading-relaxed text-fg outline-none"
            />
          )}
        </div>

        {/* Visual Minimap Sidebar */}
        {showMinimap && (
          <div className="w-20 shrink-0 border-l border-border/30 bg-bg-panel/60 p-1.5 opacity-30 select-none overflow-hidden hidden md:block">
            <div className="scale-[0.25] origin-top-left space-y-0.5 text-[8px] font-mono text-fg-muted">
              {lines.map((l, idx) => (
                <div key={idx} className="truncate">
                  {l || ' '}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
