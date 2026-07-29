import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import { ToolLifecycleChanged } from './ToolEvents';
import type { ToolManager } from './ToolManager';
import type {
  LifecycleManagerOptions,
  LifecycleState,
  ToolId,
  ToolLifecycleStage,
} from './ToolTypes';

/**
 * LifecycleManager — manages the lifecycle stages of tools.
 *
 * Stages flow: discovered → registered → connected → ready → disconnected → unregistered
 * Errors can interrupt at any stage.
 *
 * The LifecycleManager observes tool registration, connection, and health
 * events to track each tool's lifecycle stage without tight coupling.
 */
export class LifecycleManager implements Disposable {
  private readonly toolManager: ToolManager;
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly autoConnect: boolean;
  private readonly states = new Map<ToolId, LifecycleState>();
  private disposed = false;

  constructor(options: LifecycleManagerOptions) {
    this.toolManager = options.toolManager;
    this.bus = options.eventBus;
    this.logger =
      options.logger ?? new RootLogger('nova.lifecycle-manager', [new ConsoleLogSink()]);
    this.autoConnect = options.autoConnect ?? true;
    void this.logger;
  }

  /**
   * Transition a tool to a new lifecycle stage.
   * Emits tool.lifecycle.changed on every transition.
   */
  transition(toolId: ToolId, stage: ToolLifecycleStage, error?: string): LifecycleState {
    const previous = this.states.get(toolId);
    const previousStage = previous?.stage ?? 'discovered';
    const now = Date.now() as Timestamp;

    const state: LifecycleState = {
      toolId,
      stage,
      startedAt: previous?.startedAt ?? now,
      ...(error !== undefined ? { error } : {}),
    };

    this.states.set(toolId, state);

    if (previous === undefined || previousStage !== stage) {
      void this.bus.publish(ToolLifecycleChanged, {
        toolId,
        stage,
        previous: previousStage,
        timestamp: now as unknown as number,
      });
    }

    return state;
  }

  /**
   * Get the current lifecycle state for a tool.
   */
  getState(toolId: ToolId): LifecycleState | undefined {
    return this.states.get(toolId);
  }

  /**
   * Get all tools in a given lifecycle stage.
   */
  getByStage(stage: ToolLifecycleStage): readonly LifecycleState[] {
    return [...this.states.values()].filter((s) => s.stage === stage);
  }

  /**
   * Discover a tool (before registration).
   */
  discover(toolId: ToolId): void {
    this.transition(toolId, 'discovered');
  }

  /**
   * Mark a tool as registered. If autoConnect is enabled, connects it.
   */
  async registered(toolId: ToolId): Promise<void> {
    this.transition(toolId, 'registered');
    if (this.autoConnect) {
      await this.connect(toolId);
    }
  }

  /**
   * Connect a tool and transition to ready.
   */
  async connect(toolId: ToolId): Promise<void> {
    this.transition(toolId, 'connected');
    try {
      if (this.toolManager.isConnected(toolId)) {
        this.transition(toolId, 'ready');
      }
    } catch {
      this.transition(toolId, 'error', `failed to connect tool "${toolId}"`);
    }
  }

  /**
   * Disconnect a tool.
   */
  disconnect(toolId: ToolId): void {
    this.transition(toolId, 'disconnected');
  }

  /**
   * Mark a tool as unregistered.
   */
  unregistered(toolId: ToolId): void {
    this.transition(toolId, 'unregistered');
    this.states.delete(toolId);
  }

  /**
   * Mark a tool as errored.
   */
  error(toolId: ToolId, message: string): void {
    this.transition(toolId, 'error', message);
  }

  /**
   * Reset all lifecycle states.
   */
  reset(): void {
    this.states.clear();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.states.clear();
  }
}
