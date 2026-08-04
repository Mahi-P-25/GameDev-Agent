import { User, RefreshCw, Check, Copy, Square, ChevronDown, ChevronRight, Terminal, Brain, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../design/cn';
import { MarkdownRenderer } from './MarkdownRenderer';
import { NovaMark } from '../brand';
import type { ChatMessage } from '../../services/ConversationStore';

interface ChatMessageItemProps {
  readonly message: ChatMessage;
  readonly onRegenerate?: ((messageId: string) => void) | undefined;
  readonly onStop?: (() => void) | undefined;
}

export function ChatMessageItem({ message, onRegenerate, onStop }: ChatMessageItemProps): React.ReactNode {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showThoughtTrace, setShowThoughtTrace] = useState(false);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className={cn(
        'group relative flex w-full gap-4 px-4 py-5 transition-colors duration-fast border-b border-border/30',
        isUser ? 'bg-transparent' : 'bg-bg-panel/40'
      )}
    >
      {/* Role Avatar */}
      <div className="flex shrink-0 flex-col items-center">
        {isUser ? (
          <div className="grid size-8 place-items-center rounded-lg border border-border bg-bg-surface text-fg-muted shadow-sm">
            <User className="size-4" />
          </div>
        ) : (
          <div className="grid size-8 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent shadow-sm">
            <NovaMark size="sm" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/* Header line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-fg">
              {isUser ? 'You' : 'Nova AI Assistant'}
            </span>
            <span className="text-[11px] text-fg-subtle">{message.timestamp}</span>

            {/* Status indicator */}
            {message.status === 'streaming' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                <span className="size-1.5 rounded-full bg-accent animate-ping" />
                Executing Mission
              </span>
            )}
            {message.status === 'cancelled' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-fg-subtle/20 px-2 py-0.5 text-[10px] font-medium text-fg-subtle">
                Cancelled
              </span>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
            <button
              type="button"
              onClick={handleCopyText}
              className="rounded p-1 text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
              title="Copy message text"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </button>
            {!isUser && onRegenerate && message.status !== 'streaming' && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className="rounded p-1 text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
                title="Regenerate response"
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}
            {!isUser && message.status === 'streaming' && onStop && (
              <button
                type="button"
                onClick={onStop}
                className="rounded p-1 text-accent transition-colors duration-fast hover:bg-bg-hover"
                title="Stop generation"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            )}
          </div>
        </div>

        {/* Thought Trace / Reasoning Collapsible */}
        {!isUser && message.thoughtTrace.length > 0 && (
          <div className="rounded-lg border border-border/70 bg-bg-surface/60 p-2.5 text-xs">
            <button
              type="button"
              onClick={() => setShowThoughtTrace((prev) => !prev)}
              className="flex items-center gap-1.5 font-medium text-fg-subtle hover:text-fg"
            >
              {showThoughtTrace ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              <Sparkles className="size-3 text-accent" />
              <span>Reasoning & Execution Trace ({message.thoughtTrace.length} steps)</span>
            </button>

            {showThoughtTrace && (
              <div className="mt-2 flex flex-col gap-1 border-t border-border/50 pt-2 font-mono text-[11px] text-fg-muted">
                {message.thoughtTrace.map((trace, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-accent">✦</span>
                    <span>{trace}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Memory Hits Cards */}
        {!isUser && message.memoryHits.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.memoryHits.map((mem) => (
              <div
                key={mem.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent"
              >
                <Brain className="size-3.5" />
                <span>{mem.summary}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tool Execution Cards */}
        {!isUser && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1.5 my-1">
            {message.toolCalls.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between rounded-lg border border-border bg-bg-panel/90 px-3 py-2 text-xs font-mono"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Terminal className="size-3.5 text-accent shrink-0" />
                  <span className="truncate text-fg">{tool.action}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {tool.status === 'running' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                      <RefreshCw className="size-3 animate-spin" />
                      Running
                    </span>
                  )}
                  {tool.status === 'ok' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-success">
                      <Check className="size-3" />
                      Success
                    </span>
                  )}
                  {tool.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-danger">
                      Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message Content */}
        <div className="min-w-0">
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg font-medium">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}
