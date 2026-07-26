# @gamedev-agent/workspace

**Nova Workspace System** — the **highest-level persistent object** of Nova, the
AI-native Operating System for Game Development.

> Nova is not a chatbot and not another AI coding assistant. It is an operating
> system for building games from idea to release. The Workspace System is its
> **aggregate root above Projects**: a Workspace represents an entire Game
> Development Studio and owns everything inside it.

This package implements **only** the Workspace System. It integrates
exclusively with the Kernel, the Project System, the Studio API façade, and the
Event Bus. Memory, Knowledge, Plugins, the Planner, the AI layer, Roles, and the
UI are intentionally out of scope and arrive in later sprints as subsystems that
hang off of Workspaces.

---

## Why the Workspace is the highest-level persistent object

Nova thinks in *Workspaces, Projects, Missions, Knowledge, and Workflows* — not
prompts. A **Workspace is the studio**. It is the stable identity that scopes and
isolates every other concern:

- **Projects belong to a Workspace.** A Workspace owns its Projects *by
  reference* (a list of `ProjectId`s). Projects are no longer independent
  entities — they exist only within a Workspace. Opening a project is a
  Workspace operation; the Workspace is what answers "which projects live here?"
- **Installed Capabilities belong to a Workspace.** Each Workspace records the
  capabilities it has enabled, the version bound, and capability-scoped options.
- **Connected Tools belong to a Workspace.** External tools (engines, VCS hosts,
  DCCs) are connected at the Workspace level so the whole studio shares them.
- **User Preferences, Theme, and Recent Activity** are Workspace-scoped personal
  and operational state.
- **Metadata** is the schema-free attachment point for future subsystems.

Because every future subsystem answers "which Workspace am I operating in?", the
`Workspace` is the natural aggregate root. Putting it at the top of the
dependency graph means higher-level packages depend *down* on workspaces without
workspaces knowing anything about them — the dependency arrow never points back.

## How future Memory, Knowledge, Plugins, and AI Providers belong to the Workspace

The Workspace already *carves out* the slots these subsystems will fill. When
they land, they resolve `WORKSPACE_MANAGER_TOKEN`, read the relevant Workspace,
and write into its slots — no redesign required.

| Future subsystem      | What it consumes from a Workspace                          |
| --------------------- | ---------------------------------------------------------- |
| Memory                | `id`, `metadata`, activity stream                         |
| Knowledge             | `id`, `metadata`, capability/tool config                  |
| Plugins              | `capabilities` configuration, `metadata`                 |
| AI Providers          | `capabilities` (model/provider slots), `preferences`     |
| Workflow / Coordinator| `projectIds`, `status`, lifecycle hooks                   |
| Studio API            | the whole `Workspace` aggregate, projected to a DTO       |

The Workspace System already publishes the lifecycle and ownership events these
subsystems will observe (`workspace.created`, `workspace.opened`,
`workspace.closed`, `workspace.archived`, `workspace.deleted`,
`workspace.updated`, `workspace.project.added`, `workspace.project.removed`),
so a future persistence or sync layer can react without code changes here.

## How the Workspace System integrates with the Kernel, Projects, Studio API, and Event Bus

- **Kernel** — The system ships a `workspaceModule` (`KernelModule`). Registering
  it during `kernel.boot()` makes `WorkspaceManager` resolvable from the
  container via `WORKSPACE_MANAGER_TOKEN`. Construction is deferred to the
  `register` phase so the manager can pull the shared Event Bus and Logger — both
  guaranteed available by then. The Workspace System depends only on the kernel's
  *public* `KernelModule`/`ServiceToken` surface; it does not import kernel
  internals, so the `workspace → kernel` edge is a clean, acyclic dependency.

- **Projects** — The Workspace owns Projects *by reference*. When the Project
  System is installed (`PROJECT_MANAGER_TOKEN` is registered), the Workspace
  Manager receives a `projectExists` guard so it validates that a Project it is
  asked to own actually exists. The Workspace never duplicates Project state; it
  holds `ProjectId`s and delegates to the Project System for the entity.

- **Studio API** — The Studio API façade is the only boundary the UI talks to. A
  future Studio API version resolves `WORKSPACE_MANAGER_TOKEN` and projects the
  `Workspace` aggregate into a stable DTO, exactly as it already does for
  Projects and Missions.

