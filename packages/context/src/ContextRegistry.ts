import { ContextNotFoundError } from './ContextErrors';
import type { ContextId, CurrentContext } from './ContextTypes';

/**
 * The Context Registry is the dumb, in-memory store for the singleton
 * {@link CurrentContext}. It owns no domain logic, no events, and no validation
 * beyond identity — the manager orchestrates transitions and validation.
 *
 * The Context Engine tracks exactly one context at a time (the live studio
 * session), so the registry is keyed by context id and guarantees a single
 * resident instance.
 */

export class ContextRegistry {
  private readonly byId = new Map<ContextId, CurrentContext>();

  get size(): number {
    return this.byId.size;
  }

  /** Store a context, replacing any prior instance with the same id. */
  add(context: CurrentContext): void {
    this.byId.set(context.id, context);
  }

  /** Return the single resident context, or `undefined` when none exists. */
  current(): CurrentContext | undefined {
    return this.byId.values().next().value;
  }

  /** Fetch a context by id, throwing {@link ContextNotFoundError} when absent. */
  get(id: ContextId): CurrentContext {
    const context = this.byId.get(id);
    if (context === undefined) {
      throw new ContextNotFoundError('contextId', String(id));
    }
    return context;
  }

  /** Fetch a context by id, or `undefined` when absent. */
  find(id: ContextId): CurrentContext | undefined {
    return this.byId.get(id);
  }

  /** Whether a context with the given id is resident. */
  has(id: ContextId): boolean {
    return this.byId.has(id);
  }

  /** Replace an existing context. Throws {@link ContextNotFoundError} if absent. */
  update(context: CurrentContext): void {
    if (!this.byId.has(context.id)) {
      throw new ContextNotFoundError('contextId', String(context.id));
    }
    this.byId.set(context.id, context);
  }

  /** Remove the resident context. No-op when none exists. */
  remove(id: ContextId): void {
    this.byId.delete(id);
  }

  /** Drop every resident context (used on shutdown). */
  clear(): void {
    this.byId.clear();
  }
}
