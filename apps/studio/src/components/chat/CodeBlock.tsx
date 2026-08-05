import { useState } from 'react';
import { Check, Copy, Code2 } from 'lucide-react';
import { cn } from '../../design/cn';

interface CodeBlockProps {
  readonly language?: string;
  readonly code: string;
  readonly className?: string;
}

export function CodeBlock({ language = 'typescript', code, className }: CodeBlockProps): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const lines = code.split('\n');

  return (
    <div className={cn('group relative my-3 overflow-hidden rounded-xl border border-border/80 bg-bg-sunken shadow-md', className)}>
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-border/80 bg-bg-panel/90 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="size-2.5 rounded-full bg-danger/40 border border-danger/60" />
            <span className="size-2.5 rounded-full bg-warning/40 border border-warning/60" />
            <span className="size-2.5 rounded-full bg-success/40 border border-success/60" />
          </div>
          <Code2 className="size-3.5 text-accent" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent/90">
            {language}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-bg-surface/80 px-2.5 py-1 text-[11px] font-medium text-fg-muted transition-all duration-fast hover:border-accent/40 hover:bg-bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-success" />
              <span className="text-success font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5 text-fg-subtle group-hover:text-fg" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="overflow-x-auto p-4 text-[13px] font-mono leading-relaxed text-fg">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                <td className="w-8 select-none pr-4 text-right text-[11px] text-fg-subtle opacity-40 font-mono">
                  {idx + 1}
                </td>
                <td className="whitespace-pre">
                  <code>{line}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
