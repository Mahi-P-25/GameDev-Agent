# @gamedev-agent/workflow

**Nova Workflow Engine** — coordinates execution of **approved Mission Trees**: it
determines *execution order*, *respects dependencies*, and provides *pause*,
*resume*, *cancel*, and *retry* control. It is the engine that turns an approved
plan into a running, observable, recoverable workflow.

> The Producer *proposes* Mission Trees. The Coordinator *owns the Mission
> lifecycle*. The Workflow Engine decides **what runs, in what order, and under
> which control signals**. It performs **no** execution itself — real step work is
> delegated to a future Execution Engine / Role System through the
> `StepExecutor` interface defined here. It integrates only with the Coordinator,
> the Capability framework, the Event Bus, and the Studio API.

This package implements **only** the Workflow Engine (Sprint 11). It performs **no**
AI, Memory, Knowledge, Planning, or Role execution — those arrive later as
subsystems the engine hands off to through interfaces defined here.

---

## Why Workflow is separate from Producer and Coordinator

Nova keeps three concerns cleanly apart so each can evolve independently:

| Concern | Owner | Responsibility |
| ------- | ----- | -------------- |
| **What work exists** | **Producer** | Proposes Mission Trees (candidate work, goals, capabilities). |
| **Mission lifecycle & approvals** | **Coordinator** | Owns the Mission from submission to approval; gates the work. |
| **How approved work executes** | **Workflow Engine** | Orders steps, enforces dependencies, drives execution, applies control signals. |

Separating them matters because:

- **Different rates of change.** The Producer's proposal logic (and the Planner
  that will replace/adorn it) changes far more often than the mechanical concern
  of *running an ordered plan*. Coupling them would force the execution engine to
  re-test whenever proposal strategy changes.
- **Different failure domains.** A bad *plan* (Producer) is a different failure
  than a step that *failed at runtime* (Workflow). Keeping the Workflow Engine
  independent lets it stay available, observable, and pausable even while the
  Producer is being reworked.
- **Single source of execution truth.** Once a Mission Tree is approved, exactly
  one component owns "what step runs next, is it blocked, paused, or done". That
  is the Workflow Engine — not the Coordinator (which stops at approval) and not
  the Producer (which stops at proposal).
- **Testability.** The planner and state machine are pure and dependency-free, so
  ordering, dependency validation, and pause/resume/cancel/retry are exhaustively
  unit-tested without any AI, memory, or execution backend.

The engine never imports the Producer. It accepts *any* tree-shaped,
dependency-bearing source through the `WorkflowSource` interface, so the Producer's
approved Mission Tree plugs in without a compile-time dependency in either
direction.

---

## The Workflow lifecycle

The Workflow Engine owns this state machine exclusively (see `WorkflowState.ts`):

```
created → planned → running → completed
                    ↘ failed | cancelled
```

- **`created`** — the run has been instantiated from a definition/source.
- **`planned`** — the engine has produced a valid, dependency-ordered execution
  plan. A workflow **cannot run before it is planned**.
- **`running`** — active execution. **Pause is a signal**, not a state: a paused
  run stays in `running` with `paused: true`, mirroring the Coordinator's model.
  This lets a pause halt forward progress without leaving the lifecycle.
- **`completed` / `failed` / `cancelled`** — terminal. No outgoing transitions;
  an illegal or terminal move throws `WorkflowStateError` / `WorkflowTerminalError`.

### Per-step control

Steps advance independently so the engine can pause/resume/cancel/retry at step
granularity. A step is `pending → running → succeeded | failed | skipped |
cancelled`. Per-step failures respect a retry budget (`plan.maxAttempts`); once
exhausted the run fails (fail-fast). A whole `failed` run can be *retried from the
start* via `retry`.

---

## Execution ordering & dependencies

A `WorkflowDefinition` is a set of `WorkflowStep`s, each declaring the steps it
`dependsOn`. The planner (`Workflow.plan`):

1. Validates: at least one step; unique step ids; every `dependsOn` resolves; no
   cycles.
2. Computes a **topological order** (Kahn sort, declaration-order stable).
3. Partitions that order into **concurrency groups** — waves of mutually
   independent steps.

### Future parallel execution

Concurrency groups are the seam that makes *parallel execution a configuration
change, not a rewrite*:

