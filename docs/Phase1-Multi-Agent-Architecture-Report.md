# Phase 1 — Multi-Agent Mission Orchestration Architecture Report

**Version:** 1.0
**Status:** Design Document (no implementation)
**Owner:** Chief Software Architect
**Date:** 2026-08-02
**Phase:** 1 of 10 (Architecture Report)

> This document is the Phase 1 deliverable of the multi-agent evolution of Nova's
> single-agent `MissionAgent`. It is a **design document**: it contains contracts
> and illustrative interface sketches only. No implementation code lands until
> Phase 2. Every design point names the exact existing file/package it extends so
> the report is auditable against the Phase 0 system map.

---

## 0. Scope and goal

Evolve Nova's single-agent mission execution into a multi-agent system:

- A **mission orchestrator** decomposes and assigns mission work to specialist agents.
- Six **v1 specialist agents**: Planner, Programmer, Technical Artist, Game
  Designer, QA, Performance (logical/structural only in v1; no Blender/Unity/
  Godot/browser automation; stub bodies).
- Specialist agents share **mission-scoped and kernel memory**, and route
  verification/failure/retry through the **existing** AMI engines.
- **MissionAgent's existing single-agent contract is untouched.** Its public
  surface, decision loop, events, and tests remain exactly as they are.

Invariants from the phased protocol carried into this report:

1. **Reuse before invent.** No duplicate DI, Event Bus, memory, or execution path.
2. **Single entry point.** Mission execution enters through `StudioOrchestrator`
   (the only vertical-slice glue into the Coordinator lifecycle).
3. **No `any`, no `!`, no unsafe `as`** in new code; safe `as` requires written proof.
4. **Phase 4 hot-path guarantee:** single-agent `MissionAgent` behavior and its
   existing tests pass unmodified.
5. **Phase lifecycle:** INSPECT → EXPLAIN → IMPLEMENT → VERIFY → SUMMARIZE; stop
   after every SUMMARIZE for approval.

---

## 1. Architectural decisions

### AD-1 — Multi-agent dispatch lives at the event/composition layer, NOT inside MissionAgent

**Decision:** Multi-agent dispatch **extends StudioOrchestrator's composition
layer**. It does **not** live inside `MissionAgent`'s decision loop, and it does
not modify `MissionAgent` in any way.

**Hook point (Phase 0 trace):** `packages/studio-api/src/StudioOrchestrator.ts`,
`onPlanCreated(planId)` (lines 164–205). Today this method: creates the
Coordinator Mission → `submit/accept/analyse/requestApproval/approve/markReady/
startExecution` → `missionAgent.run(source)` → `review/complete` or `fail` based
on the returned `MissionReport`. That last hop — "run the mission" — is the only
point that gains a routing predicate.

- Single-agent missions → `missionAgent.run(source)` — **byte-for-byte unchanged**.
- Multi-agent missions → a new `MissionOrchestrator.execute(...)` returns the
  **same `MissionReport` shape**, so the completion block
  (`coordinator.review/complete/fail`, lines 199–204) is reused unchanged.

**Why (blast-radius argument):** `MissionAgent`'s contract
(`run(source, signal?)` / `cancel()` / `dispose()`, plus its inline decision
loop, `ShortTermMemory`, `agent.*` telemetry events, and tests in
`packages/execution-engine/src/MissionAgent.test.ts` and
`MissionAgent.e2e-demo.test.ts`) is the Phase 4 hot-path guarantee. Embedding a
role roster and task router inside it would couple the mission brain to the
agent roster and invalidate the "contract unchanged" constraint.

**Explicit counter-case considered and rejected:** Routing multi-agent through
the existing `reasoningLoop` seam (`REASONING_LOOP_TOKEN`, consumed by
`MissionAgentModule.ts`). That seam exists and is proven by AMI, but it is the
sanctioned extension point for **single-mission AMI reasoning** (Phase 10). Reusing
it for agent dispatch would conflate "AMI reasoning loop" with "agent roster
orchestration." They are different concerns; the seam is preserved, unmodified, for
Phase 10.

**Consequence for the "single Entry Point = MissionAgent" invariant:** the
invariant's intent is *one entry path into the Coordinator lifecycle, not bypassed*.
`MissionOrchestrator` is engaged only from `StudioOrchestrator` — the same glue that
today calls `MissionAgent`. There remains exactly one application-level entry point,
and `MissionAgent` remains the single mission brain for the single-agent path.

### AD-2 — The six specialist agents are `Agent` implementations in the EXISTING agent runtime

**Decision:** Do **not** create a new agent runtime. `packages/agent-runtime`
already provides the complete runtime:

- `Agent` interface (`onInit/onMessage/onStart/onStop`) — `AgentInterface.ts`
- `AgentRegistry` (type registration, instance spawn, capability index) — `AgentRegistry.ts`
- `AgentRuntime` (spawn/kill, `send/request/broadcast`, capability routing, `AGENT_RUNTIME_TOKEN`) — `AgentRuntime.ts`
- `AgentMessageBus` (correlated request/response + timeout) — `AgentMessageBus.ts`
- `AgentContext` (agentId, `events`, `memory`, `logger`, `send/request/broadcast`) — `AgentContext.ts`
- `agentRuntimeModule` (registers the singleton; resolves `MEMORY_MANAGER_TOKEN`) — `AgentModule.ts`

This runtime is **already live in the kernel**: `AgentDispatcher`
(`packages/execution-engine/src/AgentDispatcher.ts`) resolves `AGENT_RUNTIME_TOKEN`.

