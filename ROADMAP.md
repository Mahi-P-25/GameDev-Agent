# Nova Engineering Roadmap

> Practical build plan from the existing codebase to Nova v1.0.
> Every phase produces a working, testable system.

---

## Build Philosophy

| Principle | How It Affects This Roadmap |
|-----------|----------------------------|
| Working system every phase | Each phase ends with a testable milestone, not a design document |
| Smallest useful version first | Phase 1 is ~2 weeks, not 6 months |
| Reduce uncertainty | Every phase answers a specific "does this work?" question |
| Build on what exists | The codebase has 26 packages. This roadmap extends them. |
| Defer speculation | If a feature has no immediate consumer, it waits |

### Existing Assets (not starting from zero)

The codebase already provides:
- Full event bus with typed events
- Model providers (OpenAI, Anthropic, Gemini, DeepSeek, Ollama)
- Tool runtime with registration, connection, invocation, health monitoring
- Execution engine with context assembly, model dispatch, tool bridge
- Context pipeline (6 stages, 13 providers, 6 policies)
- Workflow engine with state machine, step ordering, pause/resume
- Planner with strategy pattern (DependencyGraphStrategy, SequentialPlanningStrategy)
- Coordinator with full mission lifecycle state machine
- Producer with goal analysis, mission tree generation, approval system
- Memory system (8 tiers, 12 categories, consolidation policies)
- Director with strategy formulation and decision logging
- Intelligence package with agent registry, task engine, planning engine
- Runtime providers (Git, Terminal, Filesystem, Workspace, Build, Test, Package, Process)
- Kernel lifecycle management (9-stage boot sequence)

**All phases below assume these exist.** Each phase specifies which existing packages it modifies and which new files it adds.

---

## Phase 1 — Core Intelligence

**Duration**: 2-3 weeks
**Question**: "Can Nova reason before executing and recover from failure?"

### Objective

Add explicit reasoning and structured recovery to the existing execution pipeline. Before every step, Nova decides *how* to execute (which model, which tools, which approach). When a step fails, Nova retries transient failures and escalates permanent ones with a diagnosis.

### What Changes

**New package: `@gamedev-agent/reasoning`** (~200 lines)

```
packages/reasoning/src/
├── ReasoningService.ts       # Core service: select model + tools + approach
├── ReasoningTypes.ts         # Input/output types (thin, no persistence)
├── ReasoningModule.ts        # Kernel module registration
└── index.ts
```

The Reasoning Service is called before every execution step. It:
1. Reads the step's requirements and the current context
2. Selects the best model from the `ModelRegistry` (capability matching + cost ranking)
3. Selects which tool actions to enable (relevance filtering)
4. Chooses an approach strategy (`generate`, `modify`, `research`)
5. Returns a lightweight decision object consumed immediately

No persistence. No alternatives tracking. No stored plans.

**New package: `@gamedev-agent/recovery`** (~150 lines)

```
packages/recovery/src/
├── RecoveryService.ts        # Core service: retry or escalate
├── RecoveryTypes.ts          # RecoveryAction type (retry | escalate)
├── RecoveryModule.ts         # Kernel module registration
└── index.ts
```

The Recovery Service subscribes to execution failure events. When a tool call fails:
1. Retry up to 3 times with configurable delay
2. If all retries fail, escalate with a diagnosis string
3. Publishes one event: `recovery.action-taken`

No `FailureDiagnosis` model. No fallback model switching. No re-reasoning.

**Modified: `@gamedev-agent/execution-engine`** (+2 lifecycle hooks)

Add hooks to `ExecutionEngine`:
- `beforeDispatch(step, context)`: Reasoning Service registers here
- `afterToolCall(result, step, context)`: Recovery Service registers here

These are callback registrations, not a new execution loop. The existing `executeStep()` flow is unchanged.

**Modified: `@gamedev-agent/producer`** (+1 method)

Add `Producer.enrichGoal(request)` that:
1. Calls the LLM once to detect ambiguity and propose success criteria
2. Attaches results to the existing `GoalAnalysis` as optional fields
3. No new data types

**Modified: `@gamedev-agent/execution-engine`** (+1 event)

Add `execution.step-reasoned` event published after reasoning completes (modelId, toolCount, approach). Used for observability.

