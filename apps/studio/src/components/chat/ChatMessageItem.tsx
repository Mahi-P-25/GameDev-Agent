import { motion } from 'motion/react';
import { User, RefreshCw, Check, Copy, Square, AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../design/cn';
import { MarkdownRenderer } from './MarkdownRenderer';
import { NovaMark } from '../brand';
import { MissionExecutionPanel } from '../mission/MissionExecutionPanel';
import type { ChatMessage } from '../../services/ConversationStore';

interface ChatMessageItemProps {
  readonly message: ChatMessage;
  readonly onRegenerate?: ((messageId: string) => void) | undefined;
  readonly onStop?: (() => void) | undefined;
}

/**
 * Stream assistant content in with a natural "typing" reveal. When a code block
 * is mid-write (unbalanced backticks) the reveal is suspended so the fence
 * never flashes as broken markdown.
 */
function useStreamingReveal(content: string, active: boolean, speed = 2): string {
  const [count, setCount] = useState(() => (active ? 0 : content.length));

  useEffect(() => {
    if (!active) {
      setCount(content.length);
      return;
    }

    const backtickCount = (content.match(/`/g) ?? []).length;
    const codeSafe = backtickCount % 2 === 0;

    setCount((prev) => Math.min(prev, content.length));
    if (!codeSafe) {
      setCount(content.length);
      return;
    }

    const tick = window.setInterval(() => {
      setCount((prev) => Math.min(prev + speed, content.length));
    }, 20);
    return () => window.clearInterval(tick);
  }, [active, content, speed]);

  return active ? content.slice(0, count) : content;
}

function formatTimestamp(timestamp: string): string {
  const today = new Date().toLocaleDateString();
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()) || date.toLocaleDateString() === today) {
    return timestamp;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timestamp}`;
}

export function ChatMessageItem({ message, onRegenerate, onStop }: ChatMessageItemProps): React.ReactNode {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const isStreaming = message.status === 'streaming';
  const isTyping = message.status === 'typing';
  const hasFailed = message.status === 'failed';

  const displayContent = useStreamingReveal(message.content, isStreaming);

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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative flex w-full gap-4 px-4 py-5 transition-colors duration-fast border-b border-border/30',
        isUser ? 'bg-transparent' : 'bg-bg-panel/40',
        hasFailed && 'bg-danger/5'
      )}
    >
      {/* Failure accent */}
      {hasFailed && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-danger" aria-hidden />
      )}

      {/* Role Avatar */}
      <div className="flex shrink-0 flex-col items-center">
        {isUser ? (
          <div className="grid size-8 place-items-center rounded-xl border border-border bg-bg-surface text-fg-muted shadow-sm">
            <User className="size-4" />
          </div>
        ) : (
          <div className="relative grid size-8 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent shadow-sm">
            <NovaMark size="sm" />
            {(isStreaming || isTyping) && (
              <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
              </span>
            )}
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
            <span className="text-[11px] text-fg-subtle">{formatTimestamp(message.timestamp)}</span>

            {/* Status indicator */}
            {isStreaming && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-2.5 py-0.5 text-[10px] font-medium text-accent">
                <Loader2 className="size-3 animate-spin text-accent" />
                Executing Mission
              </span>
            )}
            {isTyping && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-2.5 py-0.5 text-[10px] font-medium text-accent">
                <span className="size-1.5 rounded-full bg-accent animate-ping" />
                Thinking…
              </span>
            )}
            {message.status === 'cancelled' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-fg-subtle/20 px-2 py-0.5 text-[10px] font-medium text-fg-subtle">
                Cancelled
              </span>
            )}
            {hasFailed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-medium text-danger">
                <AlertTriangle className="size-2.5" />
                Failed
              </span>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
            <button
              type="button"
              onClick={handleCopyText}
              className="rounded-lg p-1.5 text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
              title="Copy message text"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </button>
            {!isUser && onRegenerate && !isStreaming && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className="rounded-lg p-1.5 text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
                title="Regenerate response"
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}
            {!isUser && isStreaming && onStop && (
              <button
                type="button"
                onClick={onStop}
                className="rounded-lg p-1.5 text-accent transition-colors duration-fast hover:bg-bg-hover"
                title="Stop generation"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            )}
          </div>
        </div>

        {/* Live Mission Execution Panel */}
        {!isUser && (message.thoughtTrace.length > 0 || message.toolCalls.length > 0 || isStreaming) && (
          <MissionExecutionPanel message={message} isGenerating={isStreaming} />
        )}

        {/* Message Content */}
        <div className="min-w-0">
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg font-medium">{message.content}</p>
          ) : (
            <div className="relative">
              <MarkdownRenderer content={displayContent} />
              {isStreaming && (
                <span
                  className="ml-1 inline-block h-4 w-[3px] animate-pulse rounded-full bg-accent align-text-bottom shadow-[0_0_8px_rgba(214,179,88,0.8)]"
                  aria-hidden
                />
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