**Consequence:** the six specialist agents are registered into this existing
runtime as `AgentTypeDescriptor`s (`type/name/description/capabilities/factory`).
No new runtime, registry, or message bus is invented. The mission orchestrator
drives them through `AgentRuntime.request/requestFrom` (correlated, timeout-bounded)
and capability routing — reusing the runtime's existing request/response machinery.

### AD-3 — Agent messaging = a `mission.agent.*` event catalog on the shared Event Bus

**Decision:** Introduce a new typed event catalog `mission.agent.*` as a natural
extension of the existing taxonomy. It follows the **exact** existing conventions:

- `EventDefinition<T> = { type, version }` — `packages/events/src/types.ts`.
- Local `define<T>(type)` helper returning `{ type, version: 1 }` — identical to
  `ProducerEvents.ts`, `CoordinatorEvents.ts`, `PlannerEvents.ts`,
  `reasoning-events.ts`, `MissionAgentEvents.ts`, and the catalog files in
  `packages/events/src/catalog/`.
- Naming: `<aggregate>.<past-tense-verb>` — `goal.submitted`, `plan.created`,
  `mission.completed`, `mission.reasoning.approval.resolved`.
- Payloads are `readonly` interfaces carrying identity (`missionId`, `agentId`,
  `taskId`) plus `timestamp: number`.
- Published on the **same** `EventBusContract` (`kernel.events`); subscribers bind
  to the definition constant, never a magic string.
- **Same bus. Same envelope. Same versioning.** No new bus, no new envelope shape.

The existing single-agent telemetry vocabulary — `agent.state-changed`,
`agent.thought`, `agent.observation`, `agent.decision`, `agent.action-started`,
`agent.action-result`, `agent.verification`, `agent.progress`,
`agent.mission-complete`, `agent.artifact-created` — is emitted by `MissionAgent`
(`packages/execution-engine/src/MissionAgentEvents.ts`) and is **kept as-is**. The
new `mission.agent.*` catalog covers orchestrator↔specialist **coordination**
(assignment, per-agent lifecycle, results, mission outcome). The two vocabularies
are distinct by design: `agent.*` = the single mission brain's telemetry;
`mission.agent.*` = the multi-agent coordination contract.

### AD-4 — ReasoningLoop is AMI's sequencer; the Planner Agent is a consumer, not a duplicate

**Decision (flagged now for Phase 5):** `ReasoningLoop`
(`packages/ami/src/reasoning/reasoning-loop.ts`) is the goal-tree sequencer AMI
owns. It sequences per-goal work (`reasoning → executing → verifying → reflecting`,
retry/replan/continue) and contains **zero business logic** — every judgment is
delegated. The Planner Agent must **not** re-implement a goal-tree sequencing loop.

Instead, the Planner Agent consumes the existing decomposition/reasoning contracts
through their DI tokens and sits *alongside* `ReasoningLoop`:

- `GOAL_DECOMPOSER_TOKEN` → `IGoalDecomposer.decompose(MissionGoal): GoalTree`
- `REASONING_ENGINE_TOKEN` → `IReasoningEngine.think/plan`
- `IProgressEstimator`, `IRetriesStrategyResolver`, `IReflectionEngine` for the
  decisions that inform assignment.

The Planner Agent's job is **mission→task assignment** (which specialist does which
work, in what order) — a *different concern* from `ReasoningLoop`'s per-goal-node
sequencing. Where a mission is AMI-backed, `ReasoningLoop` keeps sequencing goal
nodes; the Planner Agent decomposes those nodes into agent-assignable tasks.

### AD-5 — Verification, approval, and retries route through existing AMI machinery

**Decision:** No new approval/verification/retry event patterns.

- **Verification:** `IVerificationEngine` (`VERIFICATION_ENGINE_TOKEN`,
  `packages/ami/src/reasoning/verification-engine.ts`) with the registered
  strategies (`FileStateStrategy`, `TestRunStrategy`, `LintCheckStrategy`) over
  the ToolManager adapters, plus `ObservationCollector`
  (`OBSERVATION_COLLECTOR_TOKEN`), which already normalizes Execution Engine events
  into `Observation`s. Agent results are wrapped as `Observation` and verified by
  the engine; results flow via the existing `mission.reasoning.verification.*` events.
- **Approval:** `IApprovalGate` (`APPROVAL_GATE_TOKEN`,
  `packages/ami/src/approval/approval-gate.ts`) with the existing
  `mission.reasoning.approval.requested` / `mission.reasoning.approval.resolved`
  events. Its request→publish→subscribe→resolve pattern is also the **template** for
  the `AgentTaskExecutor` bridge (AD-4 in §3.4), but the approval *semantics* stay in
  `ApprovalGate`.
- **Retries:** `IRetryStrategyResolver` (`RETRY_STRATEGY_RESOLVER_TOKEN`) +
  `DEFAULT_RETRY_POLICY`, `WorkflowPlan.maxAttempts` (`packages/workflow`), and the
  Execution Engine's existing retry loop.

### AD-6 — Phase 1 is a design document only

No implementation code is produced in this phase. Interface sketches below are
illustrative type contracts that Phase 2 will implement under the phased protocol.

---

## 2. Layered architecture overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Studio (apps/studio, packages/studio-api)                                   │
│   StudioApi · ActivityFeed · StudioHome   (observe bus; Phase 9 surface)    │
└───────────────▲────────────────────────────────────────────────────────────┘
                │ reads
