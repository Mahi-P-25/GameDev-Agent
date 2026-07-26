import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';
import {
  AgentActivityRecorded,
  AgentRegistered,
  AgentStatusChanged,
  AgentUnregistered,
  NotificationEmitted,
  PlanCreated,
  TaskBlocked,
  TaskCanceled,
  TaskFailed,
  TaskSucceeded,
} from './IntelligenceEvents';
import type {
  AgentActivity,
  AgentId,
  Notification,
  NotificationId,
  NotificationKind,
  TaskId,
} from './IntelligenceTypes';

/**
 * Notification Center — a truthful event/notification system.
 *
 * It subscribes to the Intelligence event stream and, for events that matter to a
 * human (completed work, failures, approvals, blocking), emits a
 * {@link Notification}. Notifications are derived *only* from real events — the
 * center never synthesizes a notification. Each emitted notification is itself
 * published as an `intelligence.notification` event so other surfaces (the UI
 * adapter seam, the Studio Activity feed) can consume it uniformly.
 */
export interface NotificationCenterOptions {
  readonly bus: EventBusContract;
  readonly logger?: Logger | undefined;
  readonly idGenerator?: (() => UUID) | undefined;
  /** Cap the in-memory ring (default 100). Oldest are dropped. */
  readonly limit?: number | undefined;
}

export class NotificationCenter implements Disposable {
  private readonly bus: EventBusContract;
  private readonly idGenerator: () => UUID;
  private readonly limit: number;
  private readonly notifications: Notification[] = [];
  private readonly disposers: Disposable[] = [];
  private disposed = false;

  constructor(options: NotificationCenterOptions) {
    this.bus = options.bus;
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID() as UUID);
    this.limit = options.limit ?? 100;

    this.disposers.push(
      this.bus.subscribe(TaskSucceeded, (e) => {
        this.emit({
          kind: 'success',
          title: 'Work completed',
          body: 'A studio task finished successfully.',
          sourceEvent: TaskSucceeded.type,
          correlationId: e.payload.correlationId,
          timestamp: e.payload.timestamp,
        });
      }),
    );
    this.disposers.push(
      this.bus.subscribe(TaskFailed, (e) => {
        this.emit({
          kind: 'failure',
          title: 'Work failed',
          body: `A studio task failed: ${e.payload.reason}`,
          sourceEvent: TaskFailed.type,
          correlationId: e.payload.correlationId,
          timestamp: e.payload.timestamp,
        });
      }),
    );
    this.disposers.push(
      this.bus.subscribe(TaskCanceled, (e) => {
        this.emit({
          kind: 'info',
          title: 'Work canceled',
          body: `A studio task was canceled: ${e.payload.reason}`,
          sourceEvent: TaskCanceled.type,
          correlationId: null,
          timestamp: e.payload.timestamp,
        });
      }),
    );
    this.disposers.push(
      this.bus.subscribe(TaskBlocked, (e) => {
        this.emit({
          kind: 'info',
          title: 'Task waiting',
          body: `A task is blocked until ${e.payload.blockedBy.length} upstream task(s) succeed.`,
          sourceEvent: TaskBlocked.type,
          correlationId: null,
          timestamp: e.payload.timestamp,
        });
      }),
    );
    this.disposers.push(
      this.bus.subscribe(PlanCreated, (e) => {
        this.emit({
          kind: 'info',
          title: 'Plan created',
          body: `A new plan (“${e.payload.goal}”) was created with ${e.payload.taskCount} task(s).`,
          sourceEvent: PlanCreated.type,
          correlationId: e.payload.correlationId,
          timestamp: e.payload.timestamp,
        });
      }),
    );
    this.disposers.push(
      this.bus.subscribe(AgentRegistered, (e) => {
        this.emit({
          kind: 'info',
          title: 'Agent available',
          body: `${e.payload.name} (${e.payload.kind}) joined the studio.`,
          sourceEvent: AgentRegistered.type,
          correlationId: null,
          timestamp: e.payload.timestamp,
        });
      }),
    );
    this.disposers.push(
      this.bus.subscribe(AgentUnregistered, () => {
        // Anonymized: do not leak agent identity beyond the fact one left.
        this.emit({
          kind: 'info',
          title: 'Agent left',
          body: 'An agent was unregistered from the studio.',
          sourceEvent: AgentUnregistered.type,
          correlationId: null,
          timestamp: Date.now(),
        });
      }),
    );
    this.disposers.push(
      this.bus.subscribe(AgentStatusChanged, (e) => {
        if (e.payload.to === 'working') {
          this.emit({
            kind: 'info',
            title: 'Agent working',
            body: `An agent (${e.payload.kind}) started a real operation.`,
            sourceEvent: AgentStatusChanged.type,
            correlationId: null,
            timestamp: e.payload.timestamp,
          });
        }
      }),
    );
  }

  /** Most recent notifications, newest first. */
  list(limit?: number): ReadonlyArray<Notification> {
    const cap = limit ?? this.limit;
    return [...this.notifications].reverse().slice(0, cap);
  }

  markRead(id: NotificationId): void {
    const idx = this.notifications.findIndex((n) => String(n.id) === String(id));
    if (idx === -1) {
      return;
    }
    const existing = this.notifications[idx];
    if (existing === undefined) {
      return;
    }
    this.notifications[idx] = { ...existing, read: true };
  }

  markAllRead(): void {
    for (let i = 0; i < this.notifications.length; i += 1) {
      const existing = this.notifications[i];
      if (existing === undefined) {
        continue;
      }
      this.notifications[i] = { ...existing, read: true };
    }
  }

  private emit(input: {
    readonly kind: NotificationKind;
    readonly title: string;
    readonly body: string;
    readonly sourceEvent: string;
    readonly correlationId: string | null;
    readonly timestamp: number;
  }): void {
    if (this.disposed) {
      return;
    }
    const notification: Notification = {
      id: this.idGenerator() as NotificationId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      sourceEvent: input.sourceEvent,
      correlationId: input.correlationId,
      timestamp: input.timestamp as Timestamp,
      read: false,
    };
    this.notifications.push(notification);
    while (this.notifications.length > this.limit) {
      this.notifications.shift();
    }
    void this.bus.publish(NotificationEmitted, {
      notification,
      timestamp: notification.timestamp,
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const d of this.disposers) {
      d.dispose();
    }
    this.disposers.length = 0;
    this.notifications.length = 0;
  }
}

