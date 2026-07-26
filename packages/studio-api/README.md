# Studio API

The **Studio API** is the single, stable application façade every Nova frontend
talks to. Desktop, Web, CLI, and VS Code applications depend **only** on this
package — never on the Coordinator, Project, or Capability subsystems directly.

```
 Frontends (Desktop / Web / CLI / VS Code)
            │  depends only on
            ▼
   ┌──────────────────────┐
   │   @gamedev-agent/     │
   │      studio-api       │   ← this package
   └──────────┬───────────┘
              │ orchestrates (via public tokens only)
   ┌──────────┼───────────────┬───────────────┐
   ▼          ▼               ▼               ▼
 Coordinator  Projects     Capabilities     Event Bus
```

## Why this package exists

- **One boundary for every UI.** Frontends code against stable DTOs
  (`StudioApiContracts`) and a stable error family (`StudioApiErrors`). The
  internal domain models of the subsystems are never leaked across this line,
  so those subsystems can evolve freely.
- **Orchestration, not logic.** The façade has no domain behavior. It translates
  frontend requests into Coordinator / Project / Capability commands, and
  translates internal models + events back into presentation-ready data.
- **A single activity stream.** The `ActivityFeed` subscribes to the shared
  Event Bus once and projects the heterogeneous subsystem events into one
  normalized `StudioActivity` stream. Frontends consume that — they never
  subscribe to raw internal events.

## What it exposes

Import **only** from the package root:

```ts
import {
  StudioApi,            // the façade
  STUDIO_API_TOKEN,     // DI token (resolve from the kernel)
  studioModule,         // Kernel module that installs the façade
} from '@gamedev-agent/studio-api';

import type {
  StudioWorkspace, StudioProject, StudioMission, StudioCapability,
  StudioActivity, StudioHealth, StudioCoordinatorStatus,
} from '@gamedev-agent/studio-api';
```

### Use cases (`StudioApi`)

| Area        | Methods |
|-------------|---------|
| Workspace   | `getWorkspace()` |
| Projects    | `createProject`, `openProject`, `listProjects`, `getProject`, `updateProject`, `closeProject`, `deleteProject` |
| Missions    | `createMission`, `approveMission`, `cancelMission`, `listMissions`, `getMission` |
| Capabilities| `listCapabilities`, `getHealth` |
| Coordinator | `getCoordinatorStatus` |
| Activity    | `getActivity`, `onActivity` |

Every method returns stable DTOs. Async project/mission methods return
`Promise<…>`; read-only lists are synchronous.

### Error handling

Catch one family:

```ts
import { StudioApiError, StudioNotFoundError, StudioRejectionError } from '@gamedev-agent/studio-api';

try {
  const mission = await api.createMission({ /* … */ });
} catch (e) {
  const err = api.translate(e); // normalizes internal errors to StudioApiError
  if (err instanceof StudioNotFoundError) { /* … */ }
  if (err instanceof StudioRejectionError) { /* … */ }
}
```

`StudioApi.translate()` maps internal subsystem failures
(`MissionNotFoundError`, `ProjectNotFoundError`, `MissionValidationError`,
`MissionStateError`, `MissionApprovalError`, …) into the stable
`StudioApiError` hierarchy so UIs handle exactly one error type.

## Wiring it into the Kernel

Register the module at boot; the façade becomes resolvable as `STUDIO_API_TOKEN`:

```ts
import { Kernel } from '@gamedev-agent/kernel';
import { studioModule } from '@gamedev-agent/studio-api';
import { coordinatorModule } from '@gamedev-agent/coordinator';
import { projectModule } from '@gamedev-agent/project';
import { capabilityModule } from '@gamedev-agent/capabilities';

const kernel = new Kernel({
  modules: [coordinatorModule, projectModule, capabilityModule, studioModule],
});
await kernel.boot();

const api = await kernel.services.resolve(STUDIO_API_TOKEN);
```

The module pulls `COORDINATOR_MANAGER_TOKEN`, `PROJECT_MANAGER_TOKEN`,
`CAPABILITY_MANAGER_TOKEN`, and `kernel.events` — and nothing else. This keeps
the dependency direction correct: subsystems → kernel → studio-api → UI.

## Development

```bash
npx tsc --noEmit     # typecheck (incl. tests)
npx biome check src  # lint + format
npx vitest run       # unit tests
npx tsup             # build (ESM + d.ts)
```

The dependency packages (`coordinator`, `project`, `capabilities`) must be
built first so their `dist/*.d.ts` resolve during `tsup`.
