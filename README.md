# Nova

> **The AI-native operating system for game development.**

Nova is not a chatbot and not another AI coding assistant. It is an AI-native
**Game Development Studio**. The user is the **Creative Director**; Nova acts as
the entire game development team — producing games from idea to release through
long-term memory, planning, execution, and intelligent tool integration.

Nova thinks in **Projects, Missions, Knowledge, and Workflows** — not prompts.

## Studio Architecture

Nova is organized as a single studio run by the Creative Director. The canonical
hierarchy is:

```
Nova
 └── Workspace
      └── Projects
           └── Missions
                └── Roles
                     └── Execution
                          └── Memory
                               └── Knowledge
                                    └── Planner
                                         └── Workflow
                                              └── Router
                                                   └── Extensions
```

### Roles, not Agents

Nova is staffed by **Roles** — stable *responsibilities*, not AI models. A Role
owns a mandate; the model behind it is interchangeable compute. Models can
change; Roles remain stable.

Example roles: **Producer, Lead Architect, Gameplay Engineer, Engine Programmer,
Rendering Engineer, AI Engineer, Technical Artist, 3D Artist, Animator, UI/UX
Designer, Audio Engineer, QA Engineer, Documentation Engineer, Research
Engineer**.

### Missions, not Tasks

The unit of planned work is a **Mission** — a charter with intent, scope, and
acceptance — directed by the Creative Director and carried out by Roles. "Task"
implies a to-do item for an assistant; "Mission" reflects studio semantics.

### Projects are first-class

Everything in Nova belongs to a **Project** (shipped in Sprint 4 as
`@gamedev-agent/project`, the root aggregate). Memory, Knowledge, Missions,
Plugins, Model configuration, Workspaces, and Git repositories are all scoped to
a Project.

## Long-term Architecture

**Applications**
- Nova Studio
- Nova Web
- Nova CLI
- Nova VS Code

**Core**
- Kernel
- Event Bus
- Workspace
- Projects
- Missions
- Memory
- Knowledge
- Planner
- Workflow
- Router
- Orchestrator

**Extensions**
- Blender
- Three.js
- Godot
- Unity
- Unreal Engine
- Roblox Studio

## Terminology

| Avoid | Use |
|-------|-----|
| Agent | Role |
| Assistant | Studio / Role |
| Chat | Studio (communication surface) |
| Prompt | Direction / Brief |
| Task | Mission |

> The npm scope remains `@gamedev-agent/*` for monorepo continuity; the product
> is branded **Nova** in all prose and code-facing comments.

## Layout

```
apps/        Studio-facing applications (CLI, shell, tooling)
packages/    Foundational libraries (kernel, di, events, shared, config, logging, project)
plugins/     External capability drivers (VCS, build, asset tools, stores)
docs/        Architecture and operational documentation
scripts/     Repository maintenance utilities
tests/       Cross-package integration tests
```

## Packages

| Package                       | Responsibility                                              |
| ----------------------------- | ----------------------------------------------------------- |
| `@gamedev-agent/shared`       | Cross-cutting types, brands, constants, and small utilities |
| `@gamedev-agent/di`           | Type-safe dependency-injection container and service registry |
| `@gamedev-agent/config`       | Configuration source/schema contracts + reference impls    |
| `@gamedev-agent/logging`      | Structured, namespaced logging contracts + reference impls |
| `@gamedev-agent/events`       | Event-bus / incident-bus / telemetry-bus contracts + impl  |
| `@gamedev-agent/kernel`       | Lifecycle, boot/shutdown, and module composition           |
| `@gamedev-agent/project`      | Project System — the root object model for every Nova project |

## Commands

```bash
pnpm install        # install workspace
pnpm build          # build all packages (topological)
pnpm typecheck      # strict type-check every package
pnpm lint           # biome lint + format check
pnpm test           # vitest across workspace
pnpm dev            # watch mode for development
pnpm clean          # remove build artifacts
```

## Design Principles

- **ESM-only, no CommonJS.** Every package is `"type": "module"`.
- **Strict TypeScript.** `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- **No circular dependencies.** Dependency graph is a DAG (see `packages`).
- **Path aliases** (`@gamedev-agent/*`) resolve to sources for fast editor/typecheck.
- **Independent packages.** Each package builds, type-checks, lints, and tests alone.
- **Scale-invariant.** The same foundation powers one developer or a full studio.

## Documentation

- `ADRs/0001-nova-vision.md` — the Nova Vision architecture decision.
- `ROADMAP.md` — revised sprint order (Workspace → Mission → Role System → …).
- `ARCHITECTURE.md`, `MASTERPLAN.md`, `Studio-OS-Design.md`,
  `Role-System-Design.md`, and the files under `docs/` — detailed system design.
