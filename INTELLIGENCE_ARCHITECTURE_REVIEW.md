# Nova Intelligence Architecture: Principal Review

> Brutal critique of the proposed v1 architecture.
> Goal: reduce complexity by 60% while keeping all real value.

---

## Summary Verdict

The proposed architecture has **good instincts** but suffers from classic Big Design Up Front syndrome: 10 new packages, 11 event namespaces, 4-layer decision logic, 10-stage context pipeline, and wrapping layers that add indirection without value. It would take 6-12 months to build and produce a system that's hard to debug, harder to change, and largely speculative.

**What's genuinely needed for v1**: A reasoning step before execution and structured failure handling. Everything else is either premature, duplicative of existing subsystems, or should be a lightweight integration rather than a full package.

---

## 1. Subsystem-by-Subsystem Breakdown

### 1.1 Goal Engine

**Is it necessary today?** No.

The existing `Producer` already takes a `GoalRequest` with title, description, and constraints, runs deterministic analysis, and produces a `GoalAnalysis` with objectives and milestones. The "understanding" gap is real — the Producer doesn't detect ambiguity or define success criteria — but this doesn't warrant a full package.

**Could another subsystem absorb it?** Yes. Extend the existing `Producer.analyse()` step to also:
- Ask an LLM for ambiguity detection (a single prompt call)
- Attach confidence and success criteria to the existing `GoalAnalysis`

No new package. No new data types. One new field on `GoalAnalysis`.

**Simplest version:**
```typescript
// Add to existing Producer.analyse():
const enrichment = await this.reasoningService.enrichGoal(goalRequest);
// enrichment = { ambiguityFlags, successCriteria, confidence }
// Attach to existing GoalAnalysis
```

**Verdict: DELETE as standalone package. Absorb into existing Producer as a single method call.**

---

### 1.2 Mission Planner

**Is it necessary today?** No.

The existing `Planner` already has strategies (DependencyGraphStrategy, SequentialPlanningStrategy). It already produces `ExecutionPlan` with phases, steps, and dependencies. The "higher-level phase decomposition" the Mission Planner adds is one additional strategy, not a new subsystem.

**Could another subsystem absorb it?** Yes. Add a `PhasedPlanningStrategy` to the existing Planner. Same interface, different algorithm. The existing `PlannerManager` already delegates to strategies.

**Simplest version:**
```typescript
// New strategy in existing planner package
class PhasedPlanningStrategy implements PlanningStrategy {
  build(context: PlanningContext): ExecutionPlan {
    // 1. Use LLM to decompose goal into phases
    // 2. Deterministic topological sort within phases
    // 3. Return ExecutionPlan (existing type)
  }
}
```

Risk scoring, capability estimates, and alternative tracking are v2 concerns. The existing `Milestone` and `ExecutionStep` types can carry everything needed for v1.

**Verdict: DELETE as standalone package. Add a single strategy to existing Planner.**

---

### 1.3 Reasoning Engine

**Is it necessary today?** YES — this is the core missing piece.

The system currently dispatches to the LLM without explicitly deciding *how*. The `ContextAssembler` does model selection but doesn't reason about approach, tools, memories, or context strategy. This is Nova's intelligence gap.

**However**, the proposed `ReasoningPlan` with alternatives tracking, fallback chains, and elaborate context strategies is over-engineered for v1.

**Simplest version:**
```typescript
interface ReasoningService {
  decide(input: {
    task: string;
    availableModels: ModelInfo[];
    availableTools: ToolCapability[];
    context: CurrentContext;
  }): {
    model: string;           // model id
    tools: string[];         // tool capabilities to enable
    approach: string;        // single string, no alternatives
    contextPurpose: string;  // maps to existing ContextPurpose
  };
}
```

No `ReasoningPlan` data type. No stored alternatives. No memory strategy (use defaults). No compression level (use default). The output is consumed immediately by the existing `ContextAssembler` and `ToolBridge`.

**Verdict: KEEP but simplify by 80%. Single service, one method, thin result. No plan persistence. No alternatives tracking. No fallback chains (those belong in recovery).**

---

### 1.4 Context Engine v2

**Is it necessary today?** Partially.