┌───────────────┴────────────────────────────────────────────────────────────┐
│ StudioOrchestrator  (packages/studio-api)  — the ONLY vertical-slice glue  │
│   Producer → Planner → Coordinator → [ routing predicate ]                  │
│       ├── single-agent: MissionAgent.run(source)      (unchanged)           │
│       └── multi-agent : MissionOrchestrator.execute() (NEW, AD-1)           │
└───────────────▲────────────────────────────────────────────────────────────┘
                │
┌───────────────┴────────────────────────────────────────────────────────────┐
│ MissionOrchestrator  (NEW: packages/agents)  — mission-level coordinator    │
│  • Planner Agent → agent-assignment plan (consumes AMI decomposition)       │
│  • dispatches tasks/results via mission.agent.* events; DI for deps (AD-3)  │
│  • aggregates results; routes verification/approval/retry through AMI (AD-5)│
│  • emits mission.agent.mission-completed/failed → StudioOrchestrator        │
└───────────────▲────────────────────────────────────────────────────────────┘
                │
┌───────────────┴────────────────────────────────────────────────────────────┐
│ packages/agent-runtime  (EXISTING, AD-2)                                    │
│   AgentRegistry · AgentRuntime · AgentMessageBus · AgentContext             │
│   ▲           ▲            ▲                                               │
│   │           │            │   register AgentTypeDescriptor(s)             │
│  Planner     Programmer  Technical Artist  Game Designer  QA  Performance  │
│  (specialist Agent implementations, NEW: packages/agents)                  │
└───────────────▲────────────────────────────────────────────────────────────┘
                │ ToolManager · CapabilityPlanner · ExecutionEngine · Context
┌───────────────┴────────────────────────────────────────────────────────────┐
│ Existing subsystems (reused, not duplicated)                                │
│  tool-runtime · workflow · context · memory · ami · coordinator · events    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 15 design points

Each point states the decision, the exact existing artifact it extends, and why.

### 3.1 Agent interface

**Decision:** v1 specialist agents implement the **existing** `Agent` contract
(`onInit(ctx)`, `onMessage(msg)`, `onStart()`, `onStop()`) from
`packages/agent-runtime/src/AgentInterface.ts`. The base `Agent` interface is
**not redesigned** — it is a live public contract consumed by `AgentRuntime` and
`AgentDispatcher`.

**Extensions (new, in `packages/agents`):** a thin domain layer *on top of*, not
*replacing*, the base contract:

```ts
// packages/agents/src/AgentTypes.ts (illustrative sketch)
type AgentRole =
  | 'planner' | 'programmer' | 'technical-artist'
  | 'game-designer' | 'qa' | 'performance';   // v1 roster

interface AgentTask {                          // wraps workflow step + context
  readonly taskId: string;
  readonly missionId: string;
  readonly projectId: string;
  readonly role: AgentRole;
  readonly step: WorkflowStep;                 // requiredRole/requiredCapability
  readonly context: WorkflowStepContext;       // attempt, executionId, metadata
  readonly goalNodeId?: string;
}

interface AgentResult {                        // mirrors StepResult shape
  readonly taskId: string;
  readonly ok: boolean;
  readonly output?: Json;
  readonly artifacts?: readonly string[];
  readonly error?: string;
  readonly durationMs: number;
}
```

**Traceability:** `AgentTask` reuses `WorkflowStep`/`WorkflowStepContext`/
`StepResult` from `packages/workflow/src/WorkflowDefinition.ts`; `AgentRole` maps
onto the existing `AgentType` brand from `packages/agent-runtime/src/AgentTypes.ts`;
`Json`/`Disposable` from `packages/shared/src/index.ts`.

**Why:** every existing consumer (runtime lifecycle, message delivery) already
speaks `Agent`; a new interface would force a duplicate runtime. The domain types
are additive and live in the new package.

### 3.2 Registry

**Decision:** Use the existing `AgentRegistry`
(`packages/agent-runtime/src/AgentRegistry.ts`) and `AgentRuntime.registerType`
(`AgentRuntime.ts`). The six specialists are registered once at kernel boot.

**Extension:** a small static `AgentRole → AgentType` mapping in `packages/agents`
(a plain `Record`, not a service). No new registry class, no new token.

**Traceability:** mirrors how other registries already work and how
`AgentDispatcher` consumes `AGENT_RUNTIME_TOKEN`. The fail-fast duplicate guard on
type registration already exists (`AgentDuplicateTypeError`).

**Why:** the roster is fixed at six in v1; the existing registry provides
`registerType/spawn/hasType/listTypes/findInstanceByCapability` and the 
runtime-level `listAgents/findAgentByCapability`.

### 3.3 Discovery

**Decision:** Two existing mechanisms, composed:

1. **Agent discovery by role/capability** — `AgentRuntime.findAgentByCapability`
   (`AgentRuntime.ts`) over `AgentRegistry.findInstanceByCapability`
   (`AgentRegistry.ts`). Each specialist's `AgentTypeDescriptor.capabilities` is
   the set of `AgentCapability` values it satisfies.
2. **Tool discovery by ability** — `CapabilityPlanner`
   (`packages/tool-runtime/src/CapabilityPlanner.ts`): `resolveAbilities(
   MissionAbility[]) → ResolvedCapability[]`, backed by `ToolManager` capabilities.

**Extension:** a pure bridge `agentCapabilityFromAbility(ability: MissionAbility):
AgentCapability` in `packages/agents` (plus the reverse for capability → abilities).
The orchestrator resolves a task's `requiredCapability`/`requiredRole` (existing
`WorkflowStep` fields) to a specialist agent (1) and to concrete tools (2).

