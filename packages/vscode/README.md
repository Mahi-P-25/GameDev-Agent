# VS Code Integration (`@gamedev-agent/vscode`)

The **Nova VS Code integration** is the *reference plugin* — the first real,
non-stub integration in the platform, and the template every future plugin
(Git, Terminal, Browser, Blender, …) will follow. It lets Nova safely interact
with a local VS Code workspace: open it, list/read/write/create/rename/delete
files, search files and text, and watch for changes.

```
                  Nova Kernel
        ┌──────────────┬──────────────┬──────────────┐
        │  Event Bus   │ Coordinator  │  Studio API  │
        └──────┬───────┴──────┬───────┴──────┬───────┘
               │ publishes    │ read-only    │ consumes
               │ typed events │ mission link │ our events
               ▼              ▼              │
        ┌─────────────────────────────────────────────┐
        │         @gamedev-agent/vscode                │   ← this package
        │                                             │
        │   VSCodeClient (façade + audit)             │
        │     ├─ WorkspaceService  (open/close root)  │
        │     ├─ FileService       (explicit I/O)     │
        │     ├─ SearchService     (read-only)        │
        │     └─ WatcherService    (events)           │
        └─────────────────────────────────────────────┘
```

## Why VS Code is the reference integration

VS Code is the natural first real integration for three reasons:

1. **It is where the developer already lives.** Nova's whole value is keeping
   the Creative Director in flow; embedding capabilities in the editor removes
   context-switching friction. The [architecture](../../ARCHITECTURE.md)
   explicitly calls out the "VS Code Extension" surface for exactly this.
2. **It exercises the full plugin shape without AI.** Opening a workspace,
   listing/reading/writing files, searching, and watching are concrete, testable
   capabilities that force us to solve the real integration concerns — isolation,
   auditability, explicit operations, event publishing, lifecycle — *before* we
   layer AI on top. That is the point of SPRINT-15: a real integration, not a
   stub, and not the Plugin SDK itself (which we extract later from lessons
   learned here).
3. **It is a safe, offline-first, local boundary.** Everything happens on local
   disk behind an explicit, audited API. Nothing is sent to a model, nothing is
   mutated without an explicit call, and every effect is recorded. This makes it
   the lowest-risk integration to build the contract against.

## What it exposes

Import **only** from the package root:

```ts
import {
  VSCodeClient,           // the façade
  VSCODE_CLIENT_TOKEN,     // DI token (resolve from the kernel)
  vscodeModule,            // Kernel module that installs the client
} from '@gamedev-agent/vscode';

import type {
  VSCodeWorkspaceInfo, VSCodeFileEntry, VSCodeFileContent,
  VSCodeTextMatch, VSCodeFileMatch, VSCodeAuditRecord, VSCodeActor,
} from '@gamedev-agent/vscode';
```

### Capabilities (all ten)

| Capability        | `VSCodeClient` method                          |
|-------------------|------------------------------------------------|
| Open Workspace    | `openWorkspace(rootPath, actor, correlationId)`|
| List Files        | `listFiles(actor, dirPath?, correlationId?)`    |
| Read File         | `readFile(actor, path, correlationId?)`         |
| Write File        | `writeFile(actor, path, content, correlationId?, opts?)` |
| Create File       | `createFile(actor, path, correlationId?, opts?)`|
| Rename File       | `renameFile(actor, from, to, correlationId?)`   |
| Delete File       | `deleteFile(actor, path, correlationId?, opts?)`|
| Search Files      | `searchFiles(actor, options?, correlationId?)`  |
| Search Text       | `searchText(actor, query, options?, correlationId?)` |
| Watch Workspace   | `startWatch(actor, correlationId?)` / `stopWatch(...)` |

Every method names an explicit **actor** (`{ kind, id? }`) and an optional
**correlationId** (a Mission id on the bus) so the operation can be traced.

### Error handling

Catch one hierarchy:

```ts
import {
  VSCodeError, VSCodeNotFoundError, VSCodeAlreadyExistsError,
  VSCodePathTraversalError, VSCodeRejectedError,
} from '@gamedev-agent/vscode';

try {
  await client.writeFile(actor, 'src/main.ts', code);
} catch (e) {
  if (e instanceof VSCodePathTraversalError) { /* blocked escape attempt */ }
  if (e instanceof VSCodeRejectedError) { /* overwrite without force */ }
}
```

Raw `node:fs` errors are translated into the `VSCodeError` family at the
boundary (see `mapFsError`) so they never leak across the integration line.

### Auditability

Every operation produces exactly one record in an immutable trail:

```ts
const trail = client.auditTrail();
// → [{ seq, kind: 'file.write', actor, correlationId, ok, timestamp }, …]
```

This is what makes the integration safe to point at a real workspace: any change
Nova made is attributable and reviewable.

## How future plugins will follow the same structure

The package is intentionally shaped so the *next* integration is mostly
copy-rename, not redesign. The recurring skeleton:

1. **A façade** (`VSCodeClient` → `GitClient`, `TerminalClient`, …) that wires
   services together, exposes capabilities, and **audits every operation**.
2. **Focused services** (`WorkspaceService`, `FileService`, `SearchService`,
   `WatcherService`) — one per concern, each depending only on the shared Event
   Bus, a Logger, and the workspace root.
3. **A typed event catalog** (`VSCodeEvents`) — every state change emits a
   `<aggregate>.<pastTenseVerb>` event so the rest of Nova observes it without
   the plugin reaching into subsystems.
4. **A stable error hierarchy** (`VSCodeErrors`) — internal failures never escape
   the boundary as raw vendor/Node errors.
5. **A Kernel module + DI token** (`VSCodeModule`) — the *only* coupling to Nova,
   expressed through public tokens (`kernel.events`, `COORDINATOR_MANAGER_TOKEN`)
   and a read-only link.

When we extract the **Plugin SDK** (a future seam), these five pieces become the
base classes and interfaces every plugin implements — and the lessons from this
reference integration are exactly what those abstractions are derived from.

## Integration scope (strict)

The sprint mandates a narrow, safe scope. This package:

- Integrates **only** with the Event Bus, the Coordinator (read-only mission
  link), and the Studio API (which consumes our emitted events).
- Performs **no AI**, generates **no code**, and **never mutates files without an
  explicit request**.
- Makes **every file operation explicit and auditable**.

## Wiring it into the Kernel

```ts
import { Kernel } from '@gamedev-agent/kernel';
import { coordinatorModule } from '@gamedev-agent/coordinator';
import { vscodeModule, VSCODE_CLIENT_TOKEN } from '@gamedev-agent/vscode';

const kernel = new Kernel({ modules: [coordinatorModule, vscodeModule] });
await kernel.boot();

const client = await kernel.services.resolve(VSCODE_CLIENT_TOKEN);
const info = await client.openWorkspace('/path/to/project', { kind: 'director' });
```

The module resolves `COORDINATOR_MANAGER_TOKEN` when present to build a
narrow `CoordinatorLink`; it works without the Coordinator too (operations are
simply not mission-correlated).

## Development

```bash
npx tsc --noEmit     # typecheck (strict, incl. tests)
npx biome check src  # lint + format
npx vitest run       # unit tests (workspace, read/write, search, watcher, errors)
npx tsup             # build (ESM + d.ts)
```
