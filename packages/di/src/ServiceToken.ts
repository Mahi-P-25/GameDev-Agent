import type { ServiceContainer } from './ServiceContainer';

/**
 * A typed service identifier used by the {@link ServiceContainer}.
 *
 * The `__type` field is a phantom: it carries the resolved value type `T` at
 * the type level without affecting the runtime shape, giving fully type-safe
 * `resolve<T>()` calls while the registry itself stores plain string ids.
 */
export interface ServiceToken<T> {
  readonly id: string;
  readonly __type?: T;
}

/**
 * Registration of a service. `factory` receives the container so it can pull
 * its own dependencies (constructor injection without a decorator framework).
 */
export interface ServiceDescriptor<T> {
  readonly token: ServiceToken<T>;
  readonly factory: (container: ServiceContainer) => T | Promise<T>;
  readonly singleton: boolean;
}

/**
 * Create a strongly-typed token. Token ids are namespaced strings so they
 * remain debuggable in logs and error messages.
 */
export function createServiceToken<T>(id: string): ServiceToken<T> {
  return { id };
}
