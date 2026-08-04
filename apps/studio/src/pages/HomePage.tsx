import { WelcomeView } from '../components/chat/WelcomeView';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { TopBar } from '../components/layout/TopBar';
import { ConversationStoreProvider, useConversationStore } from '../services/ConversationStoreProvider';

function ChatCockpitContent(): React.ReactNode {
  const {
    threads,
    activeThread,
    activeThreadId,
    isGenerating,
    sendMessage,
    stopGeneration,
    regenerateResponse,
    switchThread,
    createThread,
    deleteThread,
  } = useConversationStore();

  const activeMessages = activeThread?.messages ?? [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app text-fg antialiased">
      {/* Left Chat Sidebar */}
      <ChatSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={switchThread}
        onNewChat={() => createThread()}
        onDeleteThread={deleteThread}
      />

      {/* Main Conversation Center Panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        <main className="flex flex-1 flex-col overflow-hidden relative">
          {activeMessages.length === 0 ? (
            <div className="flex-1 overflow-y-auto px-4">
              <WelcomeView onSelectPrompt={(prompt) => sendMessage(prompt)} />
            </div>
          ) : (
            <ChatMessageList
              messages={activeMessages}
              isTyping={isGenerating && activeMessages.length % 2 !== 0}
              onRegenerate={regenerateResponse}
              onStop={stopGeneration}
            />
          )}

          {/* Bottom Glassmorphic Composer */}
          <ChatComposer
            onSend={(prompt) => sendMessage(prompt)}
            isGenerating={isGenerating}
            onStop={stopGeneration}
          />
        </main>
      </div>
    </div>
  );
}

export function HomePage(): React.ReactNode {
  return (
    <ConversationStoreProvider>
      <ChatCockpitContent />
    </ConversationStoreProvider>
  );
}