**Traceability:** `MissionAbility`, `ResolvedCapability`, `ResolutionConfidence`
from `packages/tool-runtime/src/ToolTypes.ts`.

**Why:** no new discovery framework. Role→agent is one capability-index lookup;
ability→tool is the Capability Planner's existing job.

### 3.4 Task Assignment

**Decision:** Assignment is (a) a correlated request through the existing
`AgentRuntime` and (b) an observable `mission.agent.assigned` event on the shared
bus. The orchestrator assigns; the specialist receives via `Agent.onMessage`; the
result returns as an `AgentMessage` (correlationId) **and** is mirrored as
`mission.agent.result`.

**Extension — `AgentTaskExecutor` (new, `packages/agents`):** a `StepExecutor`
(`packages/workflow/src/WorkflowDefinition.ts`) implementation. For steps whose
`requiredRole` is set, task intake and results are **event-only** (Mechanism B,
§7 item 2):

- publishes `mission.agent.assigned` (payload carries `taskId`, `role`, `step`
  spec) on the shared bus; the specialist subscribes via `AgentContext.events`
  filtered by role/agentId and returns `mission.agent.result` when finished;
- the bridge awaits the matching result by subscribing to `mission.agent.result`
  filtered on `taskId`, resolving/disposing on the match, and enforcing a timeout
  — the **exact `ApprovalGate` lifecycle**
  (`packages/ami/src/approval/approval-gate.ts`: subscribe → match → dispose →
  timeout) applied to task results;
- returns `StepResult { ok }` from the received result.

Dependencies a specialist needs (GoalDecomposer, ReasoningEngine, ToolManager, …)
are **DI-resolved** — never injected by StudioOrchestrator or MissionAgent, and
never via a direct method call into the agent. The runtime's own point-to-point
messaging (`AgentRuntime.request/send/broadcast`) is reserved for agent-to-agent
communication, not orchestrator→specialist task flow (§7 item 2). **No new approval
semantics** (AD-5).

**Why:** it lets the existing Workflow Engine and Execution Engine drive agent
steps with zero changes: a workflow whose steps carry `requiredRole` executes
through the `StepExecutor` seam exactly like today. Steps without a role run the
existing `ExecutionEngine`.

### 3.5 Agent Context

**Decision:** Reuse `AgentContext` (`packages/agent-runtime/src/AgentContext.ts`),
which already hands every agent `agentId`, `events`, `memory` (`MemoryManager`),
`logger`, and `send/request/broadcast`. Extend it with a mission-scoped context
assembled from existing sources.

**Extension — `AgentMissionContext` (new, `packages/agents`):** a value type
assembled per task from:

- `ContextManager` / `ContextPipeline` (`CONTEXT_MANAGER_TOKEN` /
  `CONTEXT_PIPELINE_TOKEN`, `packages/context`) — a `ContextRequest` scoped to
  `projectId`/`missionId` producing a `ContextPackage`.
- `MissionMemoryStore` (`MISSION_MEMORY_STORE_TOKEN`,
  `packages/ami/src/memory/mission-memory-store.ts`) — `summarize(missionId)` +
  `query({ missionId, kind: 'agent.*' })`.
- The `GoalTree` node referenced by `task.goalNodeId` (from AMI types).

**Traceability:** follows `ReasoningLoop.buildContext`
(`packages/ami/src/reasoning/reasoning-loop.ts`, lines 302–325) — memory summary +
prior failures + project context. The assembly lives in the new package; the
sources are all existing.

**Why:** agents get the same contextual grounding the mission brain gets, without
a new context system.

### 3.6 Agent Messaging

**Decision:** New event catalog `packages/agents/src/AgentEvents.ts`, following the
conventions in AD-3 exactly. Same bus (`kernel.events`), same `EventDefinition`
envelope, `version: 1`.

Proposed catalog (naming `<past-tense-verb>` on aggregate `mission.agent`):

| Definition | Payload (readonly; identity + timestamp) | Meaning |
|---|---|---|
| `mission.agent.assigned` | missionId, agentId, role, taskId, step spec, goalNodeId?, correlationId | orchestrator assigns a task |
| `mission.agent.task-started` | missionId, agentId, taskId | specialist begins |
| `mission.agent.state-changed` | missionId, agentId, previousState, currentState | per-agent mission-stage lifecycle |
| `mission.agent.progress` | missionId, agentId, taskId, progress, message | per-agent progress |
| `mission.agent.result` | missionId, agentId, taskId, ok, output?, artifacts?, error?, durationMs | task outcome |
| `mission.agent.completed` | missionId, agentId, taskId, summary | agent finished its assignment |
| `mission.agent.failed` | missionId, agentId, taskId, reason | agent failed its assignment |
| `mission.agent.mission-completed` | missionId, status, summary, report | orchestrator → StudioOrchestrator |
| `mission.agent.mission-failed` | missionId, status, summary, report | orchestrator → StudioOrchestrator |

**Traceability:** three distinct channels, no overlap:

1. **Dependencies via DI.** Specialists and the orchestrator resolve every service
   from the container (`AGENT_RUNTIME_TOKEN`, `TOOL_RUNTIME_TOKEN`,
   `GOAL_DECOMPOSER_TOKEN`, `REASONING_ENGINE_TOKEN`, `MISSION_MEMORY_STORE_TOKEN`,
   `CONTEXT_PIPELINE_TOKEN`, …). No agent is ever handed a reference by
   StudioOrchestrator or MissionAgent.
2. **Mission coordination events.** The new `mission.agent.*` catalog on the shared
   bus is the *only* channel for orchestrator→specialist task assignment and
   results. Everything else (verification, memory recorder, Studio, coordinator)
   subscribes to this same stream without coupling to the runtime's internals.