The existing 6-stage pipeline is already functional. Adding new context providers is the right idea, but doing it through the existing `ContextProviderRegistry` — which already supports dynamic registration — requires no new package and no new pipeline stages.

**The problems with the proposal:**

1. **7 new providers in v1** is too many. `KnowledgeGraphProvider` can't exist without Knowledge Graph (which should be deferred). `LearningProvider` can't exist without Learning Engine (deferred). `AlternativeProvider` and `RecoveryProvider` require preconditions that don't exist in v1.

2. **4 new pipeline stages** adds complexity without clear ROI. The existing Ranker + TokenBudget already handles relevance and budget. `NoiseFilter` is speculative. `ExplainabilityInjector` produces a data structure no one reads.

3. **"Context Engine v2" branding** is a red flag. It signals "this is a rewrite" when it should be "let me add a provider."

**Simplest version:**
```typescript
// Add 2 providers to existing context/providers/ directory
class ProjectMemoryProvider implements ContextProvider { ... }
class PreviousMissionProvider implements ContextProvider { ... }

// Register them in the existing contextModule
```

**Verdict: DELETE "v2" branding. Add 2 providers to the existing context package. Zero new pipeline stages in v1.**

---

### 1.5 Executor

**Is it necessary today?** No.

This is a textbook wrapping anti-pattern. The existing `ExecutionEngine.executeStep()` already handles the execution loop: assemble context → dispatch model → invoke tools → record results. Wrapping it in an "Executor" adds a new abstraction layer with pre-validation, observation, and continuation logic that can — and should — be added directly to the existing Execution Engine.

**Specific issues:**

- **Pre-condition validation**: Belongs in the Workflow engine (which already tracks step dependencies). Adding it here duplicates that concern.
- **Round-level observation**: The existing Execution Engine already emits `execution.tool-invoked` and `execution.tool-result` events. The Observer subscribes to those.
- **Verification**: This is a new concern, but belongs in the step execution loop, not in a wrapper.

**Simplest version:**
```typescript
// Extend existing ExecutionEngine, don't wrap it:
class ExecutionEngine implements StepExecutor {
  async executeStep(step, context): Promise<StepResult> {
    // Existing flow, plus:
    this.eventBus.publish('execution.round-start', { step });
    // ...existing dispatch + tool loop...
    const result = await this.executeRound(step, context);
    this.eventBus.publish('execution.round-end', { step, result });
    return result;
  }
}
```

**Verdict: DELETE. Extend the existing Execution Engine with lifecycle hooks and events. If hooks are truly needed, add an `ExecutionHook` interface that plugins can register.**

---

### 1.6 Observer

**Is it necessary today?** Not as a standalone package.

The Observer is a thin classification layer on top of existing events. The classification rules are simple if-else chains. This logic belongs inline where it's consumed — in the Recovery Engine (for failures) and in a lightweight trace buffer for the UI.

**Specific issues:**

- **ObservationRing with persistence**: Premature. The existing Event Bus already buffers events. If a trace log is needed, write to Memory on mission completion.
- **Observation classification**: The rule table is small and deterministic. It doesn't need its own subsystem.
- **The Observer feeds into exactly two consumers**: Recovery Engine (failures) and Learning Engine (all observations). With Learning Engine deferred, the Observer has one consumer.

**Simplest version:**
```typescript
// Inside Recovery Engine constructor:
this.bus.subscribe('execution.tool-result', (event) => {
  if (!event.ok) this.handleFailure(event);
});

this.bus.subscribe('execution.step-failed', (event) => {
  this.handleFailure(event);
});
```

**Verdict: DELETE as standalone package. Recovery Engine subscribes to events directly. Trace logging is a Memory write on mission completion.**

---

### 1.7 Recovery Engine

**Is it necessary today?** YES — the system has no structured failure handling.

The existing `RetryHandler` middleware in the model providers layer handles transient model failures, but there's no recovery at the execution level. When a tool call fails, the mission fails. This is the second core piece (after Reasoning Engine) that v1 needs.

**However**, the proposed 7 recovery strategies with full diagnosis is over-engineered for v1.

