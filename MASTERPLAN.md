# Nova — Masterplan

**Version:** 1.0
**Status:** Living Document
**Owner:** Chief Software Architect
**Last Updated:** 2026-07-16

> See `ADRs/0001-nova-vision.md` for the strategic re-alignment from "AI assistant"
> to "AI-native Game Development Studio", and `ROADMAP.md` for the build order.

---

## 1. Vision

Nova is an AI-native Game Development Studio. It is not a chatbot and not another AI coding assistant. It is a persistent, autonomous software studio that lives alongside the Creative Director, understands their codebase, their craft, and their intent, and operates as the entire game development team — Producer, Architect, Engineers, Artists, and more — in the production of interactive entertainment.

Our vision is a world where the friction between creative intent and shipped product is removed by a studio that scales with the Creative Director, learns from every Project, and enforces engineering discipline without slowing anyone down.

## 2. Mission

To deliver a durable, trustworthy, and extensible studio environment that empowers the Creative Director and their team across the entire lifecycle of a game — from concept and prototyping through production, launch, live operations, and long-tail maintenance — while preserving the authority, ownership, and creative control of the human who directs it.

## 3. Long-term Goals

- Establish Nova as the foundational studio layer for AI-native game production across studios of every size.
- Achieve deep, native integration with the dominant game engines and the platforms that host finished games.
- Build a memory architecture that accumulates project, team, and craft knowledge that compounds in value over years.
- Cultivate an open plugin ecosystem that lets studios extend the system to their own pipelines, genres, and workflows.
- Reach a level of reliability and predictability that makes the system safe to deploy in commercial, deadline-driven production.
- Evolve the platform continuously without breaking the workflows, contracts, and trust established with existing users.

## 4. Core Principles

- **Creative Director Authority.** The studio advises, automates, and executes, but final ownership of every creative and commercial decision rests with the Creative Director.
- **Trust Through Predictability.** Behavior must be consistent, explainable, and reproducible. Surprise is a defect.
- **Durability Over Novelty.** We optimize for systems that survive years of change, not demos that impress for a day.
- **Composability.** Small, well-defined capabilities compose into powerful workflows rather than monolithic features.
- **Transparency.** Every action, decision, and memory write is observable and auditable.
- **Safety by Construction.** The system must refuse unsafe operations and fail loudly rather than silently.

## 5. Engineering Philosophy

We engineer Nova the way we expect our users to engineer games: with discipline, testing, and respect for the long arc of a project.

- **Correctness before cleverness.** Working software that is boring to operate beats clever software that is exciting to demo.
- **Contracts over convention.** Explicit interfaces and guarantees, not implicit assumptions, are the unit of collaboration.
- **Small surfaces, strong guarantees.** Limit what a component can do so that its behavior is easy to reason about.
- **Incremental and reversible.** Every meaningful change should be observable and reversible.
- **Measure, then optimize.** Performance and quality decisions are grounded in evidence, not intuition.
- **Documentation is a deliverable.** Architecture, decisions, and boundaries are recorded as first-class artifacts.

## 6. Project Scope

Nova spans the operational layer of game development. It includes:

- A persistent runtime and operating environment for studio-driven development work.
- A memory system that captures and retrieves contextual, project-specific, and cross-project knowledge.
- A plugin framework that lets studios and third parties extend the system.
- Integration points with game engines, version control, build systems, and platform services.
- Workflow orchestration across the game development lifecycle.
- Observability, auditing, and safety controls for all autonomous behavior.

The system does not replace the engine, the platform, or the studio. It operates in the spaces between them, coordinating and accelerating work that humans still own.

## 7. What the System Will Do

- Understand and reason about a studio's codebase, assets, and production state.
- Plan, execute, and track Missions across the project lifecycle.
- Integrate natively with supported game engines and platforms.
- Persist and retrieve institutional and project knowledge through a memory-first architecture.
- Orchestrate complex, multi-step workflows that span tools, repositories, and services.
- Enforce engineering and quality standards through automation and guardrails.
- Expose all behavior through a plugin-first, extensible architecture.
- Provide transparent auditing of every autonomous action and decision.
- Adapt to a studio's conventions, genres, and pipelines over time.

## 8. What the System Will NOT Do

- It will not make irreversible decisions about creative or commercial direction on behalf of the team.
- It will not replace the game engine, the target platform, or the underlying build toolchain.
- It will not silently modify production code, assets, or infrastructure without explicit authorization.
- It will not fabricate facts, APIs, or capabilities and present them as verified truth.
- It will not lock studios into proprietary formats or unexportable knowledge.
- It will not prioritize feature breadth over stability, safety, and predictability.
- It will not operate outside the boundaries defined by its configured permissions and safety contracts.

## 9. Supported Platforms

Nova is designed to operate across the platforms where modern games are built and shipped:

- Windows
- macOS
- Linux
- Console development environments
- Mobile development environments
- Cloud and CI/CD build infrastructure

Platform support is delivered through abstraction layers and plugins so that the core system remains platform-agnostic while integrations remain native and performant.

## 10. Supported Game Engines

The system is built to integrate with the engines that define professional game production:

- Unreal Engine
- Unity
- Godot
- Custom and proprietary in-house engines

