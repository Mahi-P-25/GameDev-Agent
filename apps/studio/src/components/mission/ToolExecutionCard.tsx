import { motion } from 'motion/react';
import { Terminal, Check, Copy, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../design/cn';

export interface ToolExecutionData {
  readonly id: string;
  readonly toolId?: string;
  readonly action: string;
  readonly command?: string;
  readonly message?: string;
  readonly status: 'running' | 'ok' | 'success' | 'warning' | 'failed' | 'failure';
  readonly duration?: string;
  readonly timestamp?: string;
  readonly output?: string;
  readonly logs?: ReadonlyArray<string>;
}

interface ToolExecutionCardProps {
  readonly tool: ToolExecutionData;
  readonly className?: string;
}

export function ToolExecutionCard({ tool, className }: ToolExecutionCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isSuccess = tool.status === 'ok' || tool.status === 'success';
  const isFailed = tool.status === 'failed' || tool.status === 'failure';
  const isWarning = tool.status === 'warning';
  const isRunning = tool.status === 'running';

  const outputText = tool.output || tool.message || tool.command || tool.action;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group overflow-hidden rounded-xl border transition-all duration-fast shadow-sm',
        isRunning && 'border-accent/40 bg-bg-panel/95 shadow-[0_0_12px_rgba(214,179,88,0.15)]',
        isSuccess && 'border-border/80 bg-bg-panel/90',
        isWarning && 'border-warning/40 bg-warning/5',
        isFailed && 'border-danger/40 bg-danger/5',
        className,
      )}
    >
      {/* Top Card Header */}
      <div
        onClick={() => setExpanded((prev) => !prev)}
        className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 text-xs font-mono select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {expanded ? (
            <ChevronDown className="size-3.5 text-fg-subtle shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 text-fg-subtle shrink-0" />
          )}
          <Terminal className="size-4 text-accent shrink-0" />
          <div className="min-w-0 flex-1 truncate">
            <span className="font-bold text-fg">{tool.action}</span>
            {tool.command && tool.command !== tool.action && (
              <span className="ml-2 text-fg-subtle text-[11px] truncate">({tool.command})</span>
            )}
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {tool.duration && (
            <span className="text-[10px] text-fg-subtle font-mono hidden sm:inline">{tool.duration}</span>
          )}

          {isRunning && (
            <span className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
              <RefreshCw className="size-3 animate-spin" />
              Running
            </span>
          )}

          {isSuccess && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              <Check className="size-3" />
              Success
            </span>
          )}

          {isWarning && (
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
              <AlertTriangle className="size-3" />
              Warning
            </span>
          )}

          {isFailed && (
            <span className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
              <XCircle className="size-3" />
              Failed
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1 text-fg-subtle opacity-60 transition-opacity hover:bg-bg-hover hover:opacity-100 hover:text-fg"
            title="Copy command & output"
          >
            {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Output / Logs Terminal */}
      {expanded && (
        <div className="border-t border-border/60 bg-bg-sunken p-3 text-[11px] font-mono leading-relaxed text-fg">
          {tool.command && (
            <div className="mb-2 flex items-center gap-2 rounded bg-bg-panel px-2.5 py-1 text-accent font-medium">
              <span className="text-fg-subtle">$</span>
              <span>{tool.command}</span>
            </div>
          )}

          {tool.logs && tool.logs.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {tool.logs.map((log, idx) => (
                <div key={idx} className="text-fg-muted">
                  {log}
                </div>
              ))}
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-fg-muted">
              {tool.output || tool.message || 'No additional logs output available.'}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
