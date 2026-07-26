import { ToolConnectionError, ToolNotConnectedError } from './ToolErrors';
import type { Json, ToolConnection, ToolConnectionState, ToolId } from './ToolTypes';
import type { ToolHandler } from './ToolTypes';

/**
 * Drives a single tool's connection lifecycle through the runtime's state
 * machine:
 *
 * ```
 * disconnected → connecting → connected → disconnecting → disconnected
 *                              ↘ error
 * ```
 *
 * The machine is the *only* place that calls the handler's `connect`/`disconnect`
 * and that decides whether a transition is legal. It keeps the
 * {@link ToolConnection} snapshot (state, connectedAt, lastError, metadata) in
 * sync and validates every move against the current state so a tool can never
 * be left in an inconsistent connection state.
 */
export class ToolConnectionStateMachine {
  private state: ToolConnectionState = 'disconnected';
  private connectedAt: number | null = null;
  private lastError: string | null = null;
  private metadata: Readonly<Record<string, Json>> = {};

  constructor(private readonly toolId: ToolId) {}

  /** Current connection snapshot. */
  snapshot(): ToolConnection {
    return {
      toolId: this.toolId,
      state: this.state,
      connectedAt: this.connectedAt as never,
      lastError: this.lastError,
      metadata: this.metadata,
    };
  }

  /** Whether a live connection is currently established. */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Connect the tool via its handler. Enforces `disconnected → connecting →
   * connected` (or recovers from `error`). Throws {@link ToolConnectionError} on
   * a failed connect or an illegal transition. Records `connectedAt` on success.
   */
  async connect(handler: ToolHandler, config?: Readonly<Record<string, Json>>): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }
    if (this.state === 'disconnecting') {
      throw new ToolConnectionError(this.toolId, 'cannot connect while disconnecting');
    }
    this.state = 'connecting';
    this.lastError = null;
    try {
      await handler.connect(config);
    } catch (error) {
      this.state = 'error';
      this.lastError = error instanceof Error ? error.message : String(error);
      throw new ToolConnectionError(this.toolId, this.lastError, { cause: error });
    }
    if (!handler.isConnected()) {
      this.state = 'error';
      this.lastError = 'handler reported no connection after connect()';
      throw new ToolConnectionError(this.toolId, this.lastError);
    }
    this.state = 'connected';
    this.connectedAt = Date.now();
    this.metadata = config ?? {};
  }

  /**
   * Disconnect the tool via its handler. Enforces `connected → disconnecting →
   * disconnected` (or `error → disconnected`). Safe when already disconnected.
   */
  async disconnect(handler: ToolHandler): Promise<void> {
    if (this.state === 'disconnected') {
      return;
    }
    if (this.state === 'connecting') {
      throw new ToolConnectionError(this.toolId, 'cannot disconnect while connecting');
    }
    this.state = 'disconnecting';
    try {
      await handler.disconnect();
    } catch (error) {
      this.state = 'error';
      this.lastError = error instanceof Error ? error.message : String(error);
      throw new ToolConnectionError(this.toolId, this.lastError, { cause: error });
    }
    this.state = 'disconnected';
    this.connectedAt = null;
    this.lastError = null;
    this.metadata = {};
  }

  /**
   * Require a live connection, throwing {@link ToolNotConnectedError} otherwise.
   * Invoked by the manager before routing an invocation.
   */
  requireConnected(): void {
    if (!this.isConnected()) {
      throw new ToolNotConnectedError(this.toolId);
    }
  }

  /** Force into the `error` state with a message (used by health monitoring). */
  markError(message: string): void {
    this.state = 'error';
    this.lastError = message;
  }

  /** Reset to `disconnected` (used on dispose). */
  reset(): void {
    this.state = 'disconnected';
    this.connectedAt = null;
    this.lastError = null;
    this.metadata = {};
  }
}