Add `execution.step-recovering` event published when recovery activates (attempt, strategy).

### What the System Can Do After Phase 1

```
User submits: "Create a player controller with WASD movement"

Producer enriches goal → detects "which engine?" ambiguity → asks user
User: "Godot 4"

Planner creates execution plan (existing)
Workflow creates ordered steps (existing)
Execution Engine processes each step (existing):
  → Reasoning Service selects: model=claude-sonnet, tools=[filesystem], approach=generate
  → Context Pipeline assembles context (existing)
  → Model dispatched with instruction
  → Tool call: create player_controller.gd
     → If success: continue
     → If failure: Recovery Service retries (up to 3x)
       → If still failing: escalate with diagnosis
  → Next tool call...
```

### Dependencies

- Existing `execution-engine`, `model-providers`, `tool-runtime`, `context`, `producer`, `planner`, `workflow`
- Reasoning Service depends on: `ModelRegistry` (model info + capabilities), `ToolManager` (tool capabilities)
- Recovery Service depends on: Event Bus subscriptions

### Risks

| Risk | Mitigation |
|------|-----------|
| Reasoning Service becomes a bottleneck (sync call before every dispatch) | Service is deterministic (no LLM) for model/tool selection; only approach selection uses LLM. Cached. |
| Recovery retry loop hides real failures | Max 3 retries, each with escalating delay. After 3, always escalate. Configurable. |
| Goal enrichment adds latency to mission start | Single LLM call, timeout after 10s. If timeout, proceed without enrichment. |

### Success Criteria

1. A mission can complete end-to-end (goal → plan → execute → succeed/fail)
2. Reasoning selects a different model when step requires different capabilities
3. Transient tool failures are retried automatically
4. Permanent tool failures produce a clear escalation message
5. All existing tests pass (no regressions in existing 26 packages)

### What NOT to Build Yet

- Learning Engine (no data to learn from)
- Knowledge Graph (memory tags suffice)
- Decision Engine (thresholds in config, logic in each subsystem)
- Observer (recovery subscribes directly to events)
- Context Engine v2 (add providers in Phase 3)
- Executor wrapper (hooks in Execution Engine suffice)
- Fallback models in recovery (retry + escalate is enough)
- Alternative approaches in reasoning (single approach per step)

---

## Phase 2 — Tool Runtime

**Duration**: 2-3 weeks
**Question**: "Can Nova actually affect the developer's environment?"

### Objective

Complete the wiring between the execution engine and real development tools. The existing `tool-runtime` package has adapters (`GitToolAdapter`, `VSCodeToolAdapter`) and the `runtime` package has providers (`GitProvider`, `TerminalProvider`, `FilesystemProvider`). Phase 2 ensures every tool call from the execution engine actually reaches the intended tool and produces real results.

### What Changes

**Modified: `@gamedev-agent/tool-runtime`** (+3 tool adapters, +1 action schema)

Complete the `actionRegistry` mapping so the execution engine can route tool calls to:
- Terminal: `terminal.run`, `terminal.start`, `terminal.stop`, `terminal.output`
- Filesystem: `files.create`, `files.write`, `files.read`, `files.list`, `files.delete`, `files.rename`
- Git: `git.init`, `git.status`, `git.commit`, `git.push`, `git.pull`, `git.branch`
- VS Code: `vscode.open`, `vscode.edit`, `vscode.search`, `vscode.diagnostics`

**Modified: `@gamedev-agent/runtime`** (+VS Code provider)

The existing runtime has 8 providers. Add `VSCodeProvider` that:
- Detects VS Code installation
- Provides editor state (open files, cursor position, diagnostics)
- Supports `vscode.*` tool actions through the VS Code CLI or extension API

**Modified: `@gamedev-agent/execution-engine`** (+tool schema generation)

The existing `buildActionSchema()` maps action names to JSON Schema for model tool definitions. Extend it to include all actions from Phase 2.

### What the System Can Do After Phase 2

```
Nova can:
- Create files with real content
- Read existing files
- Edit files in place
- List directory contents
- Delete and rename files
- Run terminal commands (npm install, godot --build, etc.)
- Check git status
- Stage and commit changes
- Open files in VS Code
- Read VS Code diagnostics
```

### Dependencies

