# ADR 0001: Nova Vision

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Chief Software Architect, Lead Systems Engineer
- **Supersedes:** Original "GameDev Agent" product framing

---

## 1. Context

The product previously described itself as an "AI operating system for game
development" and, in places, as an "AI coding assistant" / "agent runtime".
Usage and language in the codebase, docs, and package descriptions still lean on
assistant-style terminology: *agent*, *assistant*, *chat*, *prompt*, *task*.

That framing is a poor fit for the actual ambition and is actively misleading to
users and contributors. Nova is not a chatbot and not an assistant that answers
prompts. It is an **AI-native Game Development Studio**: the user is the
**Creative Director**, and Nova supplies the entire development team.

This ADR records the strategic re-alignment so that every later document,
package, and sprint plans against the same mental model.

---

## 2. Decision

### 2.1 Nova is a Game Development Studio, not a tool

Nova is the studio. It provides the environment, the team, the tooling, and the
process. The person at the keyboard is not "prompting a bot"; they are directing
a studio. All product language, UX metaphors, and architecture narratives must
reflect a studio, not a chatbot.

### 2.2 The user is the Creative Director

Final creative and commercial authority rests with the human. Nova executes,
proposes, and operates, but the human sets vision, approves direction, and owns
the result. "User" in older docs is promoted to **Creative Director** in
product-facing language.

### 2.3 Roles, not Agents

Nova is staffed by **Roles** — stable responsibilities (Producer, Lead
Architect, Gameplay Engineer, Rendering Engineer, AI Engineer, Technical Artist,
3D Artist, Animator, UI/UX Designer, Audio Engineer, QA Engineer,
Documentation Engineer, Research Engineer). A Role is a *responsibility boundary*,
not a model and not a chat persona. Models are interchangeable compute behind a
Role; swapping the model must not change the Role's mandate. This decouples the
product from any single AI vendor or model generation and keeps the org chart
stable for years.

### 2.4 Projects are first-class objects

Everything in Nova belongs to a **Project** (Sprint 4 already shipped
`@gamedev-agent/project` as the root aggregate). Memory, Knowledge, Missions,
Plugins, Model configuration, Workspaces, and Git repositories are all scoped to
a Project. The Project is the system of record and the dependency root for every
future subsystem.

### 2.5 Missions replace Tasks

The unit of planned work is a **Mission**, not a *task*. "Task" implies a
to-do item for an assistant. A Mission implies a charter with intent, scope, and
acceptance — directed by the Creative Director and carried out by Roles. The
vocabulary shift reinforces studio semantics throughout planning, execution, and
reporting.

### 2.6 Canonical hierarchy

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

`Workspace` is the new container that groups the Creative Director's projects
under one working surface. It sits above `Projects` and below `Nova`.

### 2.7 Long-term architecture (applications, core, extensions)

**Applications:** Nova Studio · Nova Web · Nova CLI · Nova VS Code

**Core:** Kernel · Event Bus · Workspace · Projects · Missions · Memory ·
Knowledge · Planner · Workflow · Router · Orchestrator

**Extensions:** Blender · Three.js · Godot · Unity · Unreal Engine · Roblox Studio

### 2.8 Terminology substitution

| Avoid | Use |
|-------|-----|
| Agent | Role |
| Assistant | Studio / Role |
| Chat | Studio (communication surface) |
| Prompt | Direction / Brief |
| Task | Mission |

---

## 3. Consequences

- **Positive:** A single, coherent product story. Stable Role/Project/Mission
  model that outlives model and tooling churn. Clean dependency direction
  (everything depends on Projects).
- **Positive:** Future subsystems (Workspace, Missions, Roles, Memory,
  Knowledge, Planner, Workflow, Router, Orchestrator, Extensions, Studio) have an
  explicit home in the hierarchy and roadmap.
- **Negative:** Existing docs and code comments that use agent/assistant/task
  terminology are now inconsistent and must be aligned (this sprint).
- **Negative:** The npm scope remains `@gamedev-agent/*` for monorepo
  continuity; a later mechanical rename to `@nova/*` is possible but out of scope
  and must not block this alignment.
- **Neutral:** No runtime packages change. This is a documentation, terminology,
  and planning alignment only.

---

## 4. References

- `ROADMAP.md` — revised sprint order (Workspace → Mission → Role System → …).
- `packages/project` — the shipped Project System (root aggregate).
- `Studio-OS-Design.md`, `Role-System-Design.md` — detailed subsystem designs.
