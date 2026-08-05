import { memo, useCallback, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChatMessageItem } from './ChatMessageItem';
import type { ChatMessage } from '../../services/ConversationStore';
import { NovaMark } from '../brand';

interface ChatMessageListProps {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly isTyping?: boolean | undefined;
  readonly onRegenerate?: ((messageId: string) => void) | undefined;
  readonly onStop?: (() => void) | undefined;
}

const MemoChatMessageItem = memo(ChatMessageItem);

/**
 * ChatMessageList — the scrolling conversation thread.
 *
 * Auto-scroll is "smart": it always pins to the newest message while a response
 * is streaming, but once the user scrolls up the thread stays put so they can
 * read earlier context. New messages animate in with a subtle fade.
 */
export function ChatMessageList({ messages, isTyping, onRegenerate, onStop }: ChatMessageListProps): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const hasStreaming = messages.some((m) => m.role === 'assistant' && m.status === 'streaming');

  // Track whether the user has scrolled away from the bottom.
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 96;
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: hasStreaming ? 'smooth' : 'auto' });
    }
  }, [messages, hasStreaming]);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
      <div className="mx-auto w-full max-w-4xl py-4">
        <motion.div
          initial={false}
          className="flex flex-col"
        >
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <MemoChatMessageItem message={msg} onRegenerate={onRegenerate} onStop={onStop} />
            </motion.div>
          ))}
        </motion.div>

        {isTyping && (
          <div className="flex w-full gap-4 px-4 py-4 bg-bg-panel/40 border-y border-border/40">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent shadow-sm">
              <NovaMark size="sm" />
            </div>
            <div className="flex items-center gap-1.5 py-2">
              <span className="size-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="size-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="size-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-2 font-mono text-xs text-fg-subtle">Nova is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