- **Event Bus** — Every lifecycle and ownership operation publishes a
  **strongly-typed** `EventDefinition`. Subscribers bind to the definition (not a
  magic string), so payloads are fully inferred and the compiler catches drift.
  The Workspace System never calls other packages directly; it emits and lets the
  bus carry the news.

---

## Architecture at a glance

```
        ┌─────────────────────────────────────────────┐
        │  Applications (Studio, Web, CLI, VS Code)    │
        └───────────────────────┬─────────────────────┘
                                 │ resolve WORKSPACE_MANAGER_TOKEN
        ┌───────────────────────┴─────────────────────┐
        │            WorkspaceManager                  │  orchestration + events
        │  create / open / close / rename /            │
        │  archive / delete / addProject /             │
        │  removeProject / update / list / validate    │
        └───────┬───────────────────────────┬─────────┘
                │                           │
        ┌───────┴──────┐            ┌───────┴────────┐
        │ WorkspaceFactory│           │ WorkspaceRegistry│  domain + storage
        └───────┬──────┘            └───────┬────────┘
                │                           │
        ┌───────┴───────────────────────────┴─────────┐
        │  WorkspaceTypes · WorkspaceErrors ·          │  model + contracts
        │  WorkspaceEvents · WorkspaceSettings ·       │
        │  WorkspaceValidator                          │
        └───────────────────────┬─────────────────────┘
                                 │ depends on
        ┌───────────────────────┴─────────────────────┐
        │  shared · di · events · kernel · logging     │  foundation
        │  project (ownership references)              │
        └─────────────────────────────────────────────┘
```

### Components

| Component | Responsibility |
| --------- | -------------- |
| `Workspace` / `WorkspaceTypes` | The immutable-at-rest aggregate + domain enums/namespaces. |
| `WorkspaceFactory` | Sole constructor. Applies defaults, derives ids/time, bounds activity, validates. Injects `Clock`/`IdGenerator`. |
| `WorkspaceRegistry` | In-memory store + lookup. Enforces name uniqueness. No events, no I/O. |
| `WorkspaceManager` | Orchestrates operations, guards lifecycle state, manages Project ownership, emits events, owns no singleton. `Disposable`. |
| `WorkspaceEvents` | Strongly-typed event catalog (payloads + `EventDefinition`s). |
| `WorkspaceErrors` | Error hierarchy (`WorkspaceError` + subtypes). |
| `WorkspaceSettings` | Settings/theme/preferences model + validation + defaults. |
| `WorkspaceValidator` | Pure validation rules shared by factory and manager. |
| `workspaceModule` / `WORKSPACE_MANAGER_TOKEN` | Kernel integration surface. |

## Usage

```ts
import { Kernel } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { MemoryConfigSource } from '@gamedev-agent/config';
import { projectModule, PROJECT_MANAGER_TOKEN } from '@gamedev-agent/project';
import { WORKSPACE_MANAGER_TOKEN, workspaceModule } from '@gamedev-agent/workspace';

const kernel = new Kernel({
  namespace: 'studio',
  eventBus: new InMemoryEventBus('studio'),
  logger: new RootLogger('studio', [new ConsoleLogSink()]),
  configSources: [new MemoryConfigSource()],
  modules: [projectModule, workspaceModule],
});
await kernel.boot();

const workspaces = await kernel.services.resolve(WORKSPACE_MANAGER_TOKEN);
const studio = await workspaces.create({ name: 'Nebula Studios' });
await workspaces.open(studio.id);

// A Workspace owns its Projects by reference.
await workspaces.addProject(studio.id, someProjectId);

await kernel.shutdown();
```

## Supported operations

| Operation | Behavior |
| --------- | -------- |
| Create    | Validate → store → emit `workspace.created` (status starts `draft`). |
| Open      | Guard state → `draft/closed/archived → open` → emit `workspace.opened`. Idempotent. |
| Close     | Guard state → `open → closed` → emit `workspace.closed`. Idempotent. |
| Archive   | Guard state → `draft/open/closed → archived` → emit `workspace.archived`. Idempotent. |
| Rename    | Re-validate → emit `workspace.renamed` (+ `workspace.updated`). |
| Update    | Patch (immutable) → emit `workspace.updated` with changed fields. |
| Delete    | Emit `workspace.deleted` → remove from registry (irreversible). Requires `closed`/`archived`. |
| Add Project | Establish ownership → emit `workspace.project.added` (+ activity). Validates existence when a guard is installed. |
| Remove Project | Release ownership → emit `workspace.project.removed` (+ activity). |