**Simplest version:**
```typescript
interface RecoveryService {
  handle(input: {
    failedStep: ExecutionStep;
    error: Error;
    context: ExecutionContext;
    retryCount: number;
  }): Promise<RecoveryAction>;

  // Recovery strategies for v1:
  // 1. 'retry' — re-execute the same step (max 3)
  // 2. 'escalate' — stop and tell the user
}

type RecoveryAction = 
  | { type: 'retry'; delayMs: number }
  | { type: 'escalate'; diagnosis: string };
```

No `FailureDiagnosis` data type with probable causes and confidence scores. No `RecoveryPlan`. No `fallback_model`, `reduce_scope`, `alternative_approach`, or `skip_step` — those require deeper reasoning capabilities that don't exist in v1.

The Recovery Engine should NOT trigger re-reasoning or re-planning in v1. It retries the same step or tells the user. That's it.

**Verdict: KEEP but strip to 2 strategies: retry + escalate. No diagnosis model. No fallback chain. No interaction with Reasoning Engine or Mission Planner.**

---

### 1.8 Learning Engine

**Is it necessary today?** No.

Nova v1 won't have enough mission history to learn meaningful patterns. Building the pattern extraction, indexing, pruning, and retrieval infrastructure before there's data is premature optimization. The existing Memory system already stores execution records — that's sufficient.

**What would happen if we defer it?**
- Missions execute without pattern lookup
- No recommendations from past failures
- No automatic behavior improvement

All of these are acceptable for v1. The system will still be more capable than today.

**When would it become necessary?**
- After 100+ missions completed
- When users start asking "why did Nova do X the same way it failed last time?"
- When teams want cross-project learning

**Verdict: DELETE for v1. Store raw execution records in Memory (existing mechanism). Defer pattern extraction to v2 when there's data to extract from.**

---

### 1.9 Knowledge Graph

**Is it necessary today?** No.

This is the most expensive subsystem in the proposal with the least immediate value. It requires:
- A graph data model and storage
- Entity extraction from multiple sources
- Relationship inference algorithms
- A traversal query engine
- Integration with Context Pipeline

The existing Memory system with tags, categories, and tiered storage can approximate graph queries for v1. For example, "what depends on X?" can be answered by a Memory query with tag `depends-on:X`.

**What would happen if we defer it?**
- Context assembly uses flat memory queries instead of graph traversal
- Impact analysis is manual (user asks "what else will this affect?")
- Architecture validation is human-driven

All acceptable for v1.

**Simpler alternative for v1:**
```typescript
// Extend MemoryEntry with relationship fields (not a new subsystem):
interface MemoryEntry {
  // ...existing fields...
  relationships?: Array<{
    targetId: string;
    type: string;
    weight: number;
  }>;
}

// Query with relationship filter:
const impacted = memory.query({
  tags: ['depends-on'],
  text: changedFile,
});
```

**Verdict: DELETE for v1. Add a `relationships` field to the existing `MemoryEntry`. Enough for basic queries. Full graph in v2+.**

---

### 1.10 Decision Engine

**Is it necessary today?** Not as a standalone service.

The concept of centralized decision-making is architecturally appealing but practically problematic:

1. **Every decision point has different inputs**: The Goal Engine's "should I clarify?" decision has nothing in common with the Executor's "should I retry?" decision. Forcing them through a generic `DecisionRequest`/`Decision` interface adds abstraction without value.

2. **Performance**: Every tool call round in a 10-round step would require a synchronous `decide()` call. For the Executor's inner loop, this adds 10+ decision hops per step. Each hop evaluates 4 layers of rules. Latency accumulates.

3. **The 4-layer model is speculative**: Layers 3 (learned patterns) and 4 (AI reasoning) don't exist yet (Learning Engine deferred, AI reasoning is what we're building). That leaves 2 layers: hard rules and policy rules. Hard rules are if-statements. Policy rules are config maps. Neither requires a service.

**Simplest version:**
```typescript
// No Decision Engine package. Each subsystem owns its decisions:

// In Goal Engine:
if (confidence < this.config.ambiguityThreshold) {
  return { action: 'clarify', questions };
}

// In Recovery Engine:
if (retryCount >= this.config.maxRetries) {
  return { action: 'escalate', diagnosis };
}

// Configuration-driven thresholds stored in the existing config system
```

**Verdict: DELETE as standalone service. Decision logic lives in each subsystem, driven by configurable thresholds. The "centralized decision" concept is premature and adds indirection without benefit.**