/**
 * Agent Activity model — a truthful, append-only log of what agents actually did.
 *
 * There is **no** agent "thinking" event. Every record is derived from a real task
 * or agent lifecycle event on the bus. If no real work happened, the log is empty.
 * Each record is also re-published as `intelligence.agent-activity` so downstream
 * consumers (UI adapter seam, Studio Activity feed) observe it uniformly.
 */
export interface AgentActivityLogOptions {
  readonly bus: EventBusContract;
  readonly idGenerator?: () => UUID;
  readonly limit?: number;
}

export class AgentActivityLog implements Disposable {
  private readonly bus: EventBusContract;
  private readonly idGenerator: () => UUID;
  private readonly limit: number;
  private readonly records: AgentActivity[] = [];
  private readonly disposers: Disposable[] = [];
  private disposed = false;

  constructor(options: AgentActivityLogOptions) {
    this.bus = options.bus;
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID() as UUID);
    this.limit = options.limit ?? 200;

    this.disposers.push(
      this.bus.subscribe(TaskSucceeded, (e) =>
        this.record({
          agentId: e.payload.agentId,
          kind: 'task.succeeded',
          message: 'Completed a real operation successfully.',
          taskId: e.payload.taskId,
          timestamp: e.payload.timestamp,
        }),
      ),
    );
    this.disposers.push(
      this.bus.subscribe(TaskFailed, (e) =>
        this.record({
          agentId: e.payload.agentId,
          kind: 'task.failed',
          message: `A real operation failed: ${e.payload.reason}`,
          taskId: e.payload.taskId,
          timestamp: e.payload.timestamp,
        }),
      ),
    );
    this.disposers.push(
      this.bus.subscribe(AgentStatusChanged, (e) =>
        this.record({
          agentId: e.payload.agentId,
          kind: 'agent.status-changed',
          message: `Agent status changed from ${e.payload.from} to ${e.payload.to}.`,
          taskId: null,
          timestamp: e.payload.timestamp,
        }),
      ),
    );
  }

  /** Most recent activity records, newest first. */
  list(limit?: number): ReadonlyArray<AgentActivity> {
    const cap = limit ?? this.limit;
    return [...this.records].reverse().slice(0, cap);
  }

  private record(input: {
    readonly agentId: AgentId;
    readonly kind: string;
    readonly message: string;
    readonly taskId: TaskId | null;
    readonly timestamp: number;
  }): void {
    if (this.disposed) {
      return;
    }
    const agent = this.lookupKind(input.agentId);
    const activity: AgentActivity = {
      id: this.idGenerator(),
      agentId: input.agentId,
      agentKind: agent.kind,
      kind: input.kind,
      message: input.message,
      taskId: input.taskId,
      timestamp: input.timestamp as Timestamp,
    };
    this.records.push(activity);
    while (this.records.length > this.limit) {
      this.records.shift();
    }
    void this.bus.publish(AgentActivityRecorded, {
      activity,
      timestamp: activity.timestamp,
    });
  }

  /**
   * Resolve the agent's kind for a record. The bus metadata does not carry the
   * kind, so we consult the registry via a late-bound lookup; if unknown, we fall
   * back to `unknown` rather than fabricate a label.
   */
  private lookupKind(agentId: AgentId): { kind: string } {
    return registryRef?.find(agentId) ?? { kind: 'unknown' };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const d of this.disposers) {
      d.dispose();
    }
    this.disposers.length = 0;
    this.records.length = 0;
  }
}

/**
/**
 * Late-bound reference to the Agent Registry, set by the kernel module so the
 * activity log can resolve an agent's kind truthfully. Avoids a hard import cycle
 * between the log and the registry.
 */
let registryRef: import('./AgentRegistry').AgentRegistry | null = null;
export function bindAgentRegistry(registry: import('./AgentRegistry').AgentRegistry): void {
  registryRef = registry;
}