- Under **`sequential`** mode (today's execution surface), each group holds exactly
  one step, so groups run one at a time in topological order.
- Under a future **`parallel`** mode, a group may contain many steps whose
  dependencies are all satisfied; the future runner dispatches each wave
  concurrently. The grouping is computed **now**, so when the parallel runner lands
  it consumes `concurrencyGroups` directly — the planner, state machine, and
  control signals (pause/resume/cancel/retry) need no changes.

```
sequential:  [a] [b] [c] [d]
parallel:    [a] [b, c] [d]      # b and c have no intra-group dependency
```

The engine is therefore **parallel-ready**: the data structure that encodes
independence already exists; only the dispatch strategy (run groups in series vs.
concurrently) is deferred to a future Execution Engine.

---

## Events

Every transition publishes a strongly-typed event over the shared Event Bus (see
`WorkflowEvents.ts`), following the `workflow.<pastTenseVerb>` convention:

| Event | Emitted when |
| ----- | ------------ |
| `workflow.registered` | a workflow definition is registered |
| `workflow.unregistered` | a definition is removed |
| `workflow.created` | a run is instantiated |
| `workflow.planned` | a run is planned |
| `workflow.started` | execution begins |
| `workflow.paused` | execution is paused |
| `workflow.resumed` | execution is resumed |
| `workflow.cancelled` | execution is cancelled |
| `workflow.completed` | the run finishes |
| `workflow.failed` | the run fails |
| `workflow.step-started` | a step begins an attempt |
| `workflow.step-succeeded` | a step succeeds |
| `workflow.step-failed` | a step fails |
| `workflow.step-retried` | a step is re-armed within budget |
| `workflow.step-skipped` | a step is skipped |

Subscribers bind to the exported `EventDefinition` (e.g. `WorkflowCompleted`), not
a magic string, so payloads are fully typed. This is how future subsystems
(Execution Engine, Roles, Memory, Studio UI) observe workflow progress without the
engine depending on them.

---

## Integration surface

The engine integrates **only** with:

- **Coordinator** — reads approved Mission state (via `MissionId` references on
  runs/sources); the approved Mission Tree is the canonical `WorkflowSource`.
- **Capabilities** — each step may declare `requiredCapability`; the consuming
  application gates dispatch on capability availability (future Execution Engine).
- **Event Bus** — every transition is published; the engine never calls other
  packages directly.
- **Studio API** — progress, state, and control signals are surfaced to Studio UI.

### Future-integration seams (interfaces only, not implemented here)

| Interface | Filled by |
| --------- | --------- |
| `StepExecutor` | Execution Engine / Role System (performs real step work) |
| `WorkflowSource` | Producer (approved Mission Tree adapter) / Planner |
| `requiredRole` | Role System |

These are declared in `WorkflowDefinition.ts`. The engine depends only on the
abstractions (`EventBusContract`, `Logger`, `StepExecutor`) — never on the concrete
Producer, Planner, Roles, or Execution Engine packages.

---

## Architecture

The package is layered for SOLID, dependency-injected testability:

- **`WorkflowDefinition`** — the domain model: `WorkflowStep`, `WorkflowDefinition`,
  `WorkflowPlan`, `WorkflowExecution`, and the future-integration contracts.
- **`WorkflowState`** — the pure, dependency-free transition table.
- **`Workflow`** — the planner: validation + topological order + concurrency groups.
  Pure and dependency-free; `Clock` injected for determinism.
- **`WorkflowExecution`** — the factory/validation for `WorkflowExecution` and
  `WorkflowStepRecord` aggregates. `Clock`/`IdGenerator` injected.
- **`WorkflowRegistry`** — bookkeeping: registered definitions and active runs.
  Emits no events; owns no orchestration.
- **`WorkflowManager`** — orchestration: the lifecycle surface, transition guards,
  event emission, and step driving. Depends only on `EventBusContract`, `Logger`,
  and `StepExecutor`.
- **`WorkflowEvents`** — the typed event catalog.
- **`WorkflowErrors`** — the error hierarchy (`WorkflowError` and subtypes).
- **`WorkflowModule`** — the `KernelModule` that installs the manager.

## Integrating with the Kernel

The package ships `workflowModule`. Registering it during `kernel.boot()` makes
`WorkflowManager` resolvable via `WORKFLOW_MANAGER_TOKEN`. Construction is deferred
to the `register` phase so the manager can pull the shared Event Bus and Logger.

```ts
import { workflowModule, WORKFLOW_MANAGER_TOKEN } from '@gamedev-agent/workflow';

kernel.registerModule(workflowModule);
await kernel.boot();

const workflow = kernel.container.resolve(WORKFLOW_MANAGER_TOKEN);

// Register a reusable workflow definition.
await workflow.register({
  id: 'create-feature' as WorkflowId,
  name: 'Create Feature',
  description: 'Implement a user-requested capability end-to-end.',
  version: '1.0.0',
  mode: 'sequential',
  failFast: true,
  steps: [
    { id: 'plan', title: 'Plan', description: 'Plan implementation', dependsOn: [] },
    { id: 'code', title: 'Code', description: 'Implement', dependsOn: ['plan'] },
    { id: 'test', title: 'Test', description: 'Run tests', dependsOn: ['code'] },
  ],
});

// Create, plan, start, and drive a run (auto-driven when a StepExecutor is set).
const run = await workflow.create({ projectId, workflowId: 'create-feature' as WorkflowId });
await workflow.start(run.id);
```

---

## Testing

Run the suite (24 tests) to exercise:

- **Execution ordering** — linear and diamond DAGs run in topological order.
- **Dependency validation** — empty, duplicate-id, dangling-reference, and cyclic
  graphs are rejected with `WorkflowValidationError`.
- **Pause / Resume** — a paused run stays `running` with `paused: true`; resume
  continues from the cursor.
- **Cancellation** — a running run moves to `cancelled`; in-flight steps are marked
  `cancelled`.
- **Retry** — per-step retry within budget, and whole-run retry from `failed`.

## Scripts

```
pnpm --filter @gamedev-agent/workflow build      # bundle + d.ts
pnpm --filter @gamedev-agent/workflow typecheck  # tsc --noEmit
pnpm --filter @gamedev-agent/workflow lint       # biome check src
pnpm --filter @gamedev-agent/workflow test       # vitest run
```