---

## 2. Cross-Cutting Issues

### 2.1 Package Bloat

**The proposal**: 10 new packages.
**What v1 needs**: 2 new packages (Reasoning Service + Recovery Service).

The other 8 are either:
- Absorbable into existing packages (Goal Engine → Producer, Mission Planner → Planner, Context providers → Context, Executor → Execution Engine)
- Deferrable (Learning Engine, Knowledge Graph)
- Unnecessary architecture (Observer evaporates, Decision Engine evaporates)

Packages are liabilities. Each new package means: build config, test setup, CI time, dependency versioning, API surface, documentation, maintenance burden. 10 packages is ~6 months of work for a single engineer. 2 packages is ~6 weeks.

### 2.2 Event Proliferation

**The proposal**: 11 new event namespaces with ~40 event types.
**What v1 needs**: 2 new event types.

| Proposed | v1 |
|----------|-----|
| `goal.*` (4 events) | 0 (handled by existing producer events) |
| `mission-plan.*` (2 events) | 0 (handled by existing planner events) |
| `reasoning.*` (2 events) | 1 (`reasoning.decision-made`) |
| `context.*` (3 events) | 0 (existing context events sufficient) |
| `execution.*` (new events) | 0 (existing execution events sufficient) |
| `observation.*` (4 events) | 0 (subsystems subscribe to existing events) |
| `recovery.*` (4 events) | 1 (`recovery.action-taken`) |
| `learning.*` (2 events) | 0 (deferred) |
| `knowledge-graph.*` (2 events) | 0 (deferred) |
| `decision.*` (2 events) | 0 (deleted) |

Event bus maintenance is a real cost. Schema evolution, consumer compatibility, replay semantics. Each event type must be justified.

### 2.3 The Wrapping Anti-Pattern

The proposed "Executor wrapping Execution Engine" is the most dangerous architectural choice. Wrapping creates:

1. **Debugging ambiguity**: Is the bug in the wrapper or the wrapped? Two stacks to check.
2. **Version coupling**: If the wrapped interface changes, the wrapper must change. Indirect dependency.
3. **Performance overhead**: Method calls through a wrapper that adds no value (just delegates).
4. **Fake modularity**: The wrapper isn't adding a new capability — it's spreading existing capability across two layers.

**Rule**: Don't wrap. Extend. If Execution Engine needs pre/post hooks, add them to Execution Engine. If it needs validation, add validation to the execution loop.

### 2.4 Speculative Generality

Multiple components in the proposal are built for requirements that don't exist yet:

- `ReasoningPlan.alternatives` — "we might want to know what we didn't choose"
- `RecoveryPlan.estimatedSuccessProbability` — "we might want to score recoveries"
- `LearningRecord.applicability` — "we might want to filter patterns by context"
- `GraphEntity.metadata` with language, framework, size — "we might want to query by these"
- `Decision.provenance.consultedPatterns` — "we might want to trace which pattern influenced a decision"

Each speculative field adds surface area: documentation, serialization, testing, migration. 20% of the fields will be used in v1. The other 80% are dead code until v3 (if ever).

### 2.5 Premature Learning Feedback Loop

The proposal creates a learning loop across 4 subsystems:

```
Mission completed → Learning Engine → Memory (pattern tier)
                                          ↑ query ↓
Decision Engine ← learned patterns ← Learning Engine
    ↓ decide
Recovery Engine / Executor / etc.
```

This is a feedback loop with no bounds. A wrong pattern gets written to Memory, queried by Decision Engine, influences recovery strategies, which produce more wrong patterns. Debugging this requires tracing across 4 subsystems across multiple mission lifecycles.

Feedback loops are powerful but dangerous. They should be introduced carefully, with:
- Explicit confidence thresholds (not stored)
- Human-in-the-loop for pattern promotion (not automatic)
- Rollback capability (for the entire pattern store)

None of these safeguards are in the proposal.

---

## 3. Metrics

### Proposed v1:
- 10 new packages
- ~40 new event types
- ~25 new data types (StructuredGoal, PhasedMissionPlan, ReasoningPlan, ReasoningPlan.approach, ReasoningPlan.modelSelection, etc.)
- 4-layer decision logic
- 10-stage context pipeline
- 7 new context providers
- ~12 months to build, test, stabilize

