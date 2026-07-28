import type { Disposable, Json, Timestamp, UUID } from '@gamedev-agent/shared';
import type { ToolId, ToolSession, ToolSessionOptions } from './ToolTypes';

export type SessionId = string & { readonly __brand: 'SessionId' };

export function asSessionId(value: string): SessionId {
  return value as SessionId;
}

function generateSessionId(): SessionId {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` as SessionId;
}

export interface ToolSessionEvent {
  readonly sessionId: SessionId;
  readonly toolId: ToolId;
  readonly kind: 'session.created' | 'session.updated' | 'session.closed' | 'session.timed-out';
  readonly timestamp: number;
}

export class ToolSessionManager implements Disposable {
  private readonly sessions = new Map<SessionId, ToolSession>();
  private readonly toolSessions = new Map<ToolId, Set<SessionId>>();
  private readonly timers = new Map<SessionId, ReturnType<typeof setTimeout>>();
  private disposed = false;
  private readonly defaultTimeoutMs: number;

  constructor(
    private readonly onEvent?: (event: ToolSessionEvent) => void,
    defaultTimeoutMs = 300_000,
  ) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  create(options: ToolSessionOptions): ToolSession {
    const sessionId = generateSessionId();
    const now = Date.now() as Timestamp;
    const session: ToolSession = {
      sessionId,
      toolId: options.toolId,
      state: Object.freeze({ ...options.initialState }) as Readonly<Record<string, Json>>,
      createdAt: now,
      lastActivityAt: now,
      isActive: true,
      metadata: Object.freeze({ ...options.metadata }) as Readonly<Record<string, Json>>,
    };
    this.sessions.set(sessionId, session);
    const set = this.toolSessions.get(options.toolId) ?? new Set();
    set.add(sessionId);
    this.toolSessions.set(options.toolId, set);
    this.startTimeout(sessionId);
    this.emit({ sessionId, toolId: options.toolId, kind: 'session.created', timestamp: now });
    return session;
  }

  get(sessionId: SessionId): ToolSession | undefined {
    return this.sessions.get(sessionId);
  }

  require(sessionId: SessionId): ToolSession {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error(`session not found: "${sessionId}"`);
    }
    if (!session.isActive) {
      throw new Error(`session "${sessionId}" is no longer active`);
    }
    return session;
  }

  update(sessionId: SessionId, state: Readonly<Record<string, Json>>): ToolSession {
    const existing = this.require(sessionId);
    const now = Date.now() as Timestamp;
    const updated: ToolSession = {
      ...existing,
      state: Object.freeze({ ...existing.state, ...state }),
      lastActivityAt: now,
    };
    this.sessions.set(sessionId, updated);
    this.refreshTimeout(sessionId);
    this.emit({ sessionId, toolId: existing.toolId, kind: 'session.updated', timestamp: now });
    return updated;
  }

  close(sessionId: SessionId): void {
    const existing = this.sessions.get(sessionId);
    if (existing === undefined) return;
    const now = Date.now() as Timestamp;
    const closed: ToolSession = { ...existing, isActive: false, lastActivityAt: now };
    this.sessions.set(sessionId, closed);
    this.clearTimeout(sessionId);
    const set = this.toolSessions.get(existing.toolId);
    set?.delete(sessionId);
    if (set?.size === 0) {
      this.toolSessions.delete(existing.toolId);
    }
    this.emit({ sessionId, toolId: existing.toolId, kind: 'session.closed', timestamp: now });
  }

  listSessions(toolId?: ToolId): ReadonlyArray<ToolSession> {
    if (toolId !== undefined) {
      const ids = this.toolSessions.get(toolId);
      if (ids === undefined) return [];
      return [...ids].map((id) => this.sessions.get(id)!).filter(Boolean);
    }
    return [...this.sessions.values()];
  }

  listActiveSessions(toolId?: ToolId): ReadonlyArray<ToolSession> {
    return this.listSessions(toolId).filter((s) => s.isActive);
  }

  private startTimeout(sessionId: SessionId): void {
    const timer = setTimeout(() => {
      this.handleTimeout(sessionId);
    }, this.defaultTimeoutMs);
    this.timers.set(sessionId, timer);
  }

  private refreshTimeout(sessionId: SessionId): void {
    this.clearTimeout(sessionId);
    this.startTimeout(sessionId);
  }

  private clearTimeout(sessionId: SessionId): void {
    const timer = this.timers.get(sessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
    }
  }

  private handleTimeout(sessionId: SessionId): void {
    const session = this.sessions.get(sessionId);
    if (session === undefined || !session.isActive) return;
    const now = Date.now() as Timestamp;
    const timedOut: ToolSession = {
      ...session,
      isActive: false,
      lastActivityAt: now,
      metadata: Object.freeze({ ...session.metadata, timeout: true }) as Readonly<Record<string, Json>>,
    };
    this.sessions.set(sessionId, timedOut);
    this.timers.delete(sessionId);
    const set = this.toolSessions.get(session.toolId);
    set?.delete(sessionId);
    if (set?.size === 0) {
      this.toolSessions.delete(session.toolId);
    }
    this.emit({ sessionId, toolId: session.toolId, kind: 'session.timed-out', timestamp: now });
  }

  private emit(event: ToolSessionEvent): void {
    this.onEvent?.(event);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.sessions.clear();
    this.toolSessions.clear();
  }
}

export type { Disposable, Json, Timestamp, UUID };
