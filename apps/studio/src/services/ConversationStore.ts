import type { StudioApiClient } from './StudioApiClient';
import type { StudioActivity } from '@gamedev-agent/studio-api';
import type { Disposable } from '@gamedev-agent/shared';
import { ContextAssembler } from './ContextAssembler';

export interface ToolCallEntry {
  readonly id: string;
  readonly toolId: string;
  readonly action: string;
  readonly message: string;
  status: 'running' | 'ok' | 'failed';
  readonly timestamp: string;
}

export interface MemoryHitEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  content: string;
  readonly timestamp: string;
  status: 'typing' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  thoughtTrace: string[];
  toolCalls: ToolCallEntry[];
  memoryHits: MemoryHitEntry[];
  attachments?: string[];
  goalId?: string;
  missionId?: string;
}

export interface ChatThread {
  readonly id: string;
  title: string;
  readonly createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  activeGoalId?: string;
  isGenerating?: boolean;
  /** Pinned conversations float to the top of the sidebar. */
  pinned?: boolean;
}

const STORAGE_KEY = 'nova_chat_threads_v1';

export class ConversationStore {
  private threads: ChatThread[] = [];
  private activeThreadId: string | null = null;
  private api: StudioApiClient;
  private activityDisposable: Disposable | null = null;
  private listeners = new Set<() => void>();
  private activeAbortController: AbortController | null = null;

  constructor(api: StudioApiClient) {
    this.api = api;
    this.loadFromStorage();
    this.setupActivityListener();
  }

  private notify(): void {
    this.saveToStorage();
    for (const listener of this.listeners) {
      listener();
    }
  }