### Recommended v1:
- 2 new packages
- 2 new event types
- 0 new data types (use existing types, add fields where needed)
- 2 new context providers (added to existing package)
- Configurable thresholds (not a decision engine)
- ~6 weeks to build, test, stabilize

### What v1 actually ships:
- Reasoning service that decides model/tools/approach before each step
- Recovery service that retries transient failures and escalates permanent ones
- That's it

---

## 4. Recommended Architectures

### 4.1 MVP Architecture (2-3 weeks)

The absolute minimum to prove the intelligence layer works.

```
Flow: User → Producer (no change) → Coordinator (no change) → Planner (no change)
      → Workflow (no change) → Execution Engine (with new hooks)
                                                                  ↓
                                                       [Reasoning Service]
                                                       decides model + tools
                                                                  ↓
                                                       [Recovery Handler]
                                                       retries or escalates
```

**What changes:**
1. **Add `reasoningService` to ExecutionEngine**: Before dispatching to the model, call a service that selects the model and tools. The service is a simple rules engine with LLM fallback.
2. **Add `recoveryHandler` to ExecutionEngine**: When a tool call fails, retry up to 3 times, then escalate.
3. **Add pre/post hooks to ExecutionEngine**: `beforeDispatch` and `afterToolCall` callback registration.

**No new packages.** Everything is in the existing `execution-engine` package, optionally extracted into a `reasoning.ts` file.

**What's NOT in MVP:**
- No ambiguity detection (Producer unchanged)
- No structured recovery (retry + escalate only)
- No learning
- No knowledge graph
- No decision engine
- No observer
- No context engine v2
- No mission planning strategy

**Why this works:** It proves the two core hypotheses — (1) explicit reasoning before execution produces better results, (2) structured recovery reduces failure rates — with minimal investment.

---

### 4.2 Recommended v1 Architecture (6-8 weeks)