- Phase 1 complete (execution engine wired to reasoning + recovery)
- VS Code extension must be developed or CLI adapter sufficient

### Risks

| Risk | Mitigation |
|------|-----------|
| Terminal commands have side effects | All terminal commands run in project directory. No sudo. Timeout enforced. |
| File writes could overwrite user work | Git status checked before writes. Dry-run mode for destructive operations. |
| VS Code integration requires extension | Fall back to filesystem-only mode if VS Code not available. |

### Success Criteria

1. Execute a mission that creates a file, runs a terminal command, and commits to git
2. Tool calls produce real files on disk (verifiable by inspection)
3. Tool failures produce real error messages (not "tool failed" generic)
4. VS Code integration works when VS Code is installed
5. All actions have JSON Schema definitions usable by model providers

### What NOT to Build Yet

- Remote tool execution (local only)
- Tool sandboxing beyond directory scoping (Phase 5)
- Tool permission system beyond basic allow/deny (Phase 5)
- Network-based tool verification

---

## Phase 3 — Memory

**Duration**: 3-4 weeks
**Question**: "Can Nova remember what it did and use that memory?"

### Objective

Wire the existing memory system into the intelligence pipeline so that every mission, decision, error, and recovery is persisted and retrievable. Add memory-aware context providers so Nova can recall past work.

### What Changes

**Modified: `@gamedev-agent/memory`** (+relationships field, +execution store)

Add optional `relationships` array to `MemoryEntry`:
```
relationships?: Array<{
  targetId: string;       // memory entry id or external entity id
  type: string;           // 'depends-on' | 'implements' | 'fixes' | 'related-to'
  weight: number;         // 0-1
}>
```

This enables basic graph queries without a full Knowledge Graph subsystem.

Add `'execution'` category support (already in `MemoryCategory` type) for storing execution traces, step results, and tool call records.

**Modified: `@gamedev-agent/context`** (+2 providers)

Add to existing `packages/context/src/providers/`:
- `ProjectMemoryProvider`: Queries Memory for project-tier entries relevant to the current goal
- `PreviousMissionProvider`: Queries Memory for similar missions (by goal intent, constraints, or tags)

Both register through the existing `ContextProviderRegistry`. No new pipeline stages.

**Modified: `@gamedev-agent/execution-engine`** (+MemoryRecorder enrichment)

The existing `MemoryRecorder` already stores step results. Enrich it to also store:
- Reasoning decisions (model chosen, tools used, approach selected)
- Recovery actions (retries, escalations)
- Full execution trace (ordered tool call results with timestamps)

**New package: `@gamedev-agent/trace`** (~100 lines)

A lightweight trace buffer that records mission executions as they happen. Stored in Memory on mission completion. Provides a query interface for "what happened during mission X?" Used by the UI and for post-mission analysis.

Not a full Learning Engine — just structured storage.

### What the System Can Do After Phase 3

```
Nova can remember:
- Every mission it completed (success or failure)
- Which model was used for each step
- What tools were invoked and what they returned
- What errors occurred and how they were handled
- Which files were created or modified

Nova can recall:
- Past missions with similar goals
- Project-wide decisions and architecture notes
- Whether a similar task succeeded or failed before

Nova can answer:
- "Have I tried this approach before?"
- "What happened when I ran this command last time?"
- "Which files did the last physics refactor touch?"
```

### Dependencies

- Phase 1 complete (missions produce execution data worth storing)
- Existing `memory` package (all infrastructure exists, just needs wiring)

### Risks

| Risk | Mitigation |
|------|-----------|
| Memory grows unbounded | Existing consolidation policies handle tier promotion/demotion. Execution traces stored in `session` tier with TTL. |
| Memory queries on every step slow execution | Context providers are cached. Query is async with timeout. Default to empty if timeout. |
| Relationship tracking becomes complex quickly | Start with flat array. No graph traversal in v1. |

### Success Criteria

1. Complete a mission → verify execution trace is stored in Memory
2. Start a new mission → verify relevant past missions appear in context
3. Query memory for "missions that modified files in src/character/" → returns results
4. Memory consolidation policies apply to execution traces (traces expire, promote frequently accessed)
5. trace service returns structured timeline of any completed mission

### What NOT to Build Yet