3. **Agent-to-agent messaging.** Existing `AgentMessage` / `AgentMessageTarget` /
   `AgentRuntime.request/send/broadcast` (`packages/agent-runtime`) is reserved for
   point-to-point agent communication — unchanged and orthogonal to mission task
   flow.

The existing `agent.*` telemetry events (`MissionAgentEvents.ts`) are untouched and
remain the single-agent brain's vocabulary (AD-3).

**Why:** the user-visible contract of *who does what in a mission* must be a
versioned, observable event stream, consistent with `mission.*`, `plan.*`,
`goal.*`, `workflow.*`, `memory.*`, `mission.reasoning.*`.

### 3.7 Shared Memory integration

**Decision:** Two existing tiers; no new store.

1. **Mission-scoped:** `MissionMemoryStore` (`MISSION_MEMORY_STORE_TOKEN`,
   `packages/ami/src/memory/mission-memory-store.ts`, `IMissionMemoryStore` =
   `write/query/summarize`). Specialists write records with
   `kind: 'agent.<role>'` and `evidence: { agentId, taskId }`; the orchestrator
   reads prior agent results for replanning. `MemoryWritten` (`memory.written`)
   already announces every write.
2. **Kernel memory:** `MemoryManager` (`MEMORY_MANAGER_TOKEN`,
   `packages/memory`) — already injected into `AgentContext.memory` by
   `AgentRuntime` (`AgentModule.ts` resolves `MEMORY_MANAGER_TOKEN`). Namespaced by
   `NAMESPACE_SEPARATOR` (`packages/shared`), with tiers/categories/provenance
   (`packages/memory/src/MemoryTypes.ts`). Cross-mission/knowledge layer.

**Extension:** none structural — only record-shape conventions (`agent.*` kinds and
`evidence` fields) adopted by the new package.

**Why:** the "shared memory" requirement is satisfied by *existing* mission-scoped
memory + kernel memory; agents already receive `memory` in `AgentContext`.

### 3.8 Agent lifecycle

**Decision:** Two existing state vocabularies, both reused:

- **Runtime state:** `AgentStatus` (`idle|busy|paused|error|stopped`,
  `packages/agent-runtime/src/AgentTypes.ts`) — maintained by `AgentRuntime.deliver`
  (`AgentRuntime.ts`) when dispatching `onMessage`; the orchestrator reads it via
  `getAgentStatus`.
- **Mission-stage state:** `AgentState`
  (`idle|running|observing|thinking|deciding|executing|verifying|completed|failed|
  cancelled|awaiting_approval`, `packages/execution-engine/src/MissionAgentTypes.ts`)
  — reused as the per-agent mission-stage vocabulary, surfaced by
  `mission.agent.state-changed`.

**Extension:** none structural — the orchestrator tracks per-agent
`missionId → taskId → AgentState` and persists via the existing registry's
`AgentRecord`. No new state machine; the existing `MissionStateMachine`
(`packages/ami/src/reasoning/mission-state-machine.ts`) and `WorkflowState`
(`packages/workflow/src/WorkflowState.ts`) remain the transition authorities.

**Why:** specialists are simple leaf workers in v1 (runtime idle/busy around each
task); the rich `AgentState` vocabulary already describes the mission-stage loop
and is reused rather than redefined.

### 3.9 Mission lifecycle

**Decision:** The Coordinator owns the mission lifecycle — reused unchanged.
`MissionStatus` (`submitted→accepted→analysing→waiting_for_approval→approved→
ready→executing→reviewing→completed/failed/cancelled`), `MISSION_LIFECYCLE`,
`MISSION_TERMINAL_STATES` from `packages/coordinator/src/CoordinatorTypes.ts`.

**Flow (Phase 0 trace):** `StudioOrchestrator.onPlanCreated` runs the Coordinator
to `executing` (existing); in multi-agent mode it hands the plan to
`MissionOrchestrator`, which returns a `MissionReport`-shaped outcome
(`packages/execution-engine/src/MissionAgentTypes.ts`); `StudioOrchestrator` then
calls `coordinator.review`/`complete` or `coordinator.fail` — **unchanged code**.

**Extension:** `mission.agent.mission-completed` / `mission.agent.mission-failed`
events (AD-3) carry that outcome from orchestrator to the glue. Progress flows into
the Coordinator via the existing `progress` field and
`MissionExecutionPausedPayload.progress`.

**Why:** no second mission lifecycle. The orchestrator is a *consumer* of the
Coordinator's, exactly as `MissionAgent` is today.

### 3.10 Failure handling

**Decision:** Route through existing AMI reflection. The orchestrator applies the
same `Decision` semantics `ReasoningLoop.processNode` applies
(`packages/ami/src/reasoning/reasoning-loop.ts`, lines 229–278):
`retry`, `retry_alternate_tool`, `replan_subgoal`, `continue_to_next_goal`,
`complete_mission`, `escalate_to_human`, `abort_mission` — produced by
`IReflectionEngine` (`REFLECTION_ENGINE_TOKEN`,
`packages/ami/src/reasoning/reflection-engine.ts`).

**Events:** reuse `ExecutionStepFailed` (`packages/execution-engine/src/events.ts`),
the new `mission.agent.failed`, and `MissionFailed` (`CoordinatorEvents.ts`).

**Extension:** the orchestrator wraps a failed `AgentResult` as a failing
`Observation` and feeds the reflection engine; the decision drives the next
assignment. No new failure vocabulary.

