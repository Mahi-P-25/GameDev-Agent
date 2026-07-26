# @gamedev-agent/coordinator

**Nova Studio Coordinator** — the orchestration entry point that owns the
lifecycle and state of every **Mission** in Nova, the AI-native Operating System
for Game Development.

> Nova is not a chatbot and not another AI coding assistant. It is an operating
> system for building games. The Creative Director directs Nova by submitting
> **Missions**; the Coordinator is the component that receives every Mission,
> owns its state from submission to completion, and coordinates the Roles and
> approvals a Mission needs.

This package implements **only** the Coordinator (Sprint 5). It integrates
exclusively with the Kernel, the Event Bus, and the Project System. It performs
**no** execution, AI, planning, memory, or knowledge work itself — those arrive
in later sprints as subsystems the Coordinator hands off to through the
interfaces defined here.

---

## What a Mission is

A **Mission** is the unit of planned work the Creative Director directs Nova to
perform ("build the boss fight", "add controller support"). Every Mission
belongs to a **Project** (`projectId`) — it inherits that project's identity and
namespaces. The Coordinator is the single owner of a Mission's truth: its
status, its derived role requirements, its approval gate, and the execution
context it eventually hands off.

Workers in Nova are **Roles** (responsibilities such as `gameplay-engineer` or
`technical-artist`), not models. The Coordinator *records* which roles a Mission
requires and which have been assigned; it never resolves or invokes a Role — the
future Role System does that.

## The Mission lifecycle

The Coordinator owns this state machine exclusively (see `CoordinatorState.ts`):

```
submitted → accepted → analysing → waiting_for_approval → approved
         → ready → executing → reviewing → completed
                             ↘ failed | cancelled
```

- **Approval is a gate, not a requirement.** A Mission that needs sign-off moves
  `analysing → waiting_for_approval → approved → ready`. One that does not moves
  `analysing → ready` directly.
- **`executing` → `reviewing` → `completed`** is the happy execution path;
  `reviewing → executing` allows sending work back.
- **`failed`/`cancelled`** are reachable from active states and are terminal.
- Terminal states transition nowhere; illegal moves throw `MissionStateError`.

Pausing execution and reporting progress are *signals* while a Mission stays in
`executing` — they update state and emit events without being lifecycle states
of their own.

## Events

Every transition publishes a strongly-typed event over the shared Event Bus
(see `CoordinatorEvents.ts`), following the `mission.<pastTenseVerb>` convention:

| Event | Emitted when |
| ----- | ------------ |
| `mission.submitted` | a Mission is submitted |
| `mission.accepted` | a Mission is accepted (carries role requirements) |
| `mission.analysing` | analysis begins |
| `mission.approval-requested` | an approval gate is raised |
| `mission.approved` | the gate is resolved |
| `mission.ready` | the Mission is ready to execute |
| `mission.execution-started` | execution begins (carries `ExecutionContext`) |
| `mission.execution-paused` | execution is paused |
| `mission.reviewing` | the Mission enters review |
| `mission.completed` | the Mission finishes |
| `mission.failed` | the Mission fails (carries reason) |
| `mission.cancelled` | the Mission is cancelled (carries reason) |

Subscribers bind to the exported `EventDefinition` (e.g. `MissionCompleted`), not
a magic string, so payloads are fully typed. This is how future subsystems
(Roles, Planner, Execution, Memory, Knowledge) observe Mission progress without
the Coordinator depending on them.

## Future-integration interfaces

The Coordinator defines — but does not implement — the contracts later packages
fulfil (see `CoordinatorTypes.ts`):

| Interface | Filled by |
| --------- | --------- |
| `CapabilityRequirement`, `RoleRequirement` | Role System / Planner |
| `RoleAssignment` | Role System |
| `ApprovalRequest` | approval workflow (raised here, resolved by the Director) |
| `MissionContext` | read by Planner and Roles |
| `ExecutionContext`, `ExecutionPlan`, `ExecutionStep` | Execution subsystem / Planner |

The Coordinator already carves out the slots these subsystems will fill. When
they land, they read a Mission's context and write assignments/plans back — no
redesign required.

## Architecture

The package mirrors the Project System's layering:

- **`CoordinatorTypes`** — the `Mission` aggregate, lifecycle, and future
  interfaces.
- **`CoordinatorState`** — the pure, dependency-free transition table.
- **`Coordinator`** — factory/validation: builds and immutably transitions
  `Mission` aggregates. `Clock`/`IdGenerator` are injected for determinism.
- **`MissionRegistry`** — the only component that stores missions in memory.
- **`CoordinatorManager`** — orchestration: the lifecycle surface, transition
  guards, and event emission. Depends only on `EventBusContract` and `Logger`.
- **`CoordinatorErrors`** — the error hierarchy (`CoordinatorError` and subtypes).
- **`CoordinatorModule`** — the `KernelModule` that installs the manager.

## Integrating with the Kernel

The package ships a `coordinatorModule`. Registering it during `kernel.boot()`
makes `CoordinatorManager` resolvable via `COORDINATOR_MANAGER_TOKEN`.
Construction is deferred to the `register` phase so the manager can pull the
shared Event Bus and Logger. The Coordinator depends only on the kernel's public
`KernelModule`/`ServiceToken` surface — it never imports kernel internals, and
the dependency arrow never points back.

```ts
import { coordinatorModule, COORDINATOR_MANAGER_TOKEN } from '@gamedev-agent/coordinator';

kernel.registerModule(coordinatorModule);
await kernel.boot();

const coordinator = kernel.container.resolve(COORDINATOR_MANAGER_TOKEN);
const mission = await coordinator.submit({
  projectId,
  title: 'Build the boss fight',
  brief: 'Design and implement the final boss encounter.',
  priority: 'high',
  requiredCapabilities: [{ capability: 'gameplay-engineering' }],
});
await coordinator.accept(mission.id);
await coordinator.analyse(mission.id);
await coordinator.markReady(mission.id);
await coordinator.startExecution(mission.id);
await coordinator.review(mission.id);
await coordinator.complete(mission.id);
```

## Scripts

```
pnpm --filter @gamedev-agent/coordinator build      # bundle + d.ts
pnpm --filter @gamedev-agent/coordinator typecheck  # tsc --noEmit
pnpm --filter @gamedev-agent/coordinator lint       # biome check src
pnpm --filter @gamedev-agent/coordinator test       # vitest run
```
