# @gamedev-agent/planner

**Nova Planning Engine** — the domain service that turns an *approved* **Mission
Tree** (a `MissionProposal` handed over by the Producer via the Coordinator) into
an **immutable Execution Plan**: dependency-ordered **phases**, parallel-capable
**groups**, and explicit **constraints**.

> Nova is not a chatbot and not another AI coding assistant. It is an operating
> system for building games. The Creative Director describes a **Goal**; the
> Producer decomposes it into a **Mission Tree**; the Coordinator decides
> execution. **The Planner sits between the Producer and the Workflow Engine**: it
> takes the *approved* tree and lays out *how* the work should run — without ever
> running it.

This package implements **only** the Planning Engine (Sprint 13). It integrates
with the Producer (receives the approved tree), the Coordinator (ties plans to
Missions), the Workflow Engine (consumes the plan via `toWorkflowSource`), the
Studio API (surfaces plans), and the Event Bus (publishes plan lifecycle events).
The Planner is **not an execution engine** and **calls no model** — it produces a
plan; the Workflow Engine executes it.

---

## Why the Planner exists

Before the Planner, the only bridge from a Mission Tree to execution was the tree
itself: a flat list of proposed missions with dependency edges. That leaves the
*how* of execution — phasing, parallelism, ordering, and constraint enforcement —
to be rediscovered by every consumer.

The Planner makes that decision explicit and shared. Given an approved tree it
produces one agreed contract (`ExecutionPlan`) that:

- groups work into **phases** aligned to the Producer's milestones (so "foundations
  before content" is enforced, not hoped for);
- packs each phase into **execution groups** that encode which steps are
  *independently dispatchable* (`parallel`) versus strictly ordered (`sequential`);
- records **constraints** (dependencies, required capabilities/roles, approval
  gates) that downstream systems enforce;
- bridges to the Workflow Engine through a single `toWorkflowSource()` method,
  so neither package knows the other's internals.

## What the Planner does *not* do

The Planner is deliberately narrow. It performs **no** LLM, Memory, Knowledge,
Role, or Execution work. It does not schedule wall-clock time, allocate workers,
or mutate the tree. Those concerns belong to later subsystems behind the
future-integration seams documented below. This keeps the engine deterministic,
testable, and free of the execution/AI surface that other sprints own.

---

## Architecture

```
 MissionProposal (Producer, via Coordinator / mission-proposal.ready)
        │
        ▼
 ┌─────────────────────────────────────────────┐
 │  PlannerManager (orchestrator + integration) │
 │   • strategy selection (by name)             │
 │   • approval guard                           │
 │   • stores plan (PlannerRegistry)            │
 │   • publishes plan.requested / plan.created  │
 │     / plan.failed on the Event Bus           │
 └─────────────────────────────────────────────┘
        │  delegates graph construction to a
        ▼
 ┌─────────────────────────────────────────────┐
 │  Planner (engine)                            │
 │   • validateProposal (acyclic, resolvable)   │
 │   • wraps the plan immutable (Object.freeze) │
 │   • toWorkflowSource() bridge                │
 └─────────────────────────────────────────────┘
        │  uses
        ▼
 ┌─────────────────────────────────────────────┐
 │  PlanningStrategy (DependencyGraphStrategy,  │
 │   SequentialPlanningStrategy, future AI ...)  │
 └─────────────────────────────────────────────┘
        │
        ▼
 ExecutionPlan  ──toWorkflowSource()──▶  WorkflowSource  (Workflow Engine)
```

### Core types

- **`ExecutionPlan`** — the immutable output. Frozen on creation; carries phases,
  a flat topological `order`, the step map, constraints, and `toWorkflowSource()`.
- **`ExecutionPhase`** — a milestone-aligned slice of work containing ordered
  groups.
- **`ExecutionGroup`** — a set of steps with a `mode`: `parallel` marks them
  independently dispatchable; `sequential` runs them in listed order.
- **`ExecutionStep`** — one planned unit of work derived from a `ProposedMission`,
  with dependency edges (as planned-step ids), estimated role/capability needs,
  and the originating node id for traceability.
- **`ExecutionConstraint`** — a recorded rule (`dependency`, `capability`, `role`,
  `approval-gate`, `deadline`, `budget`, `data-flow`) enforced downstream.

### Strategies (the AI seam)

A `PlanningStrategy` decides *how* a Mission Tree becomes a plan. The package
ships two deterministic strategies:

- **`DependencyGraphStrategy`** (default) — builds milestone phases, then computes
  topological ready-set waves within each phase and packs them into groups. In
  `parallel` mode each wave is one multi-step group; in `sequential` mode each
  node is its own group.
- **`SequentialPlanningStrategy`** — a flat baseline: every node in one phase, one
  step per group, in the Producer's declared `order`.

Future **AI-enhanced planning** (e.g. an `ai-balanced` strategy that re-groups for
throughput or cost) plugs in by implementing the same `PlanningStrategy` interface
and registering under a name — no engine or Workflow changes required.

### Events

| Event | When | Payload |
|-------|------|---------|
| `plan.requested` | a plan was asked for | `proposalId`, `missionId`, `strategy` |
| `plan.created` | a plan was built & stored | `planId`, `proposalId`, `goalId`, `projectId`, `missionId`, `strategy`, `mode`, `phaseCount`, `stepCount` |
| `plan.failed` | planning threw | `proposalId`, `reason` |

The Planner publishes only through the shared Event Bus — it never calls the
Workflow Engine, Coordinator, or Studio API directly. This is how those subsystems
observe planning without the Planner depending on them.

---

## Usage

```ts
import { PlannerManager, PLANNER_MANAGER_TOKEN, plannerModule } from '@gamedev-agent/planner';

// 1. As a kernel module (preferred): registers PLANNER_MANAGER_TOKEN on boot.
kernel.registerModule(plannerModule);

// 2. Or construct directly with injected abstractions (test-friendly).
const manager = new PlannerManager({ eventBus, logger });

// Plan an approved proposal (handed over by the Producer/Coordinator).
const planId = await manager.plan(proposal, { missionId: null, mode: 'parallel' });

// Hand the immutable plan to the Workflow Engine.
const plan = manager.getPlan(planId);
const source: WorkflowSource = plan.toWorkflowSource();
```

### Auto-planning on approval

Enable `autoPlan` so the manager plans any `mission-proposal.ready` event it sees
on the bus:

```ts
const manager = new PlannerManager({ eventBus, logger, autoPlan: true });
```

---

## Testing

```bash
pnpm --filter @gamedev-agent/planner typecheck
pnpm --filter @gamedev-agent/planner lint
pnpm --filter @gamedev-agent/planner test
pnpm --filter @gamedev-agent/planner build
```

`test_helpers.ts` provides `makeMissionProposal`, `makeNode`, `FakeEventBus`,
`FixedClock`, and `SequenceIdGenerator` doubles so tests stay framework-free and
fast.

---

## Future integration seams

These interfaces are defined but intentionally unused today, so later sprints can
extend planning without touching the engine:

- **`PlanningContextProvider`** — supply runtime context (Memory, Knowledge,
  active Workers) to a strategy without the engine depending on those subsystems.
- **`StepAssignmentAdvisor`** — suggest role/capability assignment per step,
  refining the Producer's estimates once the Role System and Knowledge exist.

The Planner's contract is stable: it will always turn an approved tree into an
immutable, Workflow-consumable plan. How it groups and orders that work is the
strategy's job — and strategies are pluggable.