- Learning Engine (pattern extraction, recommendations, pruning)
- Knowledge Graph (relationship field on MemoryEntry is sufficient)
- Cross-project memory sharing
- Memory visualization UI (CLI query is enough for v1)

---

## Phase 4 — Specialist Agents

**Duration**: 4-5 weeks
**Question**: "Can Nova act as a team of specialists rather than a monolithic assistant?"

### Objective

Implement the first three specialist agents: Architect, Gameplay Engineer, and Blender Specialist. Each agent has specific capabilities, tool access, and reasoning strategies. The existing `Intelligence` package provides the `AgentRegistry`, `TaskEngine`, and `PlanningEngine` — this phase creates real agents that register with them.

### What Changes

**Modified: `@gamedev-agent/intelligence`** (+3 agent definitions, +role-based policies)

Register three specialist agents:

| Agent | Capabilities | Tools | Model Preference |
|-------|-------------|-------|-----------------|
| **Architect** | Project structure, module boundaries, dependency analysis, API design | filesystem, git, vscode | claude-sonnet (best at architecture) |
| **Gameplay Engineer** | Code generation, gameplay systems, engine APIs, debugging | filesystem, terminal, git, vscode | gpt-4o (best at code) |
| **Blender Specialist** | Python scripting, 3D math, Blender API, asset pipeline | filesystem, terminal | deepseek-coder (best at python/3D) |

Each agent has:
- A `reasoningStrategy` that biases model/tool/approach selection toward its specialty
- A `contextPolicy` (extending the existing `AgentRole` policies in the context package)
- An `actionRegistry` subset (only tools relevant to its role)

**Modified: `@gamedev-agent/context`** (+3 agent policies)

Add context policies for each specialist agent:
- `ARCHITECT_POLICY`: maxTokens=32000, providers=[architecture, project-memory, knowledge-graph?]
- `GAMEPLAY_ENGINEER_POLICY`: maxTokens=64000, providers=[code, git, file-system]
- `BLENDER_SPECIALIST_POLICY`: maxTokens=32000, providers=[asset, file-system, terminal]

**Modified: `@gamedev-agent/reasoning`** (+role-based reasoning)

The Reasoning Service now considers the agent's role when selecting models, tools, and approaches:
- An Architect task defaults to `analyze` approach with `claude-sonnet`
- A Gameplay Engineer task defaults to `generate` approach with `gpt-4o`
- A Blender Specialist task defaults to `compose` approach with `deepseek-coder`

**New: `@gamedev-agent/agent-coordinator`** (~300 lines)

Coordinates interaction between specialist agents when a mission requires multiple specialties. For example, creating a character that needs:
1. Architect: Define component structure
2. Gameplay Engineer: Implement movement script
3. Blender Specialist: Create 3D model

The Agent Coordinator:
1. Breaks mission into specialty-specific sub-missions
2. Assigns each to the appropriate agent
3. Manages handoff (Architect's component structure → Gameplay Engineer's implementation)
4. Handles cross-agent dependency resolution

### What the System Can Do After Phase 4

```
Mission: "Create a player character with a 3D model and WASD movement"

1. Producer analyzes goal → detects architecture + gameplay + asset work
2. Agent Coordinator decomposes:
   Sub-mission A: Architect (design component tree, data flow)
   Sub-mission B: Gameplay Engineer (implement movement controller)
   Sub-mission C: Blender Specialist (model, rig, export character)
3. Sub-mission A executes first (Architect designs structure)
4. Sub-missions B and C execute in parallel (engineer implements controller, specialist models)
5. Results merged: movement.gd created, character.blend exported, structure documented
```

### Dependencies

- Phase 1 complete (reasoning + recovery)
- Phase 2 complete (tools for each specialty)
- Phase 3 complete (memory for agent-specific context)

### Risks

| Risk | Mitigation |
|------|-----------|
| Agents produce incompatible outputs (Architect designs X, Engineer implements Y) | Agent Coordinator validates interfaces between sub-missions. Architect produces explicit contracts. |
| Blender not installed | Agent checks availability before accepting tasks. Graceful refusal. |
| Agent coordination overhead > benefit | Start with sequential handoff, not parallel execution. Optimize later. |
| Token costs with multiple agents | Each agent uses role-appropriate model. Reasoning Service selects cheapest capable model. |

### Success Criteria

