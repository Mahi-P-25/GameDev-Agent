# Mission Control

Mission Control is Nova Studio's **primary productivity surface for game
development**. It answers one question immediately:

> **"What should I work on next?"**

That answer is the **Next Step** card at the top of the screen, derived live
from real studio state. Below it sits the full Mission detail — title,
description, priority, status, progress, objectives, dependencies, the related
project and workflow, and the last-updated time.

> **Real state only.** Every value comes from the live `StudioApi` façade
> (`listMissions`, `getContext`, `listWorkflowRuns`, `listProjects`,
> `getWorkspace`, `getActivity`, `onActivity`). There is **no AI** here and
> **no fabricated data** — objectives and dependencies are projected from real
> Coordinator output and workspace readiness. When the in-browser kernel has
> not yet produced state, the cards render their empty/neutral states
> gracefully.

---

## Architecture

```
MissionControlModule            ← Home primary section + /mission-control route
└─ useMissionControl()         ← MissionStore: subscription + projection
   ├─ reads real StudioApi      (no backend packages imported directly)
   └─ resolveMission(snapshot)  ← single function mapping state → MissionView
└─ MissionCards                ← pure presentational components
   ├─ NextStepCard             (the "what next?" answer)
   ├─ MissionCard              (title/description/priority/status/progress…)
   ├─ ObjectiveList           (Pending · Working · Completed · Blocked)
   ├─ DependencyView          (real subsystem readiness)
   ├─ ProgressTracker         (the progress indicator)
   └─ MissionStatus           (status pill + %)
```

### The Mission Control contract

All components render against a small, stable contract defined in
`MissionEvents.ts`:

- `MissionStatusKey = 'pending' | 'working' | 'blocked' | 'completed' | 'cancelled'`
- `ObjectiveStatus = 'pending' | 'working' | 'completed' | 'blocked'`
- `MissionDependency = { id, name, status: 'up' | 'degraded' | 'down', detail? }`
- `Objective = { id, title, detail?, status }`
- `NextStep = { label, to, intent }`
- `MissionView` — the aggregate the whole screen renders.

This is **deliberately decoupled** from the subsystems. Components consume
`MissionView`, never the Coordinator/Workflow internals.

### Live subscription

`MissionStore.useMissionControl()`:
1. Pulls a full snapshot from `StudioApi` on mount.
2. Subscribes via `api.onActivity(handler)` and recomputes on every event, so
   the screen stays live as the event-driven pipeline advances.
3. Projects `resolveMission(snapshot)` into the `MissionView` the UI renders.

---

## State flow

```
StudioApi (kernel)
   │  listMissions / getContext / listWorkflowRuns
   │  listProjects / getWorkspace / getActivity
   ▼
MissionSnapshot            ← raw, real DTOs (missions, workflow, deps, project)
   │
   ▼  resolveMission()   ← THE AI SEAM
MissionView               ← normalized: status, objectives, next step
   │
   ▼
MissionControlModule     ← composes cards with subtle Framer Motion stagger
```

### How each field is derived (real, deterministic)

| Field             | Source                                                        |
| ----------------- | ------------------------------------------------------------- |
| `title`          | active `StudioMission.title`                                  |
| `description`    | `StudioMission.brief`                                         |
| `priority`       | `StudioMission.priority`                                      |
| `statusKey`      | `normalizeMissionStatus(StudioMission.status)`                |
| `progress`       | `StudioMission.progress` (0–100, clamped)                  |
| `objectives`     | `StudioMission.roleRequirements` (real Coordinator output) —  |
|                   | completion distributed across `progress` deterministically     |
| `blocker`        | `StudioMission.failureReason`                                 |
| `dependencies`    | `StudioWorkspace.dependencies` (real readiness)              |
| `relatedProject`  | active `StudioProject` (from `getContext` / `projects`)    |
| `relatedWorkflow` | most recent non-terminal `StudioWorkflowRun`                |
| `nextStep`       | highest-priority actionable: approval → blocker → continue   |

---

## Future AI integration

The seam for a future AI system is **exactly one function**:
`resolveMission(snapshot)` in `MissionStore.ts`.

Today it infers the mission view from structural signals (status string,
progress %, Coordinator requirements, workspace dependencies). To drive Mission
Control from an AI instead:

1. Replace the body of `resolveMission` (or call an AI service from
   `useMissionControl`) — **no component changes needed**.
2. The AI can update `progress`, set `objectives[].status`, or rewrite the
   `nextStep` however it sees fit; every card consumes the same `MissionView`
   shape.

The UI is written so AI progress updates flow through the identical render
path as the structural derivation — the contract never changes.

---

## Files

| File                                              | Responsibility                              |
| ------------------------------------------------- | ------------------------------------------- |
| `src/modules/mission-control/MissionEvents.ts`     | Status vocabulary, `MissionView`, intent/label maps |
| `src/modules/mission-control/MissionStore.ts`      | `useMissionControl` hook + `resolveMission` |
| `src/modules/mission-control/MissionCards.tsx`     | `MissionCard`, `ObjectiveList`, `DependencyView`, `ProgressTracker`, `NextStepCard`, `MissionStatus`, skeleton |
| `src/modules/mission-control/MissionControlModule.tsx` | Section root + public `useMissionControl` export |
| `src/modules/mission-control/index.ts`            | Barrel exports                              |
| `src/pages/MissionControlPage.tsx`               | Full-page `/mission-control` route          |

## Conventions

- Reuses the Nova Design System only: `cn`, `useNovaMotion()` presets
  (`stagger`, `staggerItem`), `Intent`, and the `Card` / `StatusIndicator` /
  `Progress` / `Skeleton` / `EmptyState` / `Button` primitives.
- Icons via `lucide-react`; tokens (`text-fg`, `bg-bg-panel`, `border-border`,
  `rounded-lg`, spacing scale) from `@theme`.
- Motion is subtle and honors `prefers-reduced-motion`.
- Every interactive element is a real `<button>` / `<NavLink>` with visible
  `focus-visible` rings; the Next Step and Project tiles are keyboard reachable.
