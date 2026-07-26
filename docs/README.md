# Documentation

Architecture and operational documentation for Nova (the AI-native Game
Development Studio).

## Decision Records

- `../ADRs/0001-nova-vision.md` — the Nova Vision: why Nova is a studio, the
  user is the Creative Director, Roles replace Agents, Projects are
  first-class, and Missions replace Tasks.

## Roadmap

- `../ROADMAP.md` — revised sprint order (Workspace → Mission → Role System →
  Memory → Knowledge → Planner → Workflow → Router → Extensions → Studio).

## System Design

- `Workflow-Engine-Design.md` — goal-driven workflow engine.
- `Role-System-Design.md` — specialist Role system (Roles as responsibilities).
- `Studio-OS-Design.md` — studio operating system (layered architecture, 10-year view).

## Top-level

- `ARCHITECTURE.md` — subsystem specification.
- `MASTERPLAN.md` — vision, principles, and development methodology.
- `COGNITIVE_ARCHITECTURE.md` — reasoning pipeline and memory.
- `SRS.md` — software requirements.
- `MODEL_ROUTING.md` — model routing.
- `PLUGIN_SYSTEM.md` — plugin framework.
- `MEMORY_ARCHITECTURE.md` — memory design.

These documents are the source of truth for the system design and are referenced
by the implementation work in `packages/` and `apps/`.