**Why:** failure semantics already exist and are tested in AMI; duplicating them
would create two divergent recovery models.

### 3.11 Retries

**Decision:** Reuse all existing retry machinery:

- `IRetryStrategyResolver` (`RETRY_STRATEGY_RESOLVER_TOKEN`) + `DEFAULT_RETRY_POLICY`
  (`packages/ami/src/reasoning/retry-strategy-resolver.ts`).
- `WorkflowPlan.maxAttempts` and `WorkflowStepRetried`
  (`packages/workflow/src/WorkflowDefinition.ts`, `WorkflowEvents.ts`).
- Execution Engine's per-step attempts (`packages/execution-engine/src/
  ExecutionEngine.ts`).

**Extension:** `AgentTaskExecutor` returns `StepResult { ok: false }` on an agent
failure, so the Workflow Engine's existing attempt accounting and retry events
apply without changes. Where AMI decision semantics are used, `retry` /
`retry_alternate_tool` re-dispatch the same `taskId` with the tool excluded
(backoff via `RetryPolicy.backoffMs`).

**Why:** the control plane (Workflow) and policy (AMI) already own retries; the
bridge merely translates agent failure into the existing `StepResult` contract.

### 3.12 Progress reporting

**Decision:** Reuse the existing progress surfaces:

- `ProgressTracker` (`packages/execution-engine/src/ProgressTracker.ts`) emits
  `ExecutionStepStarted/Progress/ToolInvoked/ToolResult/Completed/Failed`.
- `IProgressEstimator` (`PROGRESS_ESTIMATOR_TOKEN`,
  `packages/ami/src/reasoning/progress-estimator.ts`) estimates a `ProgressReport`
  from the `GoalTree`.
- `WorkflowExecution.progress` and `MissionExecutionPausedPayload.progress`
  (Coordinator).

**Extension:** `mission.agent.progress` (per-agent, 0–100 + message). The
orchestrator aggregates per-agent progress into the existing Coordinator progress
field.

**Why:** per-agent progress is the only genuinely new surface; everything else
already reports.

### 3.13 Verification

**Decision:** Route through the existing AMI verification engine (AD-5). No new
approval/verification events.

- `IVerificationEngine` (`VERIFICATION_ENGINE_TOKEN`) with
  `FileStateStrategy` / `TestRunStrategy` / `LintCheckStrategy` (registered in
  `packages/ami/src/ami-module.ts`) over the ToolManager adapters.
- `ObservationCollector` (`OBSERVATION_COLLECTOR_TOKEN`) — subscribes to
  `execution.*` events and normalizes them into `Observation`.
- Existing events `mission.reasoning.verification.started` /
  `mission.reasoning.verification.completed`.

**Flow:** specialist `AgentResult` → wrap as `Observation` → `verification.verify`
→ verdict recorded on `mission.agent.result` and emitted through
`mission.reasoning.verification.completed`.

**Why:** verification semantics, strategies, and events already exist and are
tested; agent results are just another observation type.

### 3.14 Observability

**Decision:** Everything already observable stays the source of truth:

- Event Bus history ring + middleware (`packages/events`).
- Tool audit trail — `ToolAuditRecord` (`packages/tool-runtime/src/ToolTypes.ts`),
  already keyed by `correlationId` and `actor` (specialists set
  `actor: { kind: 'role:<role>', id: agentId }`).
- Memory events (`packages/memory/src/MemoryEvents.ts`, `memory.written`).
- Execution events (`packages/execution-engine/src/events.ts`).
- Coordinator `mission.*` events, and the new `mission.agent.*` catalog.
- Logger via `kernel.logger.child('agents')` per module.

**Why:** the additive surface is only the `mission.agent.*` catalog; everything
else already exists.

### 3.15 Studio integration

**Decision:** Extend `StudioOrchestrator` (`packages/studio-api/src/
StudioOrchestrator.ts`) — the only change to the glue is the routing predicate in
`onPlanCreated` (AD-1) plus resolving `MISSION_ORCHESTRATOR_TOKEN`. The completion
block is unchanged. `StudioApi` / `ActivityFeed` / `StudioHome`
(`packages/studio-api/src/`) already read the shared bus, so `mission.agent.*`
events surface in Studio with **no API shape change**. Phase 9 will render agent
activity in `ActivityFeed` from this same stream.

**Why:** Studio already observes the mission via the bus; the multi-agent stream
is additive, not a new surface.

---

## 4. New artifacts planned (built in Phase 2+)

A single new package — `packages/agents`:

- `package.json`, `tsconfig.json` (deps: `@gamedev-agent/{agent-runtime,events,
  kernel,di,workflow,tool-runtime,context,memory,ami,coordinator,shared,logging,
  model-providers}`)
- `src/AgentEvents.ts` — the `mission.agent.*` catalog (AD-3)
- `src/AgentTypes.ts` — `AgentRole`, `AgentTask`, `AgentResult`,
  `AgentMissionContext`, role→type mapping (3.1, 3.5)
- `src/AgentTaskExecutor.ts` — the `StepExecutor` bridge (3.4)
- `src/MissionOrchestrator.ts` — mission coordinator (AD-1); token
  `MISSION_ORCHESTRATOR_TOKEN`
- `src/agents/*` — six specialist `Agent` implementations + `AgentTypeDescriptor`s
  (stub bodies in v1; no engine/browser automation)
- `src/agentsModule.ts` — `KernelModule` registering the runtime types and the
  orchestrator token
- `src/index.ts`, tests per the phased protocol

**Tokens introduced:** `MISSION_ORCHESTRATOR_TOKEN`. No new bus, no new envelope,
no new registry, no new state machine, no new memory store, no new verification/
approval/retry machinery.

---

## 5. Forward phase map (how this report drives Phases 2–10)

- **Phase 2** — Infrastructure: `packages/agents` skeleton, `AgentEvents.ts`
  catalog, `AgentTaskExecutor` bridge, `MissionOrchestrator` skeleton, DI
  registration, tests.
- **Phase 3** — The six specialist agent skeletons (logical/structural only),
  registered into the existing runtime.
- **Phase 4** — Hot-path preservation: StudioOrchestrator routing gated **off** by
  default; existing single-agent `MissionAgent` behavior and tests pass unmodified.
- **Phase 5** — Planner Agent: consumes `GoalDecomposer`/`ReasoningEngine` via
  tokens (AD-4); produces agent-assignment plans.
- **Phase 6+** — Programmer, Technical Artist, Game Designer, QA, Performance
  specialization; shared memory conventions (3.7); verification/retry wiring
  (3.10–3.13).
- **Phase 9** — Studio `ActivityFeed` surfaces `mission.agent.*` (3.15).
- **Phase 10** — AMI `ReasoningLoop` remains the sequencer; Planner Agent remains a
  consumer (AD-4).

---

## 6. Traceability table

| Design point | Extends (exact artifact) |
|---|---|
| 3.1 Agent interface | `packages/agent-runtime/src/AgentInterface.ts`; `packages/workflow/src/WorkflowDefinition.ts` (`WorkflowStep`, `StepResult`) |
| 3.2 Registry | `packages/agent-runtime/src/AgentRegistry.ts`, `AgentRuntime.registerType` |
| 3.3 Discovery | `AgentRuntime.findAgentByCapability`; `packages/tool-runtime/src/CapabilityPlanner.ts`, `ToolTypes.ts` |
| 3.4 Task Assignment | `packages/workflow/src/WorkflowDefinition.ts` (`StepExecutor`); `AgentMessageBus.sendAndWait`; pattern of `packages/ami/src/approval/approval-gate.ts` |
| 3.5 Agent Context | `packages/agent-runtime/src/AgentContext.ts`; `packages/context` (`CONTEXT_PIPELINE_TOKEN`/`CONTEXT_MANAGER_TOKEN`); `MissionMemoryStore`; `ReasoningLoop.buildContext` |
| 3.6 Agent Messaging | `packages/events` (`EventDefinition`/`Envelope`); `mission.agent.*` catalog (new); existing `agent.*` telemetry (`MissionAgentEvents.ts`) |
| 3.7 Shared Memory | `packages/ami/src/memory/mission-memory-store.ts`; `packages/memory` (`MemoryManager`, `MEMORY_MANAGER_TOKEN`); `AgentContext.memory` |
| 3.8 Agent lifecycle | `packages/agent-runtime/src/AgentTypes.ts` (`AgentStatus`); `packages/execution-engine/src/MissionAgentTypes.ts` (`AgentState`) |
| 3.9 Mission lifecycle | `packages/coordinator/src/CoordinatorTypes.ts` (`MissionStatus`); `StudioOrchestrator.onPlanCreated`; `MissionReport` (`MissionAgentTypes.ts`) |
| 3.10 Failure handling | `packages/ami/src/reasoning/reflection-engine.ts` (`IReflectionEngine`), `reasoning-loop.ts` (decision semantics), `events.ts` (`ExecutionStepFailed`) |
| 3.11 Retries | `packages/ami/src/reasoning/retry-strategy-resolver.ts`; `packages/workflow` (`WorkflowPlan.maxAttempts`, `WorkflowStepRetried`) |
| 3.12 Progress | `packages/execution-engine/src/ProgressTracker.ts`; `PROGRESS_ESTIMATOR_TOKEN`; `WorkflowExecution.progress` |
| 3.13 Verification | `packages/ami/src/reasoning/verification-engine.ts` + strategies; `ObservationCollector`; `mission.reasoning.verification.*` |
| 3.14 Observability | `packages/events` (history/middleware); `ToolAuditRecord`; memory events; `mission.agent.*` |
| 3.15 Studio | `packages/studio-api/src/StudioOrchestrator.ts`; `StudioApi`/`ActivityFeed`/`StudioHome` |

---

## 7. Open items for approval

### 7.1 Package boundary: `packages/agents` vs. `packages/agent-runtime`

**Question:** what exactly lives where, so the new package cannot drift into
duplicating the existing runtime?

**Options weighed:**

- **Option A — `packages/agents` = specialist content only (RECOMMENDED).**
  `packages/agent-runtime` keeps ownership of registry, lifecycle, and messaging
  **outright** — no re-export, no wrapper, no shadow copy. `packages/agents` holds
  only: (a) the six specialist `Agent` implementations, (b) their
  `AgentTypeDescriptor`s, (c) domain types that are *additive and game-domain*
  (`AgentRole`, `AgentTask`, `AgentResult`, `AgentMissionContext`), (d) the
  `mission.agent.*` event catalog, (e) the `AgentTaskExecutor` bridge and
  `MissionOrchestrator` (orchestration glue, kept here for Phase 2 cohesion).
  **The seam is a plain import, exactly like `execution-engine` already does:**
  `packages/agents` imports `Agent`, `AgentTypeDescriptor`, `AgentContext`,
  `AgentId`/`AgentType`/`AgentCapability`, `AgentMessage` and `AGENT_RUNTIME_TOKEN`
  from `@gamedev-agent/agent-runtime`; it touches the runtime only via
  `runtime.registerType` at boot (`agentsModule`), plus read-ops
  (`findAgentByCapability`, `getAgentStatus`) from the orchestrator. It never
  re-exports those names — consumers that need the runtime import
  `@gamedev-agent/agent-runtime` directly.
  **Explicit non-goal:** no `export *` of agent-runtime concepts from the new
  package. If a convenience base is ever needed (e.g. a typed `TaskAgent` over the
  base `Agent`), it is a *new* interface defined in `packages/agents` that builds
  on, and imports from, the base — never a re-export.
- **Option B — specialists inside `packages/agent-runtime`.** Keeps one package,
  but couples the generic runtime (currently consumed generically by
  `execution-engine`'s `AgentDispatcher`) to game-domain roles and the
  `mission.agent.*` catalog, growing the runtime's contract with roster content.
  Rejected on "small surfaces, strong guarantees" (MASTERPLAN §5).
- **Option C — split `packages/orchestrator` out from day one.** No consumers
  exist yet; adding a package before content lands is premature. Defer a split to
  Phase 6+ if the orchestrator outgrows the package.

**Answer for sign-off:** yes — `packages/agents` holds only the six `Agent`
implementations + their domain wiring; `packages/agent-runtime` owns
registry/lifecycle/messaging outright; the seam is a plain one-way import.

### 7.2 Engagement: dependencies via DI; tasks/results via events only

**Question:** how does an orchestrator or the `AgentTaskExecutor` bridge actually
get work into a specialist agent?

**Options weighed:**

- **Mechanism A — runtime request/response.** Bridge calls
  `AgentRuntime.requestFrom(...)`; the runtime delivers via `agent.onMessage`;
  the caller awaits by `correlationId`. Pros: existing tested transport, built-in
  timeout, runtime-managed busy status. Cons: the orchestrator→specialist task
  flow lives *inside* the runtime's message layer, not on the event stream —
  weaker observability (no history/middleware/Studio feed on task flow unless
  mirrored), and specialists receive tasks via `onMessage`, coupling task intake
  to the runtime's delivery path. (This is what §3.4 originally leaned toward;
  superseded.)
- **Mechanism B — pure event (RECOMMENDED, this is the confirmed split).**
  Dependencies are **DI-resolved** (per AD-4). Tasks are delivered as
  `mission.agent.assigned` on the shared bus; specialists subscribe via
  `AgentContext.events` in `onStart()`, filtered by role/agentId; results are
  returned as `mission.agent.result`; the bridge/orchestrator awaits by
  subscribing to `mission.agent.result` filtered on `taskId`, with a timeout, and
  disposing the subscription on match — the exact `ApprovalGate` lifecycle
  (`packages/ami/src/approval/approval-gate.ts`). Pros: full observability
  (history ring, middleware, Studio feed), true decoupling (a specialist needs
  only the bus + DI, not runtime invocation), retries/verification subscribe to
  the same stream, and it matches AD-3 exactly. Cons: the bridge must implement
  the await-with-timeout subscription (small; proven by `ApprovalGate`), and there
  is no runtime-provided per-message timeout on the event path — the bridge owns
  it. Agent-to-agent point-to-point messaging still uses
  `AgentRuntime.request/send/broadcast` unchanged.
- **Mechanism C — direct synchronous call.** The bridge or orchestrator holds
  `Agent` references and calls `onMessage` directly. Rejected outright: bypasses
  runtime lifecycle/status/error handling, the event stream, and history —
  precisely the coupling this effort exists to avoid.

**Answer for sign-off:** confirmed. **StudioOrchestrator and MissionAgent never
call an agent directly**; the bridge never holds an agent reference to invoke
synchronously. Agents receive dependencies via DI (container resolution) and
tasks/results via `mission.agent.*` events on the shared bus — nothing else.

### 7.3 Routing default: fall back to the single-agent path

**Question:** what happens when the routing predicate in `onPlanCreated` cannot
decide, or no capability-matched agent exists?

**Answer for sign-off:** the predicate is tri-state and **conservative**:

- explicit, complete role→agent resolution **and** multi-agent readiness →
  `multi-agent`;
- **any** uncertainty — no capability-matched agent, unmapped role, plan shape
  unsupported by the multi-agent layer, or multi-agent disabled → `single-agent`,
  i.e. fall through to the existing `missionAgent.run(source)` path unchanged
  (Phase 4 default = every mission takes this path).

No fail, no queue, no dead-letter by default. Multi-agent is a **strict
extension**: behavior for anything the multi-agent layer does not yet handle is
byte-for-byte today's behavior. (A queue/dead-letter is a later option once the
multi-agent path is proven; it is out of scope for Phases 2–4.)

### 7.4 Namespace separation: `mission.agent.*` vs. `agent.*`

**Answer for sign-off:** confirmed, with one precision. The existing `agent.*`
events (10 definitions: `state-changed`, `thought`, `observation`, `decision`,
`action-started`, `action-result`, `verification`, `progress`, `mission-complete`,
`artifact-created`) are owned by **`packages/execution-engine/src/
MissionAgentEvents.ts`** and emitted by `MissionAgent` — kept untouched. (The
framing "agent-runtime's lifecycle telemetry" needs a precision: `agent-runtime`
tracks lifecycle via `AgentStatus` + logs and owns the internal point-to-point
`AgentMessage`; it does not emit `agent.*` bus events.) The new `mission.agent.*`
catalog (9 definitions) is owned exclusively by the new
`packages/agents/src/AgentEvents.ts` and covers **only** mission-level task
assignment/results. Zero overlapping event types between the two namespaces.
