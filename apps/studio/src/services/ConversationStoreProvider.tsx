import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ConversationStore, type ChatThread } from './ConversationStore';
import { useStudioData } from '../studio/StudioDataProvider';

interface ConversationStoreContextValue {
  readonly store: ConversationStore;
  readonly threads: ReadonlyArray<ChatThread>;
  readonly activeThread: ChatThread | null;
  readonly activeThreadId: string | null;
  readonly isGenerating: boolean;
  sendMessage: (prompt: string, attachments?: string[]) => Promise<void>;
  stopGeneration: () => void;
  regenerateResponse: (messageId: string) => Promise<void>;
  switchThread: (threadId: string) => void;
  createThread: (title?: string) => void;
  deleteThread: (threadId: string) => void;
  renameThread: (threadId: string, newTitle: string) => void;
}

const ConversationStoreContext = createContext<ConversationStoreContextValue | null>(null);

export function ConversationStoreProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const { api } = useStudioData();
  const [store] = useState(() => new ConversationStore(api));
  const [threads, setThreads] = useState<ReadonlyArray<ChatThread>>(() => store.getThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => store.getActiveThreadId());

  useEffect(() => {
    store.setupActivityListener();
    const sub = store.subscribe(() => {
      setThreads([...store.getThreads()]);
      setActiveThreadId(store.getActiveThreadId());
    });
    return () => {
      sub.dispose();
    };
  }, [store]);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const isGenerating = activeThread?.isGenerating ?? false;

  const value: ConversationStoreContextValue = {
    store,
    threads,
    activeThread,
    activeThreadId,
    isGenerating,
    sendMessage: (prompt, attachments) => store.sendMessage(prompt, attachments),
    stopGeneration: () => store.stopGeneration(),
    regenerateResponse: (messageId) => store.regenerateResponse(messageId),
    switchThread: (id) => store.switchThread(id),
    createThread: (title) => store.createThread(title),
    deleteThread: (id) => store.deleteThread(id),
    renameThread: (id, title) => store.renameThread(id, title),
  };

  return (
    <ConversationStoreContext.Provider value={value}>
      {children}
    </ConversationStoreContext.Provider>
  );
}

export function useConversationStore(): ConversationStoreContextValue {
  const ctx = useContext(ConversationStoreContext);
  if (!ctx) {
    throw new Error('useConversationStore must be used within ConversationStoreProvider');
  }
  return ctx;
}
