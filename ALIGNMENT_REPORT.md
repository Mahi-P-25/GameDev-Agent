# Architecture Alignment Report — Nova Vision Sprint

**Date:** 2026-07-16
**Sprint type:** Architecture alignment (no runtime changes)
**Scope:** Documentation, terminology, planning, and the new Studio architecture
**Author:** Chief Software Architect

---

## 1. Objective

Align the entire documentation and planning surface with the evolved Nova
product vision:

- Nova is an **AI-native Game Development Studio**, not a chatbot or AI coding
  assistant.
- The user is the **Creative Director**; Nova is the entire development team.
- Work is organized as **Projects → Missions → Roles → Execution**.
- **Roles** are stable responsibilities (not AI models); **Missions** replace
  "tasks".
- Introduce the canonical **Studio → Workspace → Projects → …** hierarchy and the
  long-term Applications / Core / Extensions architecture.

No working packages were modified. Only docs, terminology, and planning changed.

---

## 2. Changes by artifact

### 2.1 New documents

| File | Purpose |
|------|---------|
| `ADRs/0001-nova-vision.md` | The "Nova Vision" Architecture Decision Record. Captures *why* Nova is a studio, *why* the user is the Creative Director, *why* Roles replace Agents, *why* Projects are first-class, and *why* Missions replace Tasks. Includes the canonical hierarchy and the terminology substitution table. |
| `ROADMAP.md` | New sprint order: **Workspace → Mission → Role System → Memory → Knowledge → Planner → Workflow → Router → Extensions → Studio**. Each sprint lists scope and dependencies. |
| `ALIGNMENT_REPORT.md` | This report. |

### 2.2 Root `README.md`

- Replaced the "GameDev Agent" intro with the Nova studio vision.
- Added the **Studio Architecture** section (canonical hierarchy diagram).
- Added **Roles, not Agents** and **Missions, not Tasks** explanations with the
  example role catalog.
- Added the **Long-term Architecture** (Applications / Core / Extensions).
- Added a **Terminology** table (Agent→Role, Assistant→Studio, Chat→Studio,
  Prompt→Direction, Task→Mission).
- Noted the npm scope remains `@gamedev-agent/*` for monorepo continuity.
- Updated the Packages table and Documentation section.

### 2.3 `docs/README.md`

- Now references the new ADR and `ROADMAP.md`, and lists all top-level design
  docs.

### 2.4 `ARCHITECTURE.md`

- Title → "Architecture Specification: Nova".
- New **Studio Architecture** section (hierarchy + Roles/Missions/concepts +
  terminology table) inserted after the philosophy.
- Reworded the high-level architecture to use **Orchestrator (Executor)**,
  **Nova Studio / Nova Web / Nova VS Code / Nova CLI**, and **Missions/Roles**.
- Planner/Executor/Project Manager sections updated: "tasks → Missions",
  "agents → Roles", and "Project Manager is the first-class root object".
- Renamed subsection headers: "Desktop App" → "Nova Studio (Desktop App)",
  "Website" → "Nova Web (Website)".
- Replaced remaining prose "GameDev Agent" references.

### 2.5 `MASTERPLAN.md`

- Title → "Nova — Masterplan"; owner → Chief Software Architect.
- Vision/Mission rewritten around the studio and Creative Director.
- "Human Authority" principle → "Creative Director Authority".
- Project Scope / "What the System Will Do" use "Missions".
- Roadmap Overview rewritten to point at `ROADMAP.md` and the new sprint order.
- Remaining "GameDev Agent" prose replaced with "Nova".

### 2.6 `Studio-OS-Design.md`

- Title → "Nova — Studio Operating System"; vision line updated.
- "Roles are processes" → "Roles are responsibilities" (models interchangeable
  behind Roles).
- Added a new **Workspace** section (the Creative Director's working surface,
  above Projects) and updated the Projects intro to call Projects the
  first-class root object.
