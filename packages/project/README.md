# @gamedev-agent/project

**Nova Project System** — the root object model for every game project managed by
Nova, the AI-native Operating System for Game Development.

> Nova is not a chatbot and not another AI coding assistant. It is an operating
> system for building games from idea to release. The Project System is its
> **root aggregate**: everything in Nova belongs to a Project.

This package implements **only** the Project System (Sprint 4). It integrates
exclusively with the Kernel and the Event Bus. Memory, Knowledge, Missions,
Plugins, Workflow, and AI are intentionally out of scope and arrive in later
sprints as subsystems that hang off of projects.

---

## Why Projects are the root object of Nova

Nova thinks in *Projects, Missions, Knowledge, and Workflows* — not prompts. A
Project is the stable identity that scopes and isolates every other concern:

- **Memory belongs to Projects.** Each project owns a memory namespace so that
  two games never leak recollections into one another.
- **Knowledge belongs to Projects.** A project's knowledge graph, documents, and
  embeddings are partitioned by its knowledge namespace.
- **Missions belong to Projects.** Planned units of work are scoped to a
  project's mission namespace and inherit its identity.
- **Plugins, Model configuration, Workspaces, and Git repositories** are all
  recorded on the project.

Because every future subsystem reads "which project am I operating in?", the
`Project` is the natural aggregate root. Putting it at the bottom of the
dependency graph means higher-level packages can depend *down* on projects
without projects knowing anything about them — the dependency arrow never
points back.

## Why every future subsystem depends on Projects

| Future subsystem | What it consumes from a Project |
| ---------------- | ------------------------------ |
| Memory           | `memoryNamespace`, `id`, `metadata` |
| Knowledge        | `knowledgeNamespace`, `rootPath` |
| Missions         | `missionNamespace`, `status`, lifecycle hooks |
| Plugins          | `plugins` configuration, `rootPath` |
| Model Router     | `model` configuration |
| Workflow         | `workspace`, `git`, `status` |
| Orchestrator     | project as the unit of work/planning |

The Project System already *carves out* the namespaces and configuration slots
these subsystems will fill. When they land, they resolve `PROJECT_MANAGER_TOKEN`,
read the relevant project, and write into its namespaces — no redesign required.

## How the Project System integrates with the Kernel and Event Bus

- **Kernel** — The system ships a `projectModule` (`KernelModule`). Registering
  it during `kernel.boot()` makes `ProjectManager` resolvable from the container
  via `PROJECT_MANAGER_TOKEN`. Construction is deferred to the `register` phase
  so the manager can pull the shared Event Bus and Logger — both guaranteed
  available by then. The Project System depends only on the kernel's *public*
  `KernelModule`/`ServiceToken` surface; it does not import kernel internals, so
  the `project → kernel` edge is a clean, acyclic dependency.

- **Event Bus** — Every lifecycle operation publishes a **strongly-typed**
  `EventDefinition` (`project.created`, `project.opened`, `project.closed`,
  `project.renamed`, `project.updated`, `project.deleted`). Subscribers bind to
  the definition (not a magic string), so payloads are fully inferred and the
  compiler catches drift. The Project System never calls other packages
  directly; it emits and lets the bus carry the news.

## Architecture at a glance

```
        ┌─────────────────────────────────────────────┐
        │  Applications (Studio, Web, CLI, VS Code)    │
        └───────────────────────┬─────────────────────┘
                                 │ resolve PROJECT_MANAGER_TOKEN
        ┌───────────────────────┴─────────────────────┐
        │              ProjectManager                  │  orchestration + events
        │   create / open / close / rename /           │
        │   update / delete / list / validate          │
        └───────┬───────────────────────────┬─────────┘
                │                           │
        ┌───────┴──────┐            ┌───────┴────────┐
        │ ProjectFactory│            │ ProjectRegistry│  domain + storage
        └───────┬──────┘            └───────┬────────┘
                │                           │
        ┌───────┴───────────────────────────┴─────────┐
        │  ProjectTypes · ProjectErrors · ProjectEvents │  model + contracts
        └───────────────────────┬─────────────────────┘
                                 │ depends on
        ┌───────────────────────┴─────────────────────┐
        │  shared · di · events · kernel · logging      │  foundation
        └─────────────────────────────────────────────┘
```

### Components

| Component | Responsibility |
| --------- | -------------- |
| `Project` / `ProjectTypes` | The immutable-at-rest aggregate + domain enums/namespaces. |
| `ProjectFactory` | Sole constructor. Applies defaults, derives namespaces, stamps id/time, validates. Injects `Clock`/`IdGenerator`. |
| `ProjectRegistry` | In-memory store + lookup. Enforces id/path uniqueness. No events, no I/O. |
| `ProjectManager` | Orchestrates operations, guards lifecycle state, emits events, owns no singleton. `Disposable`. |
| `ProjectEvents` | Strongly-typed event catalog (payloads + `EventDefinition`s). |
| `ProjectErrors` | Error hierarchy (`ProjectError` + subtypes). |
| `ProjectValidator` | Pure validation rules shared by factory and manager. |
| `projectModule` / `PROJECT_MANAGER_TOKEN` | Kernel integration surface. |

## Usage