1. Architect agent produces a structural plan for a simple gameplay system
2. Gameplay Engineer agent generates working code from Architect's design
3. Blender Specialist agent creates/edits a Blender file via Python scripting
4. Agent Coordinator handles a multi-specialty mission end-to-end
5. Each agent's context policy is measurably different (different providers, different budgets)

### What NOT to Build Yet

- Agent negotiation or conflict resolution (Agent Coordinator is a dispatcher, not a mediator)
- Dynamic agent creation (all agents are predefined in v1)
- Agent learning (agents don't improve from experience yet — that's Phase 7+)
- Hierarchical agent teams (Architect doesn't manage the Engineer; Coordinator does)

---

## Phase 5 — Skills

**Duration**: 4-5 weeks
**Question**: "Can Nova have deep expertise in specific engines and tools?"

### Objective

Create the Skills system — a plugin-like mechanism for engine-specific and tool-specific knowledge. A Skill is a bundle of context providers, reasoning advice, tool configurations, and recovery knowledge for a specific domain.

### What Changes

**New package: `@gamedev-agent/skills`** (~500 lines)

```
packages/skills/src/
├── SkillRegistry.ts          # Register, resolve, query skills
├── SkillTypes.ts             # Skill interface and metadata
├── SkillLoader.ts            # Load skill from package or directory
├── SkillModule.ts            # Kernel module
├── skills/
│   ├── ThreeJsSkill.ts       # Three.js context + tools + patterns
│   ├── BlenderSkill.ts       # Blender Python API context
│   ├── GitSkill.ts           # Git workflow patterns
│   └── VSCodeSkill.ts        # VS Code editor integration patterns
└── index.ts
```

**Skill Interface**:
```
Skill {
  id: string;                    // 'three.js', 'blender', 'git', 'vscode'
  name: string;
  version: string;
  
  // Context providers this skill contributes
  contextProviders: ContextProvider[];
  
  // Tool configurations (which tools to enable)
  toolConfigs: ToolConfig[];
  
  // Model preferences (which model works best for this skill)
  modelPreferences: ModelPreference[];
  
  // Reasoning hints (how to approach tasks in this domain)
  reasoningHints: ReasoningHint[];
  
  // Recovery knowledge (known error patterns + fixes)
  recoveryKnowledge: RecoveryPattern[];
  
  // Actions that test whether this skill's tools are available
  availabilityCheck: () => Promise<boolean>;
}
```

**Skills in Phase 5**:

| Skill | Provides | Availability Check |
|-------|----------|-------------------|
| Three.js | Three.js API documentation, common patterns, known pitfalls | Check if three is in package.json |
| Blender | Blender Python API, bpy module docs, export pipeline | Check if blender CLI is available |
| Git | Git workflow best practices, commit conventions, merge strategies | Check if git CLI is available |
| VS Code | VS Code API, extension patterns, debug configurations | Check if code CLI is available |

**Modified: `@gamedev-agent/context`** (+skill-driven providers)

Skills register context providers with the `ContextProviderRegistry`. Each skill's providers are enabled only when the skill is active for the current project.

**Modified: `@gamedev-agent/reasoning`** (+skill-aware selection)

The Reasoning Service considers active skills when selecting models and tools:
- If Three.js skill active → prefer models good at JavaScript/TypeScript
- If Blender skill active → enable Python-related tool actions
- Skill model preferences override default preferences

**Modified: `@gamedev-agent/recovery`** (+skill-aware recovery)

The Recovery Service checks active skills for known error patterns:
- If Blender active and error matches known pattern → suggest specific fix
- If Three.js active and import fails → check package.json for three version

### What the System Can Do After Phase 5

```
Mission: "Add a particle system to the Three.js scene"

Skills active: [Three.js, Git, VS Code]

1. Reasoning sees Three.js skill → selects gpt-4o (good at Three.js), enables
   filesystem + terminal tools, approach=generate
2. Context includes Three.js API docs from skill (component patterns, 
   known pitfalls like BufferGeometry vs Geometry)
3. Engineer generates particle system code
4. Terminal: npm install three@0.160.0 (skill knows current stable version)
5. Git: auto-commit with Conventional Commit format (skill provides template)
6. If error: skill provides recovery hint for common Three.js migration error
```

### Dependencies

- Phase 4 complete (agents need skills)
- Phase 3 complete (skills add context providers that query memory)
- Existing plugin system for registration

### Risks

| Risk | Mitigation |
|------|-----------|
| Skills become monolithic (one file does everything) | Skill interface enforces separation: providers, tools, hints, recovery are separate concerns |
| Skills overlap (Three.js and general web skill both claim JS expertise) | Skill priority system: project-configured skill wins over general skill |
| Skill maintenance burden | Skills are versioned. Breaking changes require major version bump. |

### Success Criteria

1. Three.js skill activates when `three` is in package.json
2. Reasoning selects different model when Blender skill active vs Three.js skill active
3. Recovery service suggests skill-specific fix for known error pattern
4. Skill can be disabled in project config and system respects it
5. New skill can be created and registered without modifying core packages

### What NOT to Build Yet

- Skill marketplace (skills are in-repo for v1)
- Skill dependency resolution (skill A requires skill B)
- Skill auto-update
- Community-contributed skills

---

## Phase 6 — Project Workspace

**Duration**: 4-5 weeks
**Question**: "Can Nova understand the entire game project, not just individual files?"

### Objective

Nova should deeply understand a game project's structure, architecture, assets, and state. It should know:
- Which engine/framework is used (from project config)
- How the project is organized (folder structure, module boundaries)
- What assets exist and their relationships
- What the current build state is
- What the architecture looks like (component hierarchy, dependency graph)

### What Changes

**New package: `@gamedev-agent/project-intelligence`** (~600 lines)

```
packages/project-intelligence/src/
├── ProjectScanner.ts         # Scan project structure, identify patterns
├── ArchitectureExtractor.ts  # Extract module boundaries, dependency rules
├── AssetIndexer.ts           # Index assets, detect relationships
├── ProjectState.ts           # Current project state (build health, git status)
├── ProjectIntelligenceModule.ts
└── index.ts
```

**ProjectScanner**:
- Walks project directory tree
- Identifies project type (Godot, Unity, Unreal, Three.js, custom)
- Maps folder structure with semantic labels (src/, assets/, scenes/, etc.)
- Detects configuration files (package.json, project.godot, *.csproj)
- Produces `ProjectMap` (semantic folder structure, not just file listing)

**ArchitectureExtractor**:
- Parses import/require/include statements
- Builds dependency graph between modules
- Identifies component hierarchies (class inheritance, composition patterns)
- Detects architecture violations (circular dependencies, layer violations)
- Produces `ArchitectureModel` (modules, dependencies, boundaries, violations)

**AssetIndexer**:
- Scans asset directories for known formats (.blend, .png, .fbx, .glb, .wav)
- Extracts metadata (dimensions, format, file size, dependencies)
- Detects asset references in code (texture paths, model references)
- Produces `AssetIndex` (assets, types, references, usage)

**Modified: `@gamedev-agent/context`** (+3 providers)

- `ProjectMapProvider`: Adds project structure context
- `ArchitectureProvider`: Adds architecture model context (existing, enrich with violations)
- `AssetIndexProvider`: Adds asset context

**Modified: `@gamedev-agent/reasoning`** (+architecture-aware selection)

Reasoning considers architecture constraints when selecting approach:
- If architecture has strict module boundaries → approach respects them
- If circular dependency detected → approach includes fix step
- If asset references are broken → approach includes asset repair step

### What the System Can Do After Phase 6

```
Nova knows:
- "This is a Three.js project with 3 modules: physics, rendering, input"
- "src/characters/ depends on src/physics/ but not vice versa"
- "assets/characters/ contains 12 .blend files, 3 .glb exports"
- "The build is currently broken: 2 TypeScript errors in src/input/"
- "There's a circular dependency between rendering/shaders and physics/collision"

Nova can:
- Answer "what does this project look like?"
- Flag architecture violations before proposing changes
- Suggest asset optimizations (unused assets, oversized textures)
- Detect when a change would break module boundaries
```

### Dependencies

- Phase 1-3 complete (core intelligence + tools + memory)
- Phase 5 complete (skills provide engine-specific scanning patterns)
- Phase 4 optional (useful without agents, more useful with them)

### Risks

| Risk | Mitigation |
|------|-----------|
| Scanning large projects is slow | Incremental scanning (only re-scan changed files). Cache results in Memory. Async with progress. |
| Architecture extraction is inaccurate for dynamic languages | Best-effort. Always label confidence. Architect agent reviews proposed architecture model. |
| Asset indexing consumes disk I/O | Index on idle. Priority queue: code files first, assets later. |

### Success Criteria

1. Scanner correctly identifies project type and folder semantics for Godot, Unity, Three.js projects
2. Architecture extractor produces a dependency graph for a TypeScript/JavaScript project
3. Asset indexer finds and catalogs all .blend, .png, .glb assets in a project
4. Reasoning includes architecture constraints in its selections
5. Context providers surface project structure in assembled context

### What NOT to Build Yet

- Architecture visualization (UI concern, Phase 7+)
- Asset optimization (Phase 7+)
- Automated architecture repair (Phase 7+)
- Multi-project workspace (single project is enough for v1)

---

## Phase 7 — Autonomous Development

**Duration**: 5-6 weeks
**Question**: "Can Nova complete multi-step missions with minimal user intervention?"

### Objective

Tie all previous phases together into a cohesive autonomous development pipeline. Nova should accept a high-level mission, decompose it, execute each step with appropriate agents and skills, handle failures along the way, and deliver a completed, verified result.

### What Changes

**Modified: `@gamedev-agent/producer`** (+autonomous mode)

Add autonomous mode where the Producer bypasses human approval gates for low-risk missions. Risk is determined by:
- File types involved (documentation → low risk, architecture → high risk)
- Scope (single file change → low, cross-module → high)
- Reversibility (git-tracked changes → low, git-untracked → high)

**Modified: `@gamedev-agent/agent-coordinator`** (+progress tracking, +parallel execution)

- Track progress across all active sub-missions
- Execute independent sub-missions in parallel (when no dependency between them)
- Report aggregated progress to the UI

**Modified: `@gamedev-agent/execution-engine`** (+verification step)

After each execution round, verify the output before proceeding:
- Does the file compile? (run build check)
- Does the file respect architecture boundaries? (check import rules)
- Does the file follow project conventions? (lint check)
- Verification failures → Recovery (retry with fix instructions)

**Modified: `@gamedev-agent/recovery`** (+new strategies)

Expand from 2 strategies to 4:
- `retry`: Same step, same approach (existing)
- `fix`: Same step, but include error message as context (new)
- `fallback_model`: Re-execute with next model in preference order (new)
- `escalate`: Stop, explain, wait for user (existing)

**Modified: `@gamedev-agent/trace`** (+mission replay)

Add the ability to replay a completed mission's execution trace step-by-step. Useful for debugging, learning, and understanding what Nova did.

### What the System Can Do After Phase 7

```
User: "Add a settings menu to the game"

Nova autonomously:
1. Goal enrichment: "Settings menu → UI system? " Which engine? " Godot"
2. Architecture check: "UI module exists at src/ui/. Menu fits there."
3. Decomposition:
   a. Architect: Design settings data structure (keybindings, volume, resolution)
   b. Gameplay Engineer: Implement SettingsManager.gd (save/load, defaults)
   c. Gameplay Engineer: Implement SettingsMenu.tscn (UI layout, signal wiring)
   d. All: Verify menu actually opens, settings persist, binds apply
4. Execution (with progress reporting):
   [25%] SettingsManager.gd created (passes lint, matches architecture)
   [50%] SettingsMenu.tscn created (UI structure matches design doc)
   [75%] Integration: menu opens, settings save, keybindings apply
   [90%] Verification: build passes, tests pass
   [100%] Mission complete. Summary:
     - Created: SettingsManager.gd (85 lines), SettingsMenu.tscn
     - Modified: Input mapping to support rebinding
     - Risk: None flagged
     - Recovery: npm install godot#ui-addon failed → used bundled UI module
```

### Dependencies

- Phases 1-6 complete

### Risks

| Risk | Mitigation |
|------|-----------|
| Autonomous mode makes unrecoverable mistakes | All changes are git-tracked. Rollback is one command. Architecture changes always require approval. |
| Mission progress reporting adds complexity | Coarse-grained (phase-level, not step-level). Every phase publishes progress to Event Bus; UI subscribes. |
| Verification step doubles execution time | Verification is async where possible (build runs while next step is reasoned). |

### Success Criteria

1. Complete a 5-step multi-specialty mission without user intervention
2. All outputs pass verification (build, lint, architecture check)
3. Progress reporting accurately reflects mission state
4. Recovery correctly escalates when retry + fix both fail
5. Mission replay reproduces the same execution trace
6. Rollback restores project state to pre-mission state

### What NOT to Build Yet

- Continuous autonomous mode (Nova watches files and auto-fixes issues)
- User intent prediction (Nova proposes missions before user asks)
- Self-improvement loop (Nova modifies its own behavior based on outcomes)
- Multi-project autonomous coordination

---

## Nova v1.0

### Definition

Nova v1.0 ships when all 7 phases are complete and the following capabilities are demonstrated:

**Core Flow** (Phase 1):
- Accept a high-level mission
- Reason about approach, model, and tools before each step
- Execute steps with real tool calls
- Recover from transient failures with retry
- Escalate permanent failures with clear diagnosis

**Tool Execution** (Phase 2):
- Create, read, edit, delete files
- Run terminal commands
- Perform git operations (status, add, commit, branch)
- Integrate with VS Code (open files, read diagnostics)

**Memory** (Phase 3):
- Persist every mission's execution trace
- Recall past missions by goal similarity
- Track relationships between files, missions, and decisions
- Provide project and mission context to the reasoning pipeline

**Specialist Agents** (Phase 4):
- Architect agent designs structure and verifies architecture
- Gameplay Engineer agent generates and debugs code
- Blender Specialist agent creates and modifies 3D assets
- Agent Coordinator manages multi-specialty missions

**Skills** (Phase 5):
- Three.js skill provides engine-specific context and patterns
- Blender skill provides Python API knowledge and recovery patterns
- Git skill provides workflow best practices
- VS Code skill provides editor integration patterns

**Project Understanding** (Phase 6):
- Scan and understand project structure
- Extract architecture (module boundaries, dependencies)
- Index assets and their relationships
- Use architecture constraints in reasoning

**Autonomous Development** (Phase 7):
- Complete multi-step missions with minimal user intervention
- Verify outputs against project standards
- Recover from errors with escalating strategies
- Provide transparent progress and traceability

### What v1.0 Is NOT

- Not a ChatGPT replacement (it's a game development OS)
- Not a no-code game maker (it requires a developer in charge)
- Not cloud-dependent (it runs offline)
- Not model-locked (any provider works)
- Not a black box (every decision is observable)
- Not a learning system (mission storage exists but no pattern extraction)
- Not a multi-project orchestrator (single project at a time)

### Ship Criteria

```
Functional:
□ Mission completes end-to-end: goal → plan → execute → verify → complete
□ All tool types work (filesystem, terminal, git, vscode)
□ Memory persists across sessions
□ All 3 specialist agents execute their specialty
□ All 4 skills activate and provide context
□ Project scan produces accurate structure map
□ Multi-step mission completes autonomously

Quality:
□ Tool call success rate > 80% (recovery handles the rest)
□ Mission completion rate > 70% (user may need to intervene for complex goals)
□ Reasoning + Recovery add < 5s per step overhead
□ Memory retrieval < 2s
□ Project scan < 30s for 10,000 file project
□ All existing 26 package tests pass
□ 100+ integration tests for new intelligence packages

User Experience:
□ Developer can ship a simple game (e.g., Breakout clone) using Nova alone
□ Developer can inspect any mission's full execution trace
□ Developer can configure agent behavior per project
□ Developer works offline without degradation
```

### Post-v1.0

```
v1.1 (1 month after v1.0):
- Performance optimization (deduplicate memory queries, cache reasoning decisions)
- Additional specialist agents (Audio Engineer, UI Designer)
- Additional skills (Godot, Unity, Unreal)

v1.2 (2 months after v1.0):
- Learning Engine v1 (pattern extraction from mission history)
- Mission templates (reusable mission patterns for common tasks)
- User feedback integration (explicit rating of mission outcomes)

v2.0 (6 months after v1.0):
- Knowledge Graph (upgraded from memory relationships to full graph)
- Multi-project workspace
- Collaborative mode (multiple developers, one Nova)
- Decision Engine (when learning data + policy rules justify it)
```

---

*Nova Engineering Roadmap v1 — July 2026*
