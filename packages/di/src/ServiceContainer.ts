import { isDisposable } from '@gamedev-agent/shared';
import type { ServiceDescriptor, ServiceToken } from './ServiceToken';
import { CircularDependencyError, DuplicateServiceError, ServiceNotFoundError } from './errors';

/**
 * The kernel's dependency-injection container and service registry.
 *
 * Design goals:
 * - Type-safe by token (`resolve<T>` returns the token's `T`).
 * - Lazy: factories run on first `resolve`, never eagerly.
 * - Singleton or transient via the descriptor flag.
 * - Cycle-safe: a stack tracks in-flight resolutions and throws a precise
 *   {@link CircularDependencyError} instead of stack-overflowing.
 * - Dispose-aware: singleton instances implementing `Disposable` are disposed
 *   together when the container is torn down.
 */
export class ServiceContainer {
  private readonly descriptors = new Map<string, ServiceDescriptor<unknown>>();
  private readonly instances = new Map<string, unknown>();
  private readonly building = new Set<string>();
  private disposing = false;

  /** Register a service. Throws on duplicate id (fail-fast, no silent override). */
  register<T>(descriptor: ServiceDescriptor<T>): this {
    const id = descriptor.token.id;
    if (this.descriptors.has(id)) {
      throw new DuplicateServiceError(id);
    }
    this.descriptors.set(id, descriptor as ServiceDescriptor<unknown>);
    return this;
  }

  has<T>(token: ServiceToken<T>): boolean {
    return this.descriptors.has(token.id);
  }

  async resolve<T>(token: ServiceToken<T>): Promise<T> {
    const id = token.id;
    const descriptor = this.descriptors.get(id);
    if (descriptor === undefined) {
      throw new ServiceNotFoundError(id);
    }
    if (descriptor.singleton && this.instances.has(id)) {
      return this.instances.get(id) as T;
    }
    if (this.building.has(id)) {
      throw new CircularDependencyError(id);
    }
    this.building.add(id);
    try {
      const value = await descriptor.factory(this);
      if (descriptor.singleton) {
        this.instances.set(id, value);
      }
      return value as T;
    } finally {
      this.building.delete(id);
    }
  }

  /** Resolve if registered, otherwise `undefined` (non-throwing). */
  async resolveOptional<T>(token: ServiceToken<T>): Promise<T | undefined> {
    return this.has(token) ? await this.resolve(token) : undefined;
  }

  /** Dispose every singleton instance that is `Disposable`, then forget them.
   *  Instances whose token is listed in `exclude` are left untouched (the
   *  kernel uses this to keep its own core subsystems out of container
   *  disposal and avoid re-entrant teardown). Re-entrancy is guarded so a
   *  disposable whose `dispose()` resolves back into this container can never
   *  recurse. */
  async dispose(exclude?: ReadonlyArray<ServiceToken<unknown>>): Promise<void> {
    if (this.disposing) {
      return;
    }
    this.disposing = true;
    try {
      const skip = new Set(exclude?.map((token) => token.id));
      for (const [id, instance] of this.instances) {
        if (skip.has(id)) {
          continue;
        }
        if (isDisposable(instance)) {
          await instance.dispose();
        }
      }
      this.instances.clear();
    } finally {
      this.disposing = false;
    }
  }
}

export type { ServiceToken, ServiceDescriptor } from './ServiceToken';