```ts
import { Kernel } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { MemoryConfigSource } from '@gamedev-agent/config';
import { PROJECT_MANAGER_TOKEN, projectModule } from '@gamedev-agent/project';

const kernel = new Kernel({
  namespace: 'studio',
  eventBus: new InMemoryEventBus('studio'),
  logger: new RootLogger('studio', [new ConsoleLogSink()]),
  configSources: [new MemoryConfigSource()],
  modules: [projectModule],
});
await kernel.boot();

const projects = await kernel.services.resolve(PROJECT_MANAGER_TOKEN);
const game = await projects.create({
  name: 'Nebula Drift',
  rootPath: '/games/nebula',
  engine: 'unity',
  targetPlatforms: ['windows', 'xbox'],
});
await projects.open(game.id);
// … Memory / Knowledge / Missions later resolve this project and use its namespaces.
await kernel.shutdown();
```

## Supported operations

| Operation | Behavior |
| --------- | -------- |
| Create    | Validate → store → emit `project.created` (status starts `draft`). |
| Open      | Guard state → `draft/closed/archived → open` → emit `project.opened`. Idempotent. |
| Close     | Guard state → `open → closed` → emit `project.closed`. Idempotent. |
| Rename    | Re-validate → emit `project.renamed` (+ `project.updated`). |
| Update    | Patch (immutable) → emit `project.updated` with changed fields. |
| Delete    | Emit `project.deleted` → remove from registry (irreversible). |
| List      | Return all tracked projects in insertion order. |
| Validate  | Return violations for a project's current state (non-throwing). |

## Design properties

- **Strict TypeScript** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **SOLID** — single responsibility per component; manager depends on `EventBusContract`/`Logger` abstractions.
- **Dependency Injection** — bus/logger/factory/registry all injected; the kernel wires it via tokens.
- **Event-driven** — all transitions flow through the shared bus.
- **No circular dependencies** — `project → {shared, di, events, kernel, logging}`, never the reverse.
- **No singleton abuse** — `ProjectManager` is constructed by the caller/container; the registry is held by the manager, not as module global state.
- **High testability** — pure validators, injectable clocks/ids, and a framework-free `FakeEventBus` double.

---

## Engineering Summary

### Architectural decisions

1. **Aggregate-root first.** `Project` is the root entity; Memory/Knowledge/Mission
   namespaces are first-class fields so future subsystems have a home without a
   schema migration. Open-set unions (`TargetPlatform`, `ProgrammingLanguage`)
   keep the core stable while extensions add new values.
2. **Construction centralized in `ProjectFactory`.** All defaulting, namespace
   derivation, id/time stamping, and validation live in one injectable, pure
   unit. The manager never assembles raw objects, so invariants can't leak.
3. **Registry is storage-only.** It answers store/fetch/list/remove and enforces
   the two uniqueness invariants (id, root path). No events, no lifecycle — so
   it stays trivially testable and swappable for a persistent backend later.
4. **Manager is the orchestrator, not a god-object.** It sequences
   factory → registry → events, guards lifecycle transitions, and owns no
   singleton. Each operation maps to one or two events with precise payloads.
5. **Strongly-typed events.** The catalog mirrors `@gamedev-agent/events`
   conventions (`EventDefinition` + payload interface, `version: 1`). This is
   what lets downstream packages subscribe with full type inference.
6. **Kernel coupling via the public module contract only.** `projectModule`
   depends on `KernelModule`/`ServiceContainer`/`StudioKernel` — the kernel's
   exported surface — never on its internals. The dependency arrow is clean:
   `project → kernel`, and kernel has no dependency on project.

### Package boundaries

```
project
 ├─ depends on: shared, di, events, kernel (public API), logging
 └─ depended on by: applications, and future memory/knowledge/mission packages
```

`project` introduces **no** new foundational primitive; it composes the existing
`shared` (brands, `NAMESPACE_SEPARATOR`), `di` (tokens), `events`
(`EventDefinition`, `Clock`/`IdGenerator`), and `kernel` (module contract)
building blocks.

### Dependency direction

```
apps → project → kernel → {events, di, logging} → shared
                           project ↘ events
```

No cycles: projects know about the kernel's public contract, but the kernel does
not know about projects. Events and DI are leaves below both.

### Future extensibility

- **Persistence** — replace or wrap `ProjectRegistry` behind the same surface
  (file store, database). The manager and events are unaffected.
- **Memory / Knowledge / Missions** — resolve `PROJECT_MANAGER_TOKEN`, read the
  project, and write into its `memoryNamespace` / `knowledgeNamespace` /
  `missionNamespace`. No change to this package required.
- **Plugins / Model Router / Workflow** — consume the `plugins` / `model` /
  `workspace` / `git` configuration blocks already present on every project.
- **Distributed Nova** — events already carry `source`, `correlationId`, and
  `trace`; a remote bus transport can replay `project.created` etc. across
  Studio/Web/CLI without code changes here.

### Assumptions made during implementation

- The monorepo npm scope remains `@gamedev-agent/*` (established convention);
  the package is *branded* **Nova** in its name, comments, and docs per the
  rename. A future repo-wide scope migration (`@nova/*`) is orthogonal and
  mechanical.
- A project's `rootPath` is the uniqueness key for source-of-truth collision
  (two projects cannot own the same path). Id is the stable identity.
- Newly created projects start in `draft`; `open`/`close` drive the
  `draft → open → closed` lifecycle. `archived` is a valid terminal-ish state
  that may still be re-opened.
- The Project System performs **no filesystem I/O** in Sprint 4 (no directory
  creation, no `.git` init). Those side effects belong to a later
  persistence/workspace subsystem and will observe `project.created`/`opened`.
- Time and identity are injected (`Clock`, `IdGenerator`) and default to the
  events package's `SystemClock`/`UuidGenerator`, keeping the system portable
  and deterministic under test.
