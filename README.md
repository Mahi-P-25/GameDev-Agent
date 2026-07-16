# GameDev Agent

> **The operating system of a game studio.**

GameDev Agent is not a coding assistant. It is a runtime that schedules cognition,
governs memory, routes work, and operates the full studio lifecycle — from concept to
live operations. One architecture scales from a solo developer to a AAA organization.

This repository is the **production workspace foundation** (Phase 1 — Sprint 1). It
establishes the monorepo, the shared architectural contracts, and the build/test/lint
toolchain. Business logic is implemented in later sprints on top of these boundaries.

## Stack

| Concern        | Choice                                            |
| -------------- | ------------------------------------------------- |
| Language       | TypeScript (strict, ESM-only)                     |
| Package manager| pnpm workspaces                                   |
| Build orchestr.| TurboRepo                                          |
| Bundler        | tsup (ESM, dts, treeshake)                         |
| Formatter/Lint | Biome                                             |
| Tests          | Vitest                                            |
| Releases       | Changesets                                        |

## Layout

```
apps/        Studio-facing applications (CLI, shell, tooling)
packages/    Foundational libraries (kernel, di, events, shared, config, logging)
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

See the architecture documents (`docs/`) for the full system design.
