# Nova Capability Framework

> SPRINT 6 — Capability Framework. Capabilities own an **action**; Roles own
> **responsibilities** and *compose* Capabilities. This package implements the
> framework only.

The Capability Framework is the work engine of Nova. A **Capability** is a
single, well-bounded action a Role can ask Nova to perform — open a file in VS
Code, run a `git` command, render a Blender scene, drive a browser. A
**Role** (implemented in a later sprint) declares *which* capabilities it needs;
the framework makes those capabilities discoverable, gated, executable, and
observable.

This sprint deliberately implements **no real external execution**. Every
concrete capability (`VSCodeCapability`, `GitCapability`, …) is a typed stub:
it validates its input, records progress, and returns a structured result — but
it never launches `code`, `git`, `blender`, or a browser. The seams for real
integrations are explicit interfaces (see *Future Integrations* below).

---

## What is implemented

| Concern | Type / Class | Responsibility |
| --- | --- | --- |
| Capability contract | `Capability`, `BaseCapability` | Owns one action; wraps `run()` in timing, progress, and structured-error handling. |
| Static descriptor | `CapabilityDescriptor` | The "capability card": id, name, version, category, permissions, platforms, required tools, inputs, outputs, health. |
| Execution context | `CapabilityContext` (impl), `CapabilityContext` (contract) | Per-invocation seam between framework and capability: input, output, progress, abort signal. |
| Result | `CapabilityResult` | Success/failure outcome with duration, output, and structured error. |
| Registry | `CapabilityRegistry` | Authoritative catalog: register/unregister, enable/health state, lookup by id/platform/category. |
| Manager | `CapabilityManager` | Orchestrates the full lifecycle and gates every execution. |
| Errors | `*Error` hierarchy | `CapabilityError` root + `NotFound`/`Disabled`/`Duplicate`/`UnsupportedPlatform`/`PermissionDenied`/`ToolUnavailable`/`Input`/`Execution`. |
| Events | `Capability*` (`CapabilityEvents.ts`) | Typed, versioned event definitions emitted over the shared Event Bus. |
| Kernel glue | `CAPABILITY_MANAGER_TOKEN`, `capabilityModule` | DI token + `KernelModule` installing the manager. |
| Tool probing | `ToolProbe`, `NoopToolProbe` | Single seam for future real tool detection. |

### Lifecycle

```
register ──▶ enable ──▶ [ execute: request ─▶ start ─▶ complete | fail ] ──▶ disable
                                  ▲                                         │
                                  └────────────── health assess ◀─────────┘
```

The manager emits a typed event for **every** transition:

`CapabilityRegistered → CapabilityEnabled → CapabilityDisabled`,
and for execution:
`CapabilityRequested → CapabilityStarted → CapabilityCompleted | CapabilityFailed`,
plus `CapabilityHealthChanged` on health transitions.

### Execution gates

Before a capability runs, `CapabilityManager.execute` enforces four gates, in
order, each emitting `CapabilityFailed` (with a structured `code`) on rejection:

1. **Registered?** — unknown id → `CapabilityNotFoundError`.
2. **Enabled?** — disabled → `code: 'disabled'`.
3. **Supported platform?** — host not in `supportedPlatforms` →
   `UnsupportedPlatformError` / `code: 'unsupported-platform'`.
4. **Granted permissions?** — missing any `permissions` entry →
   `PermissionDeniedError` / `code: 'permission-denied'`.

Input is then validated against the descriptor's `inputs` (required fields), and a
missing field yields `CapabilityInputError` / `code: 'invalid-input'`. Only when
all gates pass does the capability's `run()` execute.

---

## Why Capabilities are separate from Roles

A **Role** is a *responsibility* — "Gameplay Engineer is accountable for
implementing the boss fight." A **Capability** is an *action* — "run `git
commit`." Mixing the two couples *who is responsible* to *how the work is done*,
which breeds three failure modes this separation avoids:

- **Reuse.** Many Roles need the same action. Filesystem, Git, and Terminal
  capabilities are shared by Gameplay Engineers, Technical Artists, and QA
  Engineers alike. Capabilities are leaf nodes; Roles are compositions of them.
- **Independent evolution.** The VS Code integration can be upgraded (remote
  dev, multi-root workspaces) without touching any Role. Conversely a Role's
  composition can change without rewriting capability internals.
- **Uniform governance.** Permissions, platform support, tool availability, and
  health are properties of *actions*, not of *people*. Gating at the capability
  layer means every Role automatically inherits the same safety and observability
  guarantees.

In short: **Roles decide *what* Nova should do; Capabilities decide *how* a
single thing is done.** The framework is the contract between them.

## Why Roles compose Capabilities

Composition (rather than inheritance or a monolithic "do everything" service)
keeps the system open and testable:

- A Role is described as a **set of capability requirements**
  (`{ capability: 'vcs' }`, `{ capability: '3d' }`). The future Role System
  matches requirements to *available, enabled* capabilities.
