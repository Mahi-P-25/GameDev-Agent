import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
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

  return (
    <div className={cn('group relative my-3 overflow-hidden rounded-lg border border-border bg-bg-panel/90 shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-border/80 bg-bg-surface/80 px-4 py-2 text-xs text-fg-subtle">
        <span className="font-mono font-medium tracking-wide uppercase text-accent/90">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors duration-fast hover:bg-bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-success" />
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5 text-fg-subtle group-hover:text-fg" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto p-4 text-[13px] font-mono leading-relaxed text-fg">
        <pre className="whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
