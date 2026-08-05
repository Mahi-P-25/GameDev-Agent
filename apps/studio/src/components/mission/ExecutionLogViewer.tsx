import { useState } from 'react';
import { Check, Copy, Terminal, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../design/cn';

interface LogLine {
  readonly timestamp?: string;
  readonly message: string;
  readonly type?: 'info' | 'done' | 'error' | 'warning';
}

interface ExecutionLogViewerProps {
  readonly title?: string;
  readonly logs: ReadonlyArray<LogLine | string>;
  readonly defaultOpen?: boolean;
  readonly className?: string;
}

export function ExecutionLogViewer({
  title = 'Execution Logs',
  logs,
  defaultOpen = false,
  className,
}: ExecutionLogViewerProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const formattedLogs: LogLine[] = logs.map((l) =>
    typeof l === 'string' ? { message: l, type: l.includes('❌') || l.includes('failed') ? 'error' : l.includes('✓') || l.includes('success') ? 'done' : 'info' } : l,
  );

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const textToCopy = formattedLogs.map((l) => `${l.timestamp ? `[${l.timestamp}] ` : ''}${l.message}`).join('\n');
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/80 bg-bg-sunken shadow-sm', className)}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex cursor-pointer items-center justify-between border-b border-border/60 bg-bg-panel/90 px-3.5 py-2 text-xs font-mono select-none hover:bg-bg-hover/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="size-3.5 text-accent" /> : <ChevronRight className="size-3.5 text-fg-subtle" />}
          <Terminal className="size-3.5 text-accent shrink-0" />
          <span className="font-semibold text-fg">{title}</span>
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
            {formattedLogs.length} lines
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-bg-surface px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:border-accent/40 hover:text-fg"
        >
          {copied ? (
            <>
              <Check className="size-3 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3 text-fg-subtle" />
              <span>Copy Output</span>
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="max-h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-fg">
          {formattedLogs.length === 0 ? (
            <div className="py-2 text-center text-fg-subtle italic">No log outputs recorded yet.</div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {formattedLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="w-8 select-none pr-3 text-right text-[10px] text-fg-subtle opacity-40 font-mono">
                      {idx + 1}
                    </td>
                    <td className="whitespace-pre-wrap py-0.5">
                      {log.timestamp && <span className="mr-2 text-fg-subtle text-[10px]">[{log.timestamp}]</span>}
                      <span
                        className={cn(
                          log.type === 'error'
                            ? 'text-danger font-medium'
                            : log.type === 'done'
                              ? 'text-success font-medium'
                              : log.type === 'warning'
                                ? 'text-warning font-medium'
                                : 'text-fg-muted',
                        )}
                      >
                        {log.message}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
