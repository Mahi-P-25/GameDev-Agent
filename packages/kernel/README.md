# @gamedev-agent/kernel

The **kernel** — the lifecycle and composition runtime of GameDev Agent.

The kernel is a generic, long-lived runtime. It owns the lifecycle and wires
together the four foundational subsystems (logging, events, configuration,
services). It does **not** know about workflows, memory, AI models, or game
engines — those arrive later as `KernelModule`s.

## Why the kernel exists

A multi-agent, plugin-extensible system needs a single authority for lifecycle
and coordination. The kernel is the trust and coordination root that makes every
other subsystem modular and replaceable: it boots them, shuts them down, and
hands out shared infrastructure. Keeping it thin means scaling happens by adding
modules, not by bloating the kernel.

## Responsibilities (only)

| Concern           | Mechanism                                                          |
| ----------------- | ----------------------------------------------------------------- |
| Lifecycle         | `Kernel.boot()` / `Kernel.shutdown()` with guarded states         |
| Startup / shutdown| Two-phase module bootstrap (register → boot), LIFO teardown       |
| Boot sequence     | Subsystem init, then module registration, then module boot        |
| Service init      | Registers the core subsystems as singletons into the DI container |
| Module loading    | `KernelModule` registration + `ModuleManager`                     |

It deliberately delegates concrete implementations to sibling packages: the DI
container to `@gamedev-agent/di`, config to `@gamedev-agent/config`, logging to
`@gamedev-agent/logging`, events to `@gamedev-agent/events`.

## Why DI is separate

Dependency injection is a generic primitive, not a kernel concern. Housing it in
`@gamedev-agent/di` lets it be reused and tested in isolation, and keeps the
dependency graph acyclic: `kernel → di`, never the reverse. The kernel depends on
DI and re-exposes `ServiceContainer` / `createServiceToken` so module authors can
register services through one boundary.

## Public API

- `Kernel`, `StudioKernel`, `KernelModule`, `KernelOptions`, `KernelState`
- `ModuleManager`
- `ServiceContainer`, `ServiceToken`, `ServiceDescriptor`, `createServiceToken`
- Core service tokens: `KERNEL_TOKEN`, `LOGGER_TOKEN`, `EVENT_BUS_TOKEN`,
  `CONFIG_TOKEN`, `SERVICES_TOKEN`
- Kernel error hierarchy: `KernelError` (+ `KernelStateError`, `DuplicateModuleError`)

## Defaults (overridable)

The kernel is self-bootstrapping: with no options it uses `InMemoryEventBus`,
`RootLogger` + `ConsoleLogSink`, and `MemoryConfigSource` — all from their own
packages. Any of these can be replaced via `KernelOptions`.

## Extension model

Everything domain-specific is a `KernelModule`:

```ts
const myModule: KernelModule = {
  name: 'my-capability',
  register(kernel) {
    kernel.registerService({ token: MY_TOKEN, singleton: true, factory: () => new MyService() });
  },
  async boot(kernel) {
    kernel.logger.info('my-capability ready');
  },
};

const kernel = new Kernel({ modules: [myModule] });
await kernel.boot();
```

## Disposal ownership

During teardown, `ModuleManager.shutdownAll` (reverse order) runs first, then the
**module-registered** singletons are disposed through the container. The kernel's own
core subsystems (`KERNEL_TOKEN`, `LOGGER_TOKEN`, `EVENT_BUS_TOKEN`, `CONFIG_TOKEN`,
`SERVICES_TOKEN`) are intentionally **excluded** from container disposal: they are
registered as singletons that resolve back to the kernel/container themselves, so
disposing them would recurse into `shutdown()`. The event bus is disposed last,
directly, so it can still carry the `kernel:shutdown` / `lifecycle:halted` events.

## Dependency direction

```
shared  ←  di, config, events, logging  ←  kernel  ←  apps / modules
```

`shared` depends on nothing. `di`/`config`/`events`/`logging` depend only on
`shared` (and `config` additionally on `logging` types). `kernel` depends on all
of them. No package depends on `kernel`.
