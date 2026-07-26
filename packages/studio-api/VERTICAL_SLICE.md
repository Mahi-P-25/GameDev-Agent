# Sprint 14 — Vertical Slice: Goal → Plan → Workflow → Mission

This document explains the end-to-end vertical slice implemented in `@gamedev-agent/studio-api`, and why it matters.

## What it proves

Nova's architecture is correct: five independent subsystems — **Producer → Planner → Workflow → Coordinator → Studio API** — can be wired into one complete flow using **only** the shared Event Bus, the Kernel module + DI-token pattern, and existing domain managers. No AI, no Memory, no Knowledge, no new backend packages, no new architecture.

Every step of the slice is **local, deterministic, and reproducible**. The single seam left for future intelligence is the model-free `succeedStep`/planning heuristics — nothing else.

## The flow

```
Creative Director
      │  producer.submit(goal)
      ▼
  Producer ── goal.submitted ──────────────────────────────┐
      │  (auto) analyse → objectives → missionTree →         │
      │  reviewPackage → requestApproval → approve           │
      ▼                                                      │
  MissionProposalReady ──────────────────────────────────┐  │
      │  planner.plan(proposal)                            │  │
      ▼                                                   │  │
  Planner ── plan.created ───────────────────────────┐   │  │
      │                                               │   │  │
      │  (fan-out on plan.created)                    │   │  │
      ├──────────────► Coordinator.submit/accept/     │   │  │
      │                analyse/approve/ready/start    │   │  │
      │                                               │   │  │
      └──────────────► Workflow.createFromSource(     │   │  │
                        plan.toWorkflowSource())      │   │  │
                        → start → drive→completed     │   │  │
                                                    │   │  │
  Studio UI ◄── getStudioHome()  ◄── (all events) ◄──┘   │  │
            (StudioHome aggregate + ActivityFeed)         │  │
```

## How it is wired

### `StudioOrchestrator` (`src/StudioOrchestrator.ts`)
The only place the five systems are tied together. It owns **no domain logic** — it subscribes to pipeline events on the bus and delegates each action to an existing manager:

| Event | Action |
| --- | --- |
| `goal.submitted` | `producer.analyse` |
| `goal.analysing` | `producer.generateObjectives` |
| `goal.objectivesGenerated` | `producer.generateMissionTree` |
| `goal.missionTreeGenerated` | `producer.generateReviewPackage` |
| `goal.reviewPackageGenerated` | `producer.requestApproval` |
| `goal.approvalRequested` | `producer.approve` (auto-approve for the slice) |
| `missionProposalReady` | `planner.plan(proposal)` |
| `plan.created` | `coordinator` mission (submit→accept→analyse→approve→ready→start) **and** `workflow` execution (bridge plan → `WorkflowSource` → `start` → drive to `completed`) |

It is installed as a Kernel module (`studioOrchestratorModule`) and subscribes once the kernel is fully booted, so every upstream service exists before the first event is observed.

### `StudioHome` (`src/StudioHome.ts`) + `getStudioHome()` (`src/StudioApi.ts`)
A **pure projection** over the live state of Producer, Planner, Workflow, and Coordinator, plus the normalized `ActivityFeed`. One call gives the UI everything it needs: the current goal, the plan, the execution phases, the mission status, and the activity stream. Because it reads live state and the bus keeps the feed fresh, **the Studio UI updates automatically with zero polling and zero coupling to domain packages**.

### `ActivityFeed` (`src/ActivityFeed.ts`)
Extended to interpret **Producer (goal.*), Planner (plan.*), and Workflow (workflow.*)** events into the single `StudioActivity` shape, in addition to the existing Coordinator / Project / Capability events. This is what makes "the UI updates automatically as the pipeline advances" real.

## Why no execution engine is needed yet

`WorkflowManager.start(id)` only auto-drives steps when a `StepExecutor` is injected. For the slice, `StudioOrchestrator.driveToCompletion` reports success for every step via the existing `succeedStep` seam, carrying the run to `completed` without any model. The future Execution Engine slots in behind that same seam — no change to the orchestrator or the Workflow Engine.

## Running the slice

```bash
pnpm --filter @gamedev-agent/studio-api test   # src/VerticalSlice.test.ts
```

`VerticalSlice.test.ts` drives a real goal through the real subsystems (connected only by the bus) and asserts:

1. The goal auto-advances through its full lifecycle to `approved` and the Planner produces a frozen plan.
2. A `plan.created` fans out into a Coordinator Mission (started) and a Workflow execution (completed).
3. A single `getStudioHome()` read exposes goal, plan, execution, mission status, and a populated activity feed.

## Dependency direction (preserved)

```
subsystems ⇢ kernel ⇢ studio-api ⇢ UI
```

`studioModule` is the *only* place this package reaches into the container, and it reaches only through public tokens: `PRODUCER_MANAGER_TOKEN`, `PLANNER_MANAGER_TOKEN`, `WORKFLOW_MANAGER_TOKEN`, `COORDINATOR_MANAGER_TOKEN`, `PROJECT_MANAGER_TOKEN`, `CAPABILITY_MANAGER_TOKEN`, plus `kernel.events`. Frontends never import the domain packages directly — only `@gamedev-agent/studio-api`.