Engine integration is achieved through well-defined adapters and plugins, allowing new engines to be supported without modifying the core system.

## 11. Plugin-first Architecture Philosophy

The core of Nova is intentionally small and stable. Almost everything that touches a specific engine, platform, pipeline, or studio convention is expressed as a plugin.

- **Core is a contract, not a feature set.** The core defines interfaces, safety boundaries, memory primitives, and orchestration. It stays narrow so it stays dependable.
- **Extensibility is the default.** If a capability is not universal, it belongs in a plugin, not the core.
- **First-class plugins.** Plugins are not afterthoughts or second-tier extensions. They use the same primitives and guarantees as the system itself.
- **Isolation and safety.** Plugins run within defined boundaries so that a faulty or malicious plugin cannot compromise the system or the project.
- **Discoverability and governance.** Plugins are registered, versioned, and auditable. Studios control which plugins are permitted in their environment.
- **Ecosystem longevity.** A stable plugin API is a promise. Breaking it is treated as a serious regression, not a routine change.

## 12. Performance-first Philosophy

Game development operates at the scale of millions of assets, massive codebases, and long build times. The system must respect that scale.

- **Latency is a feature.** Interactive operations must feel immediate; background work must not block human progress.
- **Scale is the baseline, not the edge case.** Designs are validated against large codebases, large asset libraries, and long-running productions.
- **Resource discipline.** CPU, memory, and I/O usage are bounded and predictable, even under sustained autonomous operation.
- **Cache and reuse.** Expensive work is memoized and shared so that repeated operations cost little.
- **Local-first when possible.** Work happens close to the data to avoid unnecessary network and serialization overhead.
- **Measure before claiming.** Performance claims are backed by benchmarks and production observation, not estimates.

## 13. Memory-first Philosophy

Memory is the defining capability that separates Nova from a stateless assistant. The system is designed from the ground up to remember.

- **Memory is persistent.** Knowledge survives sessions, restarts, and project handovers.
- **Memory is structured.** Context is captured with provenance, scope, and confidence so it can be retrieved and trusted.
- **Memory is project-aware.** The system distinguishes personal, project, team, and cross-project knowledge and applies each appropriately.
- **Memory compounds.** Every project makes the system more useful for the next, without leaking confidential context across boundaries.
- **Memory is governed.** Retention, access, and deletion are controllable and auditable.
- **Memory is a foundation, not a cache.** It informs planning, execution, and quality enforcement, not just conversation.

## 14. Development Methodology

Nova is developed like the production software it supports.

- **Long-lived, phased delivery.** The project progresses through clearly scoped phases with explicit exit criteria.
- **Contract-driven development.** Interfaces are defined and agreed before implementation begins.
- **Continuous integration and continuous verification.** Every change is built, tested, and measured automatically.
- **Incremental architecture.** Large capabilities are delivered as a sequence of small, landable, reversible steps.
- **Documentation alongside code.** Decisions, boundaries, and trade-offs are recorded as the work is done.
- **Backward compatibility as a constraint.** Stable interfaces are protected; breaking changes are rare, deliberate, and clearly communicated.
- **Feedback loops with real usage.** The system is validated against genuine production scenarios, not synthetic toys.

## 15. Roadmap Overview

The roadmap is organized as sprints, each with a stable contract and a measurable outcome. Sprints are intentionally independent so that progress in one area does not block another. The authoritative, ordered list lives in `ROADMAP.md`; the summary below reflects the Nova Vision.

- **Workspace** — the Creative Director's working surface grouping their Projects.
- **Mission** — the unit of planned work (replaces "task"), scoped to a Project.
- **Role System** — stable responsibilities (Producer, Lead Architect, Gameplay Engineer, …); models are interchangeable behind Roles.
- **Memory** — persistent, project-scoped, namespaced memory.
- **Knowledge** — structured/semantic knowledge substrate.
- **Planner** — translates Creative Director direction into dependency-aware Mission plans.
- **Workflow** — declarative orchestration of Missions across Roles and tools.
- **Router** — model routing by capability, cost, latency, and policy.
- **Extensions** — engine/tool adapters (Blender, Three.js, Godot, Unity, Unreal Engine, Roblox Studio).
- **Studio** — the Nova Studio application surface (Desktop/Web/CLI/VS Code).

Each sprint completes only when its quality standards are met, not when its features are merely present.

## 16. Quality Standards

Quality is non-negotiable and is defined before work begins, not assessed after.

- **Reliability.** The system behaves predictably under sustained, autonomous, long-running operation.
- **Correctness.** Operations produce the intended result and verify it before reporting success.
- **Safety.** Unsafe or unauthorized actions are prevented by construction and detected by guardrails.
- **Observability.** Every action, decision, and memory mutation is traceable and auditable.
- **Performance.** Operations meet defined latency, throughput, and resource budgets at production scale.
- **Compatibility.** Stable interfaces remain compatible across releases unless a deliberate, communicated change is made.
- **Testability.** Every capability is covered by automated verification at the appropriate level.
- **Maintainability.** Code and architecture remain comprehensible to the team that owns them years later.
- **Transparency.** Behavior is explainable to the humans who depend on it.

These standards are the acceptance bar for every phase, every release, and every plugin admitted into a production environment.
