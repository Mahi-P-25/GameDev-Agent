# @gamedev-agent/producer

**Nova Producer** — the domain service that turns a Creative Director's **Goal**
into a structured, reviewable **Mission Proposal** for the Coordinator, in Nova,
the AI-native Operating System for Game Development.

> Nova is not a chatbot and not another AI coding assistant. It is an operating
> system for building games. In Nova the Creative Director **never creates
> Missions directly** — they describe a **Goal** ("I want realistic Formula
> racing"). The Producer analyses that Goal and proposes a Mission Tree. The
> Coordinator decides execution.

This package implements **only** the Producer (Sprint 8). It integrates with the
Kernel, the Event Bus, and the Project System. The Producer is **not an AI
model** — it is a deterministic domain service. It performs **no** LLM, Memory,
Knowledge, Planner, or Role execution work; those arrive in later sprints behind
the future-integration interfaces defined here.

---

## Why the Producer exists

Before the Producer, the only way to get work into Nova was to author a Mission
by hand: pick a title, write a brief, guess the required capabilities, and submit
it to the Coordinator. That places the burden of decomposition on the human and
produces flat, unstructured work with no explicit milestones, dependencies, or
ordering.

The Producer moves that burden into the system. A Creative Director expresses
**intent** — a Goal — and the Producer does the decomposition: it extracts
Objectives, groups them into ordered Milestones, builds a **Mission Tree** with
explicit dependencies and execution order, estimates the Roles and Capabilities
the work needs, and packages it all into an **Approval Package** the Director can
review in one place.

## Why Goals replace manual Mission creation

- **Intent over mechanics.** The Director says *what* they want, not *how* to
  break it down. "Realistic Formula racing" is a Goal; "implement vehicle
  physics", "build the track system", "add AI opponents" are the Missions the
  Producer derives from it.
- **Structure for free.** Manual Missions are flat. A Goal yields a tree with
  parent/child nesting, cross-node dependencies, ordering, per-node priority, and
  estimated complexity — everything the Coordinator needs to schedule work in a
  valid order.
- **A single review gate.** Instead of approving Missions one by one, the
  Director reviews one **Approval Package** that summarizes the whole plan: how
  much work, in how many phases, needing which roles, at what estimated
  complexity.
- **Separation of concerns.** The Producer *proposes*; the Coordinator *decides
  execution*. The Producer never creates Coordinator Missions directly — it emits
  a `MissionProposal` and, on approval, publishes `mission-proposal.ready` for
  the Coordinator to consume.

## The Goal lifecycle

The Producer owns this state machine exclusively (see `ProducerState.ts`):

```
submitted → analysing → objectives_generated → mission_tree_generated
         → review_package_generated → waiting_for_approval → approved
                                                          ↘ rejected
```

- Each analysis phase must complete before the next — **no phase may be
  skipped** (you cannot build the Mission Tree before Objectives exist).
- **Approval is a gate:** `waiting_for_approval` may only advance to `approved`
  or `rejected`.
- On **`approved`**, the Coordinator receives the Mission Tree via
  `mission-proposal.ready`. `approved` and `rejected` are terminal.
- Illegal moves throw `GoalStateError`; illegal input throws `GoalValidationError`.

## What the Producer produces

From a Goal, the analysis + tree building produces:

| Artifact | Description |
| -------- | ----------- |
| `Objective` | A distinct, addressable outcome extracted from the Goal. |
| `Milestone` | An ordered checkpoint grouping one or more Objectives. |
| `MissionTree` | Parent/child `ProposedMission` nodes with `Dependency` edges, an `executionOrder`, per-node priority, and estimated complexity. |
| `RoleEstimate` / `CapabilityEstimate` | The Roles and Capabilities the work is estimated to need. |
| `MissionProposal` | The full package: analysis + tree + approval package. |
| `ApprovalPackage` | The human-facing roll-up the Director approves or rejects. |

The Mission Tree is validated for structural integrity before it is proposed:
no dangling parent/child references, no dependencies to unknown nodes, no
self-dependencies, and **no cycles** (dependency ordering is computed with a
topological sort — Kahn's algorithm — that fails on a cycle).

## Events

Every transition publishes a strongly-typed event over the shared Event Bus
(see `ProducerEvents.ts`), following the `goal.<pastTenseVerb>` convention:

| Event | Emitted when |
| ----- | ------------ |
| `goal.submitted` | a Goal is submitted |
| `goal.analysing` | analysis begins |
| `goal.objectives-generated` | Objectives + Milestones are produced (carries `GoalAnalysis`) |
| `goal.mission-tree-generated` | the Mission Tree is built (carries `MissionTree`) |
| `goal.review-package-generated` | the proposal + approval package is assembled |
| `goal.approval-requested` | the approval gate is raised (carries `ApprovalPackage`) |
| `goal.approved` | the Director approves (carries the `MissionProposal`) |
| `goal.rejected` | the Director rejects (carries the reason) |
| `mission-proposal.ready` | **the Coordinator receives the Mission Tree** and decides execution |

Subscribers bind to the exported `EventDefinition` (e.g. `MissionProposalReady`),
not a magic string, so payloads are fully typed. This is how the Coordinator
receives proposals — and how future subsystems observe Goal analysis — without
the Producer depending on them.

## How future Planner integration improves Goal analysis

Today the decomposition is a deterministic domain heuristic:
`HeuristicGoalAnalyzer` decomposes a Goal into a stable set of game-production
objectives (foundations, content, polish, plus physics/AI/audio when the Goal
mentions them) grouped into ordered milestones. It is **not** an AI model — it is
predictable, testable, and dependency-free.

The `GoalAnalyzer` interface is the single seam where richer intelligence plugs
in. When the **Planner** lands (backed by **Memory** and **Knowledge**), it will
implement the same `GoalAnalyzer` interface — a drop-in replacement — and produce
far better analysis:

- **Memory** lets the Planner learn from past Goals in the same project: which
  decompositions worked, how long milestones actually took, which role estimates
  were accurate.
- **Knowledge** gives the Planner engine- and domain-specific facts (e.g. what
  "realistic vehicle physics" concretely requires in the target engine) so
  Objectives and capability estimates reflect real production knowledge rather
  than keyword heuristics.
- **The Planner** turns those into a genuinely reasoned Mission Tree — smarter
  dependencies, more accurate complexity, better ordering.

Because the Producer's structure (Objectives → Milestones → Mission Tree →
Proposal → Approval Package), its lifecycle, and its event payloads are stable,
none of this requires a redesign: only the `GoalAnalyzer` implementation changes.

## Architecture

The package mirrors the Coordinator's layering:

- **`ProducerTypes`** — the `Goal` aggregate, lifecycle, analysis products, the
  `MissionTree`/`MissionProposal`, and future-integration interfaces.
- **`ProducerState`** — the pure, dependency-free transition table.
- **`Producer`** — the domain service: builds/validates Goals, analyses them,
  builds and validates the Mission Tree (with topological ordering), and
  assembles the proposal. `Clock`/`IdGenerator`/`GoalAnalyzer` are injected for
  determinism and future extension.
- **`GoalRegistry`** — the only component that stores goals in memory.
- **`ProducerManager`** — orchestration: the lifecycle surface, transition
  guards, and event emission (including the `mission-proposal.ready` handoff).
  Depends only on `EventBusContract` and `Logger`.
- **`ProducerErrors`** — the error hierarchy (`ProducerError` and subtypes).
- **`ProducerModule`** — the `KernelModule` that installs the manager.

## Integrating with the Kernel

The package ships a `producerModule`. Registering it during `kernel.boot()` makes
`ProducerManager` resolvable via `PRODUCER_MANAGER_TOKEN`. Construction is
deferred to the `register` phase so the manager can pull the shared Event Bus and
Logger. The Producer depends only on the kernel's public `KernelModule` /
`ServiceToken` surface — it never imports kernel internals, and never depends on
the Coordinator it feeds through events.

```ts
import { producerModule, PRODUCER_MANAGER_TOKEN } from '@gamedev-agent/producer';

kernel.registerModule(producerModule);
await kernel.boot();

const producer = await kernel.services.resolve(PRODUCER_MANAGER_TOKEN);

const goal = await producer.submit({
  projectId,
  title: 'Realistic Formula racing',
  description: 'I want realistic Formula racing with physics, AI opponents, and audio.',
  priority: 'high',
});

await producer.analyse(goal.id);
await producer.generateObjectives(goal.id);
await producer.generateMissionTree(goal.id);
await producer.generateReviewPackage(goal.id);
await producer.requestApproval(goal.id);
await producer.approve(goal.id, 'creative-director');
// → emits `mission-proposal.ready`; the Coordinator receives the Mission Tree.
```

## Future integration

The Producer defines — but does not implement — the seams later packages fill:

| Interface / seam | Filled by |
| ---------------- | --------- |
| `GoalAnalyzer` | **Planner** (backed by **Memory** + **Knowledge**) |
| `CapabilityEstimate`, `RoleEstimate` | **Role System** (resolves estimates to real Roles) |
| `MissionProposal`, `MissionTree` | consumed by the **Coordinator** and **Router** |

## Scripts

```
pnpm --filter @gamedev-agent/producer build      # bundle + d.ts
pnpm --filter @gamedev-agent/producer typecheck  # tsc --noEmit
pnpm --filter @gamedev-agent/producer lint       # biome check src
pnpm --filter @gamedev-agent/producer test       # vitest run
```
