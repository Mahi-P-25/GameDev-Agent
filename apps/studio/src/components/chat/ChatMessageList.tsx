import { useEffect, useRef } from 'react';
import { ChatMessageItem } from './ChatMessageItem';
import type { ChatMessage } from '../../services/ConversationStore';
import { NovaMark } from '../brand';

interface ChatMessageListProps {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly isTyping?: boolean | undefined;
  readonly onRegenerate?: ((messageId: string) => void) | undefined;
  readonly onStop?: (() => void) | undefined;
}

export function ChatMessageList({ messages, isTyping, onRegenerate, onStop }: ChatMessageListProps): React.ReactNode {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl py-4">
        {messages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} onRegenerate={onRegenerate} onStop={onStop} />
        ))}

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