## Design properties

- **Strict TypeScript** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **SOLID** — single responsibility per component; manager depends on `EventBusContract`/`Logger` abstractions.
- **Dependency Injection** — bus/logger/factory/registry all injected; the kernel wires it via tokens.
- **Event-driven** — all transitions flow through the shared bus.
- **No circular dependencies** — `workspace → {shared, di, events, kernel, logging, project}`, never the reverse.
- **No singleton abuse** — `WorkspaceManager` is constructed by the caller/container; the registry is held by the manager, not as module global state.
- **High testability** — pure validators, injectable clocks/ids, and a framework-free `FakeEventBus` double.

---

## Engineering Summary

### Architectural decisions

1. **Aggregate-root above Projects.** `Workspace` owns `projectIds`
   (references), `capabilities`, `tools`, `preferences`, `theme`, and `activity`.
   Projects are no longer independent — they are referenced by a Workspace, and a
   `projectExists` guard (installed from the kernel's `PROJECT_MANAGER_TOKEN`)
   keeps ownership honest.
2. **Construction centralized in `WorkspaceFactory`.** All defaulting, id/time
   stamping, activity bounding, and validation live in one injectable, pure unit.
   The manager never assembles raw objects, so invariants can't leak.
3. **Registry is storage-only.** It answers store/fetch/list/remove and enforces
   the name-uniqueness invariant. No events, no lifecycle — so it stays
   trivially testable and swappable for a persistent backend later.
4. **Manager is the orchestrator, not a god-object.** It sequences
   factory → registry → events, guards lifecycle transitions, manages Project
   ownership, and owns no singleton. Each operation maps to one or two events
   with precise payloads.
5. **Strongly-typed events.** The catalog mirrors `@gamedev-agent/events`
   conventions (`EventDefinition` + payload interface, `version: 1`). This is
   what lets downstream packages subscribe with full type inference.
6. **Kernel coupling via the public module contract only.** `workspaceModule`
   depends on `KernelModule`/`ServiceContainer`/`StudioKernel` — the kernel's
   exported surface — never on its internals. The dependency arrow is clean:
   `workspace → kernel`, and kernel has no dependency on workspace.

### Package boundaries

```
workspace
 ├─ depends on: shared, di, events, kernel (public API), logging, project (references)
 └─ depended on by: applications, and future memory/knowledge/plugin/ai packages
```

`workspace` introduces **no** new foundational primitive; it composes the
existing `shared` (brands), `di` (tokens), `events` (`EventDefinition`,
`Clock`/`IdGenerator`), `kernel` (module contract), and `project` (references)
building blocks.

### Future extensibility

- **Persistence** — replace or wrap `WorkspaceRegistry` behind the same surface
  (file store, database). The manager and events are unaffected.
- **Memory / Knowledge / Plugins / AI Providers** — resolve
  `WORKSPACE_MANAGER_TOKEN`, read the Workspace, and write into its slots.
  No change to this package required.
- **Distributed Nova** — events already carry `source`, `correlationId`, and
  `trace`; a remote bus transport can replay `workspace.created` etc. across
  Studio/Web/CLI without code changes here.

### Assumptions made during implementation

- The monorepo npm scope remains `@gamedev-agent/*` (established convention).
- A Workspace's `name` is the uniqueness key (case-insensitive). `id` is the
  stable identity.
- Newly created Workspaces start in `draft`; `open`/`close`/`archive` drive the
  `draft → open → closed → archived` lifecycle. Deletion requires the Workspace
  to be `closed` or `archived` first.
- The Workspace System performs **no filesystem I/O** in this sprint. Side
  effects (directory creation, project scaffolding) belong to a later
  persistence subsystem and will observe the workspace/project events.
- Time and identity are injected (`Clock`, `IdGenerator`) and default to the
  events package's `SystemClock`/`UuidGenerator`, keeping the system portable
  and deterministic under test.