```
┌──────────────────────────────────────────────────────────────────┐
│                        v1 INTELLIGENCE LAYER                      │
│                                                                   │
│  New: @gamedev-agent/reasoning                                    │
│  New: @gamedev-agent/recovery                                     │
│  Modified: @gamedev-agent/producer (+ enrichment step)            │
│  Modified: @gamedev-agent/planner (+ PhasedPlanningStrategy)      │
│  Modified: @gamedev-agent/context (+ 2 providers)                 │
│  Modified: @gamedev-agent/execution-engine (+ hooks)              │
│  Modified: @gamedev-agent/memory (+ relationships field)          │
|                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Package: `@gamedev-agent/reasoning`** (new, ~200 lines)

Purpose: Decide model, tools, and approach before every execution step.

```
interface ReasoningService {
  plan(input: {
    task: ExecutionStep;
    context: ExecutionContext;
    availableModels: ModelInfo[];
    availableTools: ToolDescriptor[];
  }): {
    modelId: string;
    enabledToolActions: string[];
    approach: string;
    contextPurpose: ContextPurpose;
  };
}
```

- Single method, no persistence, no alternatives
- Deterministic model selection (capability matching + cost ranking)
- LLM-driven approach selection (single prompt: "what approach works for this task?")
- Output consumed immediately by ContextAssembler and ToolBridge
- Records decision in step metadata (for debugging, not for learning)

**Package: `@gamedev-agent/recovery`** (new, ~150 lines)

Purpose: Handle execution failures with retry or escalation.

```
interface RecoveryService {
  handle(input: {
    step: ExecutionStep;
    error: ExecutionError;
    attempt: number;       // 1-indexed
    context: ExecutionContext;
  }): Promise<{
    action: 'retry' | 'escalate';
    diagnosis: string;     // one-line explanation
    delayMs?: number;      // for retry
  }>;
}
```

- 2 strategies only: retry (max 3) or escalate
- No fallback model, no re-reasoning, no re-planning
- Diagnosis is a string (not a FailureDiagnosis model)
- Publishes one event: `recovery.action-taken`

**Modified: `@gamedev-agent/producer`** (+1 method)

Add `enrichGoal(request)` that calls the LLM for ambiguity detection and success criteria. Attaches results to the existing `GoalAnalysis`. No new data types — add optional fields to `GoalAnalysis`.

**Modified: `@gamedev-agent/planner`** (+1 strategy)

Add `PhasedPlanningStrategy` that decomposes the goal into phases before producing the execution plan. Uses existing `ExecutionPlan`, `ExecutionPhase`, and `ExecutionStep` types. Adds no new types.

**Modified: `@gamedev-agent/context`** (+2 providers)

Add `ProjectMemoryProvider` and `PreviousMissionProvider`. Register through existing `ContextProviderRegistry`. No new pipeline stages.

**Modified: `@gamedev-agent/execution-engine`** (+hooks)

Add two lifecycle hooks: `onBeforeDispatch` and `onAfterToolCall`. The Reasoning Service and Recovery Service register through these hooks. No wrapping, no new execution loop.

**Modified: `@gamedev-agent/memory`** (+field)

Add optional `relationships` array to `MemoryEntry`. Allows basic relationship queries without a graph subsystem.

**What v1 ships:**
- Reasoning before every execution step
- Retry + escalate recovery
- Ambiguity detection in goal analysis
- Phase-based planning strategy
- Richer context from project memory + past missions
- Basic relationship tracking in memory
- Configurable thresholds (max retries, confidence floor, etc.)

**What v1 explicitly defers:**
- Goal Engine (absorbed into Producer)
- Context Engine v2 (2 providers added to existing, no v2 package)
- Executor (hooks added to existing)
- Observer (logic distributed to consumers)
- Learning Engine (v2)
- Knowledge Graph (v2, starts as memory relationships field)
- Decision Engine (thresholds in config, logic in each subsystem)
- Advanced recovery (fallback model, re-reasoning, re-planning, skip step)

---

### 4.3 Long-term Architecture (v2, v3, v4)

```
v2 (3-6 months after v1):
├── @gamedev-agent/learning-engine  ← now there's data to learn from
├── @gamedev-agent/knowledge-graph  ← memory relationships field grew too complex
├── @gamedev-agent/reasoning v2     ← add fallback chains, alternative tracking
├── @gamedev-agent/recovery v2      ← add fallback_model, reduce_scope
└── @gamedev-agent/producer v2      ← full Goal Engine integration, not just enrichment

v3 (6-12 months after v2):
├── Decision Engine                 ← learning data + policy rules now justify it
├── Context Engine v2               ← noise filter needed with N providers
├── Observation Framework           ← analytics/monitoring justifies it
└── Multi-mission Orchestrator      ← concurrent missions become common

v4 (12+ months after v3):
├── Predictive Recovery             ← learned patterns enable prediction
├── Plugin Intelligence             ← plugins contribute providers/strategies
├── Learning Federation             ← cross-project pattern sharing
└── Performance Optimization Layer  ← metrics-driven auto-tuning
```

Each phase has a **forcing function** — a concrete problem that the new subsystem solves — rather than speculative generality.

---

## 5. Summary: What To Build

| Subsystem | Proposal | Verdict | v1 Action |
|-----------|----------|---------|-----------|
| Goal Engine | Standalone package | DELETE | Add `enrichGoal()` to Producer |
| Mission Planner | Standalone package | DELETE | Add `PhasedPlanningStrategy` to Planner |
| Reasoning Engine | Full ReasoningPlan | SIMPLIFY | Single-method service, no persistence |
| Context Engine v2 | 7 providers, 4 stages | TRIM | Add 2 providers to existing Context |
| Executor | Wrapper package | DELETE | Add hooks to Execution Engine |
| Observer | Standalone package | DELETE | Recovery Engine subscribes directly |
| Recovery Engine | 7 strategies + diagnosis | SIMPLIFY | retry + escalate only |
| Learning Engine | Pattern extraction | DELETE(v1) | Defer to v2 |
| Knowledge Graph | Graph subsystem | DELETE(v1) | Add relationships field to Memory |
| Decision Engine | 4-layer service | DELETE(v1) | Config thresholds + local logic |

**v1 total: 2 new packages, 6 modified packages, ~6-8 weeks.**

Everything proposed in the original document is achievable. But only 20% of it is necessary today. The rest is speculation dressed as architecture.