  public subscribe(listener: () => void): Disposable {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.threads = JSON.parse(raw);
        const first = this.threads[0];
        if (first) {
          this.activeThreadId = first.id;
        }
      }
    } catch {
      // Fallback
    }

    if (this.threads.length === 0) {
      this.createThread('New Conversation');
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.threads));
    } catch {
      // Ignore quota errors
    }
  }

  public setupActivityListener(): void {
    this.activityDisposable?.dispose();
    if (!this.api.ready) return;

    this.activityDisposable = this.api.onActivity((activity: StudioActivity) => {
      this.handleActivity(activity);
    });
  }

  public getThreads(): ReadonlyArray<ChatThread> {
    return this.threads;
  }

  /** Conversations ordered pinned-first, then most recently updated. */
  public getOrderedThreads(): ReadonlyArray<ChatThread> {
    return [...this.threads].sort((a, b) => {
      const aPinned = a.pinned === true ? 1 : 0;
      const bPinned = b.pinned === true ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  /**
   * Filter conversations by a free-text query against title and message
   * content. Returns conversations whose title or any message body matches.
   */
  public searchThreads(query: string): ReadonlyArray<ChatThread> {
    const q = query.trim().toLowerCase();
    if (!q) return this.getOrderedThreads();
    return this.getOrderedThreads().filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }

  /** Toggle the pinned state of a conversation. */
  public togglePin(threadId: string): void {
    const thread = this.threads.find((t) => t.id === threadId);
    if (thread) {
      thread.pinned = !thread.pinned;
      thread.updatedAt = 'Just now';
      this.notify();
    }
  }

  public getActiveThread(): ChatThread | null {
    return this.threads.find((t) => t.id === this.activeThreadId) ?? null;
  }

  public getActiveThreadId(): string | null {
    return this.activeThreadId;
  }

  public createThread(title = 'New Conversation'): ChatThread {
    const newThread: ChatThread = {
      id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: 'Just now',
      messages: [],
    };

    this.threads.unshift(newThread);
    this.activeThreadId = newThread.id;
    this.notify();
    return newThread;
  }

  public switchThread(threadId: string): void {
    if (this.threads.some((t) => t.id === threadId)) {
      this.activeThreadId = threadId;
      this.notify();
    }
  }

  public deleteThread(threadId: string): void {
    this.threads = this.threads.filter((t) => t.id !== threadId);
    if (this.activeThreadId === threadId) {
      this.activeThreadId = this.threads[0]?.id ?? null;
    }
    if (this.threads.length === 0) {
      this.createThread('New Conversation');
    } else {
      this.notify();
    }
  }

  public renameThread(threadId: string, newTitle: string): void {
    const thread = this.threads.find((t) => t.id === threadId);
    if (thread) {
      thread.title = newTitle;
      this.notify();
    }
  }

  public async sendMessage(prompt: string, attachments: string[] = []): Promise<void> {
    let thread = this.getActiveThread();
    if (!thread) {
      thread = this.createThread(prompt.slice(0, 32));
    }

    if (thread.title === 'New Conversation') {
      thread.title = prompt.slice(0, 32);
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: `user-msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: time,
      status: 'completed',
      thoughtTrace: [],
      toolCalls: [],
      memoryHits: [],
      attachments,
    };

    // Automatically build Nova Context Package for full project awareness
    const contextPackage = ContextAssembler.buildContext({
      api: this.api,
      activeThread: thread,
    });

    const assistantMessage: ChatMessage = {
      id: `assistant-msg-${Date.now()}`,
      role: 'assistant',
      content: `Thinking and planning execution for: "${prompt}"...\n\n`,
      timestamp: time,
      status: 'streaming',
      thoughtTrace: [
        `Goal received: ${prompt}`,
        `Context Package built for project "${contextPackage.activeProject?.name}" (${contextPackage.projectIntelligence.symbolCount} symbols indexed)`,
      ],
      toolCalls: [],
      memoryHits: [],
    };

    thread.messages.push(userMessage, assistantMessage);
    thread.isGenerating = true;
    thread.updatedAt = 'Just now';
    this.notify();

    this.setupActivityListener();
    this.activeAbortController = new AbortController();

    const activeContext = this.api.ready ? this.api.getContext() : null;
    const projectId = activeContext?.projectId ?? 'default';

    try {
      if (this.api.ready) {
        const goalResult = await this.api.submitGoal({
          projectId,
          title: prompt,
          description: prompt,
        });

        assistantMessage.goalId = goalResult.goalId;
        thread.activeGoalId = goalResult.goalId;
        this.notify();
      } else {
        // No fabricated progress: surface the real orchestration state.
        assistantMessage.status = 'failed';
        assistantMessage.content += '\n\n❌ **Studio API is not ready** — the kernel has not finished booting.';
        thread.isGenerating = false;
        this.notify();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      assistantMessage.status = 'failed';
      assistantMessage.content += `\n\n❌ Execution error: ${msg}`;
      thread.isGenerating = false;
      this.notify();
    }
  }

  public stopGeneration(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    const thread = this.getActiveThread();
    if (thread && thread.isGenerating) {
      thread.isGenerating = false;
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.status = 'cancelled';
        lastMsg.content += '\n\n⏹ Generation cancelled by user.';
      }
      this.notify();
    }
  }

  public async regenerateResponse(messageId: string): Promise<void> {
    const thread = this.getActiveThread();
    if (!thread) return;

    const msgIdx = thread.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;

    // Find prior user prompt
    let userPrompt = '';
    for (let i = msgIdx - 1; i >= 0; i--) {
      const msg = thread.messages[i];
      if (msg && msg.role === 'user') {
        userPrompt = msg.content;
        break;
      }
    }

    if (!userPrompt) return;

    // Truncate from assistant message onwards and re-send prompt
    thread.messages = thread.messages.slice(0, msgIdx);
    this.notify();
    await this.sendMessage(userPrompt);
  }

  private handleActivity(activity: StudioActivity): void {
    const thread = this.getActiveThread();
    if (!thread) return;

    const lastMsg = thread.messages[thread.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    const timestamp = new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (activity.kind === 'goal.created' || activity.kind === 'plan.created') {
      lastMsg.thoughtTrace.push(activity.message);
      lastMsg.content += `✦ ${activity.message}\n`;
    } else if (
      activity.kind.startsWith('agent.action-started') ||
      activity.kind.startsWith('tool.started') ||
      activity.kind.startsWith('tool.invoked')
    ) {
      const toolName = activity.message.replace('Executing: ', '').replace(/^Tool.*: /, '').replace(/^Tool invoked: /, '');
      lastMsg.thoughtTrace.push(`Executing tool: ${toolName}`);
      lastMsg.toolCalls.push({
        id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        toolId: 'tool-runtime',
        action: toolName,
        message: activity.message,
        status: 'running',
        timestamp,
      });
      lastMsg.content += `\n🛠 **Tool Executing**: \`${toolName}\`...\n`;
    } else if (
      activity.kind.startsWith('agent.action-result') ||
      activity.kind.startsWith('tool.completed') ||
      activity.kind.startsWith('tool.result')
    ) {
      const ok =
        activity.kind !== 'tool.result'
          ? activity.message.includes('OK')
          : !activity.message.includes('FAIL');
      const activeTool = lastMsg.toolCalls[lastMsg.toolCalls.length - 1];
      if (activeTool) {
        activeTool.status = ok ? 'ok' : 'failed';
      }
      lastMsg.content += `${ok ? '✓' : '❌'} ${activity.message}\n`;
    } else if (
      activity.kind.startsWith('agent.state-changed') ||
      activity.kind === 'agent.thought' ||
      activity.kind === 'agent.decision'
    ) {
      lastMsg.thoughtTrace.push(activity.message);
    } else if (activity.kind === 'agent.verification') {
      lastMsg.thoughtTrace.push(activity.message);
      lastMsg.content += `✓ ${activity.message}\n`;
    } else if (
      activity.kind === 'agent.artifact-created' ||
      activity.kind.startsWith('agent.memory.') ||
      activity.kind.startsWith('mission.memory')
    ) {
      lastMsg.memoryHits.push({
        id: `mem-${Date.now()}`,
        title:
          activity.kind === 'agent.artifact-created'
            ? 'Artifact Created'
            : 'Project Memory Hit',
        summary: activity.message,
      });
    } else if (activity.kind === 'mission.completed' || activity.kind === 'agent.mission-complete') {
      lastMsg.status = 'completed';
      thread.isGenerating = false;
      if (!lastMsg.content.includes('Mission Complete')) {
        lastMsg.content += '\n\n✅ **Mission Executed Successfully**. All workflow steps verified.';
      }
    } else if (activity.kind === 'mission.failed') {
      lastMsg.status = 'failed';
      thread.isGenerating = false;
      lastMsg.content += `\n\n❌ **Mission Failed**: ${activity.message}`;
    }

    this.notify();
  }
}