- Adding a new tool is a single new `Capability` subclass + descriptor — no
  changes to Roles, the Coordinator, or the Kernel.
- Capabilities are independently enable/disable-able and health-checked, so a
  Role can degrade gracefully when (e.g.) Blender is unavailable on a host.

## How future external integrations plug in

The framework is built around three explicit, swappable seams. None require
changing the manager, the registry, the events, or any Role.

1. **Real tool detection — `ToolProbe`.**
   Today `NoopToolProbe` reports every tool as available (so the framework runs
   end-to-end with no host side effects). A later sprint drops in
   `ProcessToolProbe implements ToolProbe` that runs `git --version`,
   `code --version`, etc. The manager calls `probe.isAvailable(tool)` at
   enable time; the rest is untouched.

2. **Real execution — `BaseCapability.run()`.**
   Each example capability's `run(context)` currently validates input and returns
   a structured acknowledgement. Future implementations back the *same*
   `CapabilityContext` contract with the real call (spawn a process, open an
   editor, drive a browser). Because the manager only depends on the
   `Capability` interface and the `CapabilityResult` shape, the swap is
   invisible to callers and observers.

3. **Observability — the Event Bus.**
   Every lifecycle event is already published to the shared `EventBus`. A future
   Coordinator, Role System, or telemetry sink simply `subscribe`s to
   `CapabilityStarted` / `CapabilityCompleted` / `CapabilityFailed` to react —
   the framework never calls them directly.

---

## Integration surface

The framework integrates with exactly three Nova subsystems, and nothing else:

- **Kernel** — via the `capabilityModule` `KernelModule` and the
  `CAPABILITY_MANAGER_TOKEN` DI token. Registering the module during boot makes
  the `CapabilityManager` resolvable from the container; construction is deferred
  so the manager pulls the shared `EventBus` and `Logger`.
- **Coordinator** — resolves the manager from the container and observes
  capability events over the bus. The framework does not import or call the
  Coordinator.
- **Event Bus** — the sole communication backbone. All lifecycle activity is
  emitted as typed `EventDefinition`s.

No AI, Memory, Knowledge, Planner, or Role code is implemented here, and no
real external program is executed.

---

## Usage

```ts
import { capabilityModule, CAPABILITY_MANAGER_TOKEN } from '@gamedev-agent/capabilities';

// 1. Install the module during kernel boot (the only kernel coupling).
kernel.registerModule(capabilityModule);
await kernel.boot();

// 2. Resolve the manager.
const manager = await kernel.services.resolve(CAPABILITY_MANAGER_TOKEN);

// 3. Enable, then execute.
await manager.enable('nova.capability.git');
const result = await manager.execute(
  'nova.capability.git',
  { command: 'commit', message: 'feat: boss fight' },
  { correlationId: missionId },
);
if (result.ok) {
  console.log('committed', result.output);
}
```

### Registering a custom capability

```ts
import { BaseCapability, asCapabilityId } from '@gamedev-agent/capabilities';
import type { CapabilityContext, CapabilityDescriptor } from '@gamedev-agent/capabilities';

const descriptor: CapabilityDescriptor = {
  id: asCapabilityId('acme.capability.lint'),
  name: 'Linter',
  description: 'Run the project linter.',
  version: '1.0.0',
  category: 'build',
  permissions: ['process.spawn'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  requiredTools: [{ name: 'eslint' }],
  inputs: [{ name: 'fix', type: 'boolean', required: false }],
  outputs: [{ name: 'issues', type: 'number', required: true }],
};

class LintCapability extends BaseCapability {
  constructor() {
    super(descriptor);
  }
  protected async run(context: CapabilityContext): Promise<Json> {
    // Future: spawn eslint. Today: acknowledge.
    context.reportProgress(100);
    return { issues: 0 };
  }
}

manager.register(new LintCapability());
```

---

## Testing

Comprehensive unit tests cover the registry, the manager lifecycle + gates +
events, the base capability execution/error semantics, the context, every error
type, the event catalog, the `ToolProbe` seam, and all seven built-in example
capabilities. Run them with:

```bash
pnpm --filter @gamedev-agent/capabilities test
# or, from the package:
npx vitest run
```

Tests use an in-memory `FakeEventBus` and `FakeToolProbe` double so they stay
fast and framework-free.

---

## Design principles

- **Strict TypeScript** — branded ids, `exactOptionalPropertyTypes`, no `any`.
- **SOLID** — single responsibility per class; the manager depends on
  abstractions (`EventBusContract`, `Logger`, `ToolProbe`).
- **Dependency Injection** — bus/logger/probe injected via
  `CapabilityManagerOptions`; the manager is a DI token inside the kernel.
- **Event-driven** — all lifecycle activity is published as typed events; no
  package is called directly.
- **No TODOs** — every type is a complete, production-shaped contract.