- "human/role" and "tasks" wording → "Role" / "Missions" in the Teams section.
- Summary line updated to Nova.

### 2.7 `Role-System-Design.md`

- Title → "Nova — Specialist Role System".
- Scope note reframed: Roles are responsibilities, not models; models are
  interchangeable compute behind a Role.
- Role Contract clarified to state the model is selected by the Router from a
  capability requirement.

### 2.8 `COGNITIVE_ARCHITECTURE.md`

- Title → "Cognitive Architecture Specification: Nova".
- AI Philosophy: "not a chatbot", "studio", "Creative Director's direction",
  "stable Roles rather than a monolithic assistant". Goal-driven phrasing updated.

### 2.9 `SRS.md`

- Title → "Software Requirements Specification: Nova".
- Purpose/Scope rewritten for the studio under a Creative Director.
- Definitions table: **Agent → Role**, added **Mission**, **Workflow** reworded
  to orchestrate Roles.
- Global terminology swap: "task(s)" → "Mission(s)" across requirements; the
  "GameDev Agent envisions" line fixed.

### 2.10 `MODEL_ROUTING.md`, `PLUGIN_SYSTEM.md`, `Workflow-Engine-Design.md`

- Titles and intro lines updated to Nova; "user" → "Creative Director" where
  appropriate; "user goals" → "Creative Director's direction"; Role/capability
  framing added to model routing; remaining "GameDev Agent" prose replaced.

### 2.11 Package READMEs

- Prose "GameDev Agent" → "Nova" in `shared`, `di`, `config`, `logging`,
  `events`, `kernel` READMEs. The `@gamedev-agent/*` npm scope and import paths
  were intentionally **left unchanged** to preserve monorepo continuity.

---

## 3. Terminology substitution applied

| Avoid | Use | Applied in |
|-------|-----|------------|
| Agent | Role | Role-System-Design, ARCHITECTURE, SRS Definitions, Studio-OS, model routing |
| Assistant | Studio / Role | ARCHITECTURE, MASTERPLAN, root README |
| Chat | Studio (communication surface) | root README terminology table |
| Prompt | Direction / Brief | root README, COGNITIVE, MASTERPLAN |
| Task | Mission | SRS (global), ARCHITECTURE, MASTERPLAN, Workflow, Studio-OS |

---

## 4. What was explicitly NOT changed

- **No source code.** Every `packages/*` implementation, the Kernel, Event Bus,
  and the shipped Project System are untouched. This was a documentation/planning
  sprint per the brief.
- **npm scope** `@gamedev-agent/*` was retained; a repo-wide rename to `@nova/*`
  is a mechanical, separable change and out of scope. Noted as an assumption in
  both the ADR and the project README.
- **Detailed subsystem rewrites** (e.g. re-authoring all 19 ARCHITECTURE sections)
  were avoided to prevent over-engineering; only high-level framing and affected
  terms were aligned. The existing designs remain valid and now sit under the new
  vocabulary.

---

## 5. Assumptions

- The brief's terminology map is authoritative; "Execution" and "Pipeline" map
  naturally to the existing Executor/Workflow/Orchestrator concepts and were
  aligned without inventing new subsystems.
- The canonical hierarchy's lower tiers (Memory, Knowledge, Planner, Workflow,
  Router, Extensions) already exist as planned subsystems; this sprint only
  placed them explicitly in the hierarchy and roadmap.
- "Workspace" is a new conceptual container; its detailed spec is deferred to the
  Workspace sprint (Roadmap #1). This alignment introduces it at the architecture
  and terminology level only.

---

## 6. Verification

- Grep confirms zero remaining prose "GameDev Agent" references in product docs or
  package READMEs (the ADR's historical "Supersedes" note is intentional).
- All changes are Markdown; no build, type-check, or test surfaces were affected.
- No `packages/**` source files were modified, so the previously green
  typecheck/lint/test state is preserved.
