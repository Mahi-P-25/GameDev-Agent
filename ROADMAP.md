# Nova — Roadmap

> Architecture alignment sprint complete. This roadmap reflects the **Nova
> Vision** (see `ADRs/0001-nova-vision.md`): Nova is an AI-native Game
> Development Studio; the user is the **Creative Director**; work is organized as
> **Projects → Missions → Roles → Execution**, supported by Memory, Knowledge,
> Planner, Workflow, Router, and Extensions.

## Ordered sprints

Each sprint ships a stable contract and a measurable outcome. Phases are
independent so progress in one area does not block another. Future sprints build
on the already-shipped **Kernel**, **Event Bus**, and **Project System**.

| # | Sprint | Scope | Depends on |
|---|--------|-------|------------|
| 1 | **Workspace** | The working surface that groups the Creative Director's projects. Lifecycle, membership, and the Workspace → Projects containment model. | Kernel, Event Bus, Projects |
| 2 | **Mission** | The unit of planned work (replaces "task"). Mission lifecycle, acceptance, and scoping under a Project. Emits `mission.*` events. | Projects, Event Bus |
| 3 | **Role System** | Roles as stable responsibilities (Producer, Lead Architect, Gameplay Engineer, …). Role contracts, activation, and authority tiers. Models are swappable behind Roles. | Projects, Missions, Event Bus |
| 4 | **Memory** | Persistent, project-scoped, namespaced memory (the `memoryNamespace` already carved out on every Project). | Projects, Kernel |
| 5 | **Knowledge** | Structured/semantic knowledge substrate (the `knowledgeNamespace` on every Project). | Projects, Memory |
| 6 | **Planner** | Translates Creative Director direction into dependency-aware Mission plans. | Missions, Memory, Knowledge |
| 7 | **Workflow** | Declarative, versioned orchestration of Missions across Roles and tools. | Missions, Roles, Event Bus |
| 8 | **Router** | Model routing by capability, cost, latency, and policy. Roles declare *needed capability*, never a model name. | Kernel, Event Bus |
| 9 | **Extensions** | Engine/tool adapters (Blender, Three.js, Godot, Unity, Unreal Engine, Roblox Studio). | Kernel, Workflow, Router |
| 10 | **Studio** | The Nova Studio application surface (Desktop/Web/CLI/VS Code) tying Workspace, Missions, Roles, and Execution into one Creative Director experience. | All of the above |

## Principles

- **Projects first, always.** Every subsystem is scoped to a Project; Projects
  are the dependency root.
- **Roles, not agents.** Responsibilities are stable; models are interchangeable.
- **Missions, not tasks.** Work is chartered with intent and acceptance.
- **No runtime churn from this alignment.** This document records planning and
  terminology only; no working packages were modified.

## Terminology

| Avoid | Use |
|-------|-----|
| Agent | Role |
| Assistant | Studio / Role |
| Chat | Studio (communication surface) |
| Prompt | Direction / Brief |
| Task | Mission |
