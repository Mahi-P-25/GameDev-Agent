/**
 * Dependency-injection error hierarchy. These failures are raised by the
 * service container while registering or resolving services. They are kept in
 * the DI package itself so DI has no dependency on the kernel.
 */
export class ServiceNotFoundError extends Error {
  constructor(readonly token: string) {
    super(`Service not registered: "${token}"`);
    this.name = new.target.name;
  }
}

export class CircularDependencyError extends Error {
  constructor(readonly token: string) {
    super(`Circular dependency detected while resolving service: "${token}"`);
    this.name = new.target.name;
  }
}

export class DuplicateServiceError extends Error {
  constructor(readonly token: string) {
    super(`Service already registered: "${token}"`);
    this.name = new.target.name;
  }
}
