# Studio Presence

Studio Presence is the **command center for studio state** on the Nova Studio Home
screen. It shows, in real time, what the studio is doing right now: the overall
status banner, the current project / mission / active file, workflow and project
health, the **Team Presence** grid (Producer, Planner, Workflow, QA, Terminal,
Git), the last session, a Continue Working action, and recent activity.

> **Real state only.** Every value shown comes from the live `StudioApi` façade
> (`getStudioHome`, `getContext`, `listProjects`, `listMissions`,
> `listCapabilities`, `getActivity`, `onActivity`). There are **no AI agents and
> no fabricated data** in this surface. When the in-browser kernel has not yet
> produced state (empty projects, no mission, no activity) the cards render their
> empty/neutral states gracefully — they never invent content.

---

## Architecture

```
StudioPresenceModule            ← Home section root (apps/studio/src/pages/HomePage.tsx)
└─ useStudioPresence()         ← PresenceStore: subscription + snapshot
   ├─ reads real StudioApi      (no backend packages imported directly)
   └─ resolveModules(snapshot)  ← single function that maps state → ModulePresence
└─ PresenceCards                ← pure presentational components
   ├─ Greeting
   ├─ StatusBanner
   ├─ CurrentProject / CurrentMission / CurrentActiveFile
   ├─ WorkflowStatusCard / ProjectHealthCard / StudioStatusCard
   ├─ TeamPresenceCard          ← renders ModulePresence[] (Producer…Git)
   ├─ SessionSummaryCard / ContinueWorkingCard
   └─ RecentActivityCard
```

### The presence contract

All cards render against a small, stable contract defined in `PresenceEvents.ts`:

- `PresenceStatus = 'idle' | 'working' | 'waiting' | 'completed' | 'blocked'`
- `ModuleId = 'producer' | 'planner' | 'workflow' | 'qa' | 'terminal' | 'git'`
- `ModulePresence = { id, name, description, status, detail? }`

This is **deliberately decoupled** from the subsystems. The UI consumes
`ModulePresence`, never the planner/coordinator/terminal internals.

### Live subscription

`PresenceStore.useStudioPresence()`:
1. Pulls a full snapshot from `StudioApi` on mount.
2. Subscribes via `api.onActivity(handler)` and recomputes on every event, so the
   surface stays live as the event-driven pipeline advances.
3. Derives each module's `PresenceStatus` in **one** function,
   `resolveModules(snapshot)`.

---

## Future-ready: swapping in AI

The seam for a future AI system is exactly **one function**: `resolveModules`.
Today it infers each module's status from structural signals:

| Module   | Real signal used                                                        |
| -------- | ----------------------------------------------------------------------- |
| Producer | `goalInFlight` (a goal / in-flight mission exists)                      |
| Planner  | `pendingApprovals > 0` → `waiting`; else follows Producer               |
| Workflow | `workflowStatus.current.state` (running / completed / failed)           |
| QA       | capability health (`unhealthy` → `blocked`, `degraded` → `waiting`)     |
| Terminal | a `terminal`/`process` capability is enabled                            |
| Git      | a `git` capability is enabled                                           |

To drive presence from an AI instead, replace the body of `resolveModules` (or
call an AI service from `PresenceStore`) — **no card component changes**. The
contract (`ModulePresence`) and the entire presentational tree stay identical.

---

## Files

| File                                          | Responsibility                                  |
| --------------------------------------------- | ----------------------------------------------- |
| `src/modules/studio-presence/PresenceEvents.ts`   | Status vocabulary, `ModulePresence`, intent/label maps |
| `src/modules/studio-presence/PresenceStore.ts`    | `useStudioPresence` hook + `resolveModules`     |
| `src/modules/studio-presence/PresenceCards.tsx`   | All presentational cards                        |
| `src/modules/studio-presence/StudioPresenceModule.tsx` | Section root + public `useStudioPresence` export |
| `src/modules/studio-presence/index.ts`            | Barrel exports                                  |

## Conventions

- Reuses the Nova Design System only: `cn`, `useNovaMotion()` presets
  (`stagger`, `staggerItem`, `fadeUp`), `Intent`, and the `Card` / `Badge` /
  `StatusDot` / `ProgressBar` primitives in `src/components/ui/primitives.tsx`.
- Cards are backend-agnostic — they import **nothing** from `packages/studio-api`
  beyond types, and never reach into backend internals.
- Motion honors `prefers-reduced-motion` (degrades to instant via `useNovaMotion`).
