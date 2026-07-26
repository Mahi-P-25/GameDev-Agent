import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import { ToolAlreadyRegisteredError, ToolNotFoundError } from './ToolErrors';
import type {
  ToolConnection,
  ToolDescriptor,
  ToolHealth,
  ToolId,
  ToolRegistration,
} from './ToolTypes';

/**
 * The in-memory registry of tools known to the runtime.
 *
 * It stores the {@link ToolDescriptor} plus the per-tool {@link ToolConnection}
 * and {@link ToolHealth} bookkeeping the manager maintains, and exposes
 * lookup/list/has semantics. It is intentionally dumb: no events, no policy. The
 * {@link ToolManager} owns orchestration and publishes events around the
 * mutations this registry applies. Keeping the store separate makes it trivial
 * to test and to swap for a persistent backing later.
 */
export class ToolRegistry implements Disposable {
  private readonly entries = new Map<string, ToolRegistration>();
  private disposed = false;

  /** Register a tool. Throws {@link ToolAlreadyRegisteredError} on a duplicate id. */
  register(descriptor: ToolDescriptor, now: Timestamp): ToolRegistration {
    const id = descriptor.id;
    if (this.entries.has(id)) {
      throw new ToolAlreadyRegisteredError(id);
    }
    const registration: ToolRegistration = {
      descriptor,
      connection: {
        toolId: id,
        state: 'disconnected',
        connectedAt: null,
        lastError: null,
        metadata: {},
      },
      health: 'unknown',
      registeredAt: now,
    };
    this.entries.set(id, registration);
    return registration;
  }

  /** Remove a tool entirely. No-op safe when absent. */
  unregister(id: ToolId): void {
    this.entries.delete(id);
  }

  /** Whether a tool is registered. */
  has(id: ToolId): boolean {
    return this.entries.has(id);
  }

  /** Fetch a tool's registration, or throw {@link ToolNotFoundError}. */
  get(id: ToolId): ToolRegistration {
    const entry = this.entries.get(id);
    if (entry === undefined) {
      throw new ToolNotFoundError(id);
    }
    return entry;
  }

  /** Fetch a tool's registration, or `undefined` when absent. */
  find(id: ToolId): ToolRegistration | undefined {
    return this.entries.get(id);
  }

  /** All registered tools, in insertion order. */
  list(): ReadonlyArray<ToolRegistration> {
    return [...this.entries.values()];
  }

  /** Replace the stored connection snapshot for a tool. */
  setConnection(id: ToolId, connection: ToolConnection): void {
    const entry = this.mustHave(id);
    this.entries.set(id, { ...entry, connection });
  }

  /** Replace the stored health for a tool. */
  setHealth(id: ToolId, health: ToolHealth): void {
    const entry = this.mustHave(id);
    this.entries.set(id, { ...entry, health });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.entries.clear();
  }

  private mustHave(id: ToolId): ToolRegistration {
    const entry = this.entries.get(id);
    if (entry === undefined) {
      throw new ToolNotFoundError(id);
    }
    return entry;
  }
}
