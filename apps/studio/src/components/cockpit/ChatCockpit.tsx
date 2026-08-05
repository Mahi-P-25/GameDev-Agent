import { useCallback } from 'react';
import { useConversationStore } from '../../services/ConversationStoreProvider';
import { ChatComposer } from '../chat/ChatComposer';
import { ChatMessageList } from '../chat/ChatMessageList';
import { WelcomeView } from '../chat/WelcomeView';

/**
 * ChatCockpit — the single orchestration entry point for the Nova Studio.
 *
 * The user prompt flows through the {@link ConversationStore} which drives the
 * entire backend pipeline (Context → Intelligence → Memory → Producer →
 * Planner → MissionAgent → tools → verification) and streams every Studio
 * Activity into the assistant message in real time. No simulated progress.
 */
export function ChatCockpit(): React.ReactNode {
  const {
    activeThread,
    sendMessage,
    stopGeneration,
    regenerateResponse,
    isGenerating,
  } = useConversationStore();

  const messages = activeThread?.messages ?? [];
  const hasMessages = messages.length > 0;

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const handleSelectPrompt = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg-base text-fg font-sans">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
        {hasMessages ? (
          <ChatMessageList
            messages={messages}
            isTyping={false}
            onRegenerate={(messageId) => void regenerateResponse(messageId)}
            onStop={stopGeneration}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
            <WelcomeView onSelectPrompt={handleSelectPrompt} />
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-bg-panel/60">
        <ChatComposer
          onSend={(prompt) => void sendMessage(prompt)}
          isGenerating={isGenerating}
          onStop={stopGeneration}
          {...(lastAssistantId !== undefined
            ? { onRegenerate: () => void regenerateResponse(lastAssistantId) }
            : {})}
        />
      </div>
    </div>
  );
}
