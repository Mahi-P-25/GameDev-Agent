# @gamedev-agent/di

The **dependency-injection container** for Nova.

This package owns the type-safe service registry (`ServiceContainer`) and the
token mechanism (`ServiceToken`, `createServiceToken`). It has **zero**
knowledge of the kernel, lifecycle, configuration, logging, or events.

## Why DI is a separate package

- **Independence.** DI is a generic primitive. Keeping it in its own package
  means it can be reused (tests, tools, future subsystems) without pulling in
  the kernel or any runtime subsystem.
- **Direction.** The dependency arrow points one way: `kernel → di`. DI must
  never depend on `kernel` (or on `config`/`events`/`logging`), so the graph
  stays acyclic and the container can be reasoned about in isolation.
- **Testability.** The container compiles and tests alone, with only
  `@gamedev-agent/shared` as a dependency.

## Public API

- `ServiceContainer` — lazy, singleton/transient, cycle-safe, dispose-aware.
- `ServiceToken`, `ServiceDescriptor`, `createServiceToken` — typed tokens.
- `ServiceNotFoundError`, `CircularDependencyError`, `DuplicateServiceError`.

## Dependencies

- `@gamedev-agent/shared` (types + the `isDisposable` guard only).
