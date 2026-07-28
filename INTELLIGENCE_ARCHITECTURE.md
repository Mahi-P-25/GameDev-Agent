# Nova Intelligence Architecture v1

> Nova's cognitive architecture — how Nova thinks, reasons, learns, and executes.
> This is NOT an LLM wrapper. The LLM is one subsystem. Nova's intelligence is the product.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Component Diagram](#3-component-diagram)
4. [Subsystem Specifications](#4-subsystem-specifications)
   - 4.1 Goal Engine
   - 4.2 Mission Planner
   - 4.3 Reasoning Engine
   - 4.4 Context Engine v2
   - 4.5 Executor
   - 4.6 Observer
   - 4.7 Recovery Engine
   - 4.8 Learning Engine
   - 4.9 Knowledge Graph
   - 4.10 Decision Engine
5. [Data Flow](#5-data-flow)
6. [Interfaces](#6-interfaces)
7. [Integration Map](#7-integration-map)
8. [Mission Lifecycle](#8-mission-lifecycle)
9. [Failure Lifecycle](#9-failure-lifecycle)
10. [Learning Lifecycle](#10-learning-lifecycle)
11. [Future Expansion Points](#11-future-expansion-points)

---

## 1. Philosophy

### Nova is an AI Operating System

The UI is a thin shell. The runtime, execution engine, model providers, and tool runtime already exist. The missing piece is intelligence — the cognitive layer that turns raw user input into reliable, observable, learning-driven execution.

### Design Constraints

- **Provider-agnostic**: Gemini, Claude, GPT, DeepSeek, local models all plug into the same intelligence layer.
- **Deterministic where possible**: Decisions are made by explicit reasoning, not stochastic generation.
- **Observable**: Every decision, every action, every failure is recorded and explainable.
- **Modular**: Each subsystem has exactly one responsibility.
- **Mission-oriented**: Every user request becomes a mission with a lifecycle.

### What This Is Not

- Not LangChain (no chain-of-thought wrappers, no agent frameworks).
- Not AutoGPT (no infinite loops, no prompt-injected goals).
- Not Manus (no monolithic agent, no opaque execution).
- Not an LLM wrapper (the LLM is one component among many).

### Core Principle: Think Like an Engineer

Every request flows through: **Understand → Plan → Reason → Execute → Observe → Recover → Learn → Complete**

---

## 2. Architecture Overview

The Intelligence Architecture is a layered pipeline. Each layer transforms or enriches the mission artifact as it flows through the system. The layers communicate through the existing Event Bus and well-defined data contracts.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENCE LAYER                           │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐│
│  │  Goal    │→ │ Mission  │→ │Reasoning │→ │ Context  │→ │Execute││
│  │  Engine  │  │ Planner  │  │ Engine   │  │Engine v2 │  │  or   ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───┬───┘│
│       │              │              │              │           │    │
│       │              │              │              │           │    │
│  ┌────▼──────────────▼──────────────▼──────────────▼───────────▼┐   │
│  │                   Decision Engine (always on)                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│       │              │              │              │           │    │
│       │              │              │              │           │    │
│  ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐  ┌──▼──┐ │
│  │Observer │   │ Recovery  │  │Learning │  │ Knowledge │  │     │ │
│  │(always) │   │ Engine    │  │ Engine  │  │ Graph     │  │ ... │ │
│  └─────────┘   └───────────┘  └─────────┘  └───────────┘  └─────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXISTING SUBSYSTEMS                              │
│  Producer → Coordinator → Planner → Workflow → Execution Engine     │
│  Context Pipeline → Model Providers → Tool Runtime → Memory         │
│  Director → Runtime → Event Bus                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The Intelligence Layer wraps and extends the existing subsystems. It does not replace them. Each new component either:
- **Feeds into** an existing subsystem (Goal Engine → Producer)
- **Wraps** an existing subsystem with additional logic (Executor wraps Execution Engine)
- **Observes** existing subsystems via the Event Bus (Observer, Recovery Engine, Learning Engine)
- **Extends** existing data with new relationships (Knowledge Graph extends Memory)

---

## 3. Component Diagram

```
                    ┌──────────────────────────┐
                    │      User Request        │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │      1. Goal Engine      │
                    │  Understand, constrain,  │
                    │  detect ambiguity, define │
                    │  success criteria        │
                    └────────────┬─────────────┘
                                 │ StructuredGoal
                    ┌────────────▼─────────────┐
                    │  [Existing] Producer      │
                    │  (Goal → MissionProposal) │
                    └────────────┬─────────────┘
                                 │ MissionProposal
                    ┌────────────▼─────────────┐
                    │    2. Mission Planner    │
                    │  Phases, priorities,     │
                    │  dependencies, task graph│
                    └────────────┬─────────────┘
                                 │ PhasedMissionPlan
                    ┌────────────▼─────────────┐
                    │  [Existing] Coordinator    │
                    │  + Planner + Workflow     │
                    └────────────┬─────────────┘
                                 │ ExecutionPlan (steps)
                    ┌────────────▼─────────────┐
                    │   3. Reasoning Engine    │
                    │  Approach, model, tools, │
                    │  memories, context       │
                    │  strategy                │
                    └────────────┬─────────────┘
                                 │ ReasoningPlan
                    ┌────────────▼─────────────┐
                    │   4. Context Engine v2   │
                    │  Gather + compress +     │
                    │  remove noise            │
                    └────────────┬─────────────┘
                                 │ ContextPackage
                    ┌────────────▼─────────────┐
                    │  [Existing] Context        │
                    │  Pipeline (Resolver →     │
                    │  Builder → Dedup → Ranker │
                    │  → Budget → Compressor)   │
                    └────────────┬─────────────┘
                                 │ AssembledContext
                    ┌────────────▼─────────────┐
                    │     5. Executor          │
                    │  Validate → Execute →     │
                    │  Observe → Continue       │
                    └────────────┬─────────────┘
                                 │ tool calls
                    ┌────────────▼─────────────┐
                    │  [Existing] Execution      │
                    │  Engine (Dispatch →       │
                    │  ToolBridge → Record)     │
                    └────────────┬─────────────┘
                                 │ result
                    ┌────────────▼─────────────┐
                    │     6. Observer          │
                    │  Success? Failure?       │
                    │  Warnings? Update state  │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │                          │
                    │          ┌───────────────▼──────────┐
                    │          │  7. Recovery Engine     │
                    │          │  Analyze → Diagnose →   │
                    │          │  Choose → Retry/Flag    │
                    │          └─────────────────────────┘
                    │
                    ┌────▼─────────────────────┐
                    │  8. Learning Engine       │
                    │  Store goal, plan, errors,│
                    │  outcome, recommendation  │
                    └──────────────────────────┘

  ┌───────────────────────────────────────────────────┐
  │              9. Knowledge Graph                    │
  │  Projects → Files → Components → Systems → Arch   │
  │  Relationships → Dependencies                     │
  └───────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────┐
  │          10. Decision Engine (always on)           │
  │  Ask? Execute? Search? Retry? Stop?               │
  │  Consulted at every branching point               │
  └───────────────────────────────────────────────────┘
```

---

## 4. Subsystem Specifications

### 4.1 Goal Engine

**Package**: `@gamedev-agent/goal-engine` (new)

**Purpose**: Convert raw user input into a structured, unambiguous goal with explicit success criteria, before any planning or execution begins.

**Responsibilities**:
- Parse and classify user intent (feature, fix, refactor, research, optimize, explore)
- Extract explicit and implicit constraints (time, performance, compatibility, scope)
- Detect ambiguity and generate targeted clarification questions
- Define measurable success criteria (acceptance tests, validation gates)
- Produce a `StructuredGoal` artifact that the Producer consumes

**Input**:
- Raw user message (string)
- Current context snapshot (from ContextManager)
- Project metadata (from Project Manager)

**Output**: `StructuredGoal`

```
StructuredGoal {
  id: GoalId
  title: string
  intent: IntentClassification     // feature | fix | refactor | research | optimize | explore
  description: string              // normalized, unambiguous
  constraints: Constraint[]        // { type: 'time'|'perf'|'compat'|'scope', description, severity }
  successCriteria: Criterion[]     // { condition: string, measurable: boolean, validationGate: 'auto'|'manual' }
  ambiguityFlags: Ambiguity[]      // { aspect: string, question: string, resolved: boolean }
  confidence: number               // 0-1, how well the engine understood the intent
  priority: GoalPriority
  metadata: Record<string, Json>
}
```

**Decision Points** (delegated to Decision Engine):
- Is the intent clear enough to proceed? (confidence threshold)
- Should clarifying questions be asked before proceeding?
- Should the goal be split into sub-goals?

**Integration**:
- Feeds `StructuredGoal` into Producer's existing `GoalRequest` flow
- The Producer uses `StructuredGoal.constraints` and `StructuredGoal.successCriteria` to enrich its `GoalAnalysis`
- Uses Model Provider (any provider) for intent classification
- Stores ambiguity resolutions in Memory for future pattern matching

**Why not existing Producer?**
The existing Producer receives a `GoalRequest` with title, description, and constraints. It does deterministic domain heuristics analysis. The Goal Engine adds the **understanding** layer: ambiguity detection, intent classification, success criteria definition, confidence scoring. These are fundamentally different concerns.

---

### 4.2 Mission Planner

**Package**: `@gamedev-agent/mission-planner` (new)

**Purpose**: Convert an approved goal into a phased, prioritized, dependency-mapped mission plan with an explicit task graph, before the existing Planner produces the execution plan.

**Responsibilities**:
- Decompose goal into logical phases (foundation, core, polish, etc.)
- Prioritize tasks within and across phases
- Estimate dependencies between tasks (technical, data, capability)
- Produce a directed task graph with topological ordering
- Assign risk scores to each phase and task
- Estimate required capabilities per task

**Input**: `StructuredGoal` (from Goal Engine) + `MissionProposal` (from existing Producer)

**Output**: `PhasedMissionPlan`

```
PhasedMissionPlan {
  id: PlanId
  goalId: GoalId
  phases: Phase[]                  // { id, title, order, objectives[], risk, estimatedEffort }
  taskGraph: TaskGraph             // tasks[] + edges[] (dependency DAG)
  priorities: PriorityAssignment[] // { taskId, priority, rationale }
  capabilityEstimates: CapabilityMap  // { taskId: Capability[] }
  riskProfile: RiskAssessment      // { overall, perPhase[], perTask[] }
  alternatives: ConsideredAlternative[]  // other decompositions considered and why rejected
}
```

**Decision Points** (delegated to Decision Engine):
- How to decompose the goal into phases?
- How to order tasks within phases?
- What is the optimal task granularity?
- Should any tasks be parallelized?

**Integration**:
- Output consumed by existing Coordinator (creates Missions from phases)
- Phases map to Mission nodes in the existing MissionTree
- Task graph feeds into existing Planner's `ExecutionPlan.steps`
- Stores alternatives considered in Decision Log (for Learning Engine)
- Uses Model Provider for decomposition reasoning
- Deterministic topological sort for dependency ordering

**Why not existing Planner?**
The existing Planner converts a validated Mission Proposal into an `ExecutionPlan` using strategies (DependencyGraphStrategy, SequentialPlanningStrategy). The Mission Planner operates at a **higher level**: it decides the phase decomposition, the task granularity, and the overall strategy before the lower-level Planner produces concrete execution steps. The Mission Planner answers "what should we build and in what order?"; the existing Planner answers "how do we execute each task?"

---

### 4.3 Reasoning Engine

**Package**: `@gamedev-agent/reasoning-engine` (new)

**Purpose**: Before every execution step, decide the *how*: which approach, which model, which tools, which memories, which context — based on the specific task and current state.

**Responsibilities**:
- Select optimal approach/strategy for the task (build vs. compose, from scratch vs. template, etc.)
- Select the best model provider and model for the specific work (from ModelRegistry)
- Select which tools to make available (from ToolManager capabilities)
- Determine which memory tiers and categories to query (from MemoryTier)
- Determine context collection strategy (which providers, depth, budget)
- Record reasoning trace for explainability

**Input**: Current task/step + ExecutionContext from Workflow

**Output**: `ReasoningPlan`

```
ReasoningPlan {
  stepId: StepId
  approach: {
    strategy: string              // 'generate' | 'modify' | 'compose' | 'research' | 'fix'
    rationale: string             // why this approach over alternatives
    alternatives: ConsideredApproach[]
  }
  modelSelection: {
    provider: string              // 'openai' | 'anthropic' | 'gemini' | 'deepseek' | etc.
    model: string                 // specific model id
    rationale: string
    fallback: string[]            // ordered fallback models
    capabilities: string[]        // required model capabilities
  }
  toolSelection: {
    enabled: ToolCapability[]
    disabled: ToolCapability[]    // explicitly excluded
    rationale: string
  }
  memoryStrategy: {
    tiers: MemoryTier[]
    categories: MemoryCategory[]
    maxResults: number
    minConfidence: MemoryConfidence
  }
  contextStrategy: {
    priority: ContextPurpose
    maxTokens: number
    requiredProviders: string[]   // which ContextProviders to include
    excludedProviders: string[]
    compressionLevel: 'lossless' | 'balanced' | 'aggressive'
  }
  confidence: number
  created: Timestamp
}
```

**Decision Points** (delegated to Decision Engine):
- Which approach best fits this task?
- Which model has the right capabilities at acceptable cost?
- Which tools are necessary vs. noise?
- How much context is needed vs. budget?

**Integration**:
- `ReasoningPlan.modelSelection` feeds into ContextAssembler's model selection
- `ReasoningPlan.toolSelection` filters the action registry in ToolBridge
- `ReasoningPlan.contextStrategy` configures the Context Pipeline (purpose, providers, budget)
- `ReasoningPlan.memoryStrategy` guides memory pre-loading in Context Pipeline
- `ReasoningPlan.approach` is recorded in ExecutionStep metadata
- Entire plan stored in Decision Log for Observability and Learning Engine
- Uses Model Registry and ToolManager for capability queries (no AI inference for this)
- Deterministic rules for fallback chain; AI inference for approach selection

---

### 4.4 Context Engine v2

**Package**: Extends `@gamedev-agent/context` (existing)

**Purpose**: Extend the existing Context Pipeline with intelligence-specific providers, compression, and noise reduction, so the model receives exactly the context it needs and nothing it doesn't.

**New Context Providers** (add to existing 13 providers):

| Provider | Source | Purpose |
|----------|--------|---------|
| `ProjectMemoryProvider` | Memory (project tier) | Past decisions, architectures, patterns from this project |
| `PreviousMissionProvider` | Memory (feature tier) | Similar missions, what worked, what failed |
| `ArchitectureDecisionProvider` | Memory (decision tier) | ADRs, architecture constraints, dependency rules |
| `KnowledgeGraphProvider` | Knowledge Graph | Related components, files, systems, relationships |
| `LearningProvider` | Memory (pattern tier) | Learned patterns, past recommendations, pitfalls |
| `AlternativeProvider` | Mission Planner | Approaches considered and rejected, with rationale |
| `RecoveryProvider` | Recovery Engine | Active failure context, retry history, diagnostic state |

**New Pipeline Stages** (insert into existing 6-stage pipeline):

| Stage | Position | Purpose |
|-------|----------|---------|
| `NoiseFilter` | After Deduplicator | Remove context items below relevance threshold; filter out noisy file content |
| `RelevanceScorer` | After Ranker | Re-score by mission-specific relevance (not just global weights) |
| `NoiseFilter` | After Compressor | Remove compressed items that lost essential meaning |
| `ExplainabilityInjector` | Before output | Inject reasoning traces, decision rationale, and confidence into a non-model-consumed section |

**Pipeline Flow** (extended):

```
Resolver → Builder → Deduplicator → NoiseFilter → Ranker → RelevanceScorer
→ TokenBudget → Compressor → NoiseFilter (post) → ExplainabilityInjector
```

**New Policies** (add to existing AgentRole policies):

| Policy | Agent Role | Max Tokens | Noise Threshold | Required Providers |
|--------|-----------|------------|-----------------|-------------------|
| `LEARNER_POLICY` | learning-engine | 32000 | 0.3 | All intelligence providers |
| `RECOVERY_POLICY` | recovery-engine | 64000 | 0.2 | Recovery, Memory, Project |
| `REASONING_POLICY` | reasoning-engine | 16000 | 0.5 | Architecture, Memory, Knowledge |
| `PLANNER_POLICY` | mission-planner | 32000 | 0.4 | ProjectMemory, PreviousMission, Knowledge |

**Integration**:
- New providers register at `ContextProviderRegistry` (existing mechanism)
- New stages implement the existing `ContextProvider` or pipeline stage interfaces
- `NoiseFilter` uses configurable threshold from ReasoningEngine.contextStrategy.compressionLevel
- `ExplainabilityInjector` produces `ContextExplainability` artifact attached to `ContextPackage`
- All providers respect existing token budgeting and caching

---

### 4.5 Executor

**Package**: `@gamedev-agent/executor` (new — wraps existing `execution-engine`)

**Purpose**: Add pre-execution validation, structured observation, step-by-step verification, and intentional continuation logic around the existing Execution Engine.

**Responsibilities**:
- Validate preconditions before executing a step (are dependencies met? state correct?)
- Execute one step at a time through the existing Execution Engine
- Observe each tool call result as it comes in (not just at step end)
- Verify intermediate and final outputs against success criteria
- Decide whether to continue, retry, or stop after each observation
- Publish detailed execution traces

**Input**: `ExecutionContext` + `ReasoningPlan` + `AssembledContext`

**Output**: `ExecutionResult`

```
ExecutionResult {
  stepId: StepId
  status: 'success' | 'failed' | 'partial' | 'cancelled'
  rounds: ExecutionRound[]         // each tool-call round
  validationResults: Validation[]  // { check: string, passed: boolean, detail: string }
  artifacts: Artifact[]            // files changed, outputs produced
  summary: string
  metrics: {
    totalLatencyMs: number
    toolCalls: number
    tokensUsed: TokenUsage
    retries: number
  }
  error: ExecutionError | null
}
```

**Execution Round** (inner loop):
```
1. Validate preconditions                    (if fail → Recovery)
2. Assemble context via Context Engine v2    (if fail → Recovery)
3. Dispatch to model via AgentDispatcher     (if fail → Recovery)
4. For each tool call in response:
   4a. Pre-invoke validation                 (if fail → skip/retry)
   4b. Invoke tool via ToolBridge            (if fail → Recovery)
   4c. Post-invoke observation (Observer)    (if unexpected → flag)
5. Check verification criteria
6. If more rounds needed → go to 2
7. Finalize
```

**Decision Points** (delegated to Decision Engine, evaluated after each round):
- Is the output correct? Continue to next step or redo?
- Are we stuck in a loop? Break out?
- Should we try a different approach? Escalate?
- Is partial progress acceptable? Mark as partial and continue?

**Integration**:
- Wraps existing `ExecutionEngine.executeStep()` as the core dispatch mechanism
- Adds validation hooks before and after the existing execution flow
- Observer integration is via events (not tight coupling)
- Publishes `round.*` events for each tool call cycle (existing events: `execution.tool-invoked`, `execution.tool-result`)
- Recovery Engine subscribes to `execution.step-failed` and `round.*` events

---

### 4.6 Observer

**Package**: `@gamedev-agent/observer` (new — cross-cutting event subscriber)

**Purpose**: Continuously observe every tool call, model response, and execution event, updating mission state and triggering appropriate subsystems.

**Responsibilities**:
- Subscribe to all `execution.*`, `tool.*`, `model.*`, and `round.*` events
- Classify each observation (success, failure, warning, unexpected, info)
- Update mission progress and state
- Feed observations to Recovery Engine (on failure)
- Feed observations to Learning Engine (for pattern collection)
- Maintain real-time execution trace

**Input**: Event Bus events (typed)

**Output**: Classified observations + state updates

```
Observation {
  id: ObservationId
  type: 'tool_invocation' | 'model_response' | 'validation' | 'state_change'
  timestamp: Timestamp
  correlationId: CorrelationId    // links to mission, step, round
  classification: 'success' | 'failure' | 'warning' | 'unexpected' | 'info'
  payload: Json                   // the raw event payload
  diagnosis: string | null        // populated on failure/warning
  action: 'continue' | 'retry' | 'escalate' | 'stop' | 'log'
}
```

**Observation Rules** (deterministic classifiers):

| Event Pattern | Classification | Action |
|--------------|---------------|--------|
| `tool-invocation` → `ok: true` | success | continue |
| `tool-invocation` → `ok: false` | failure | escalate to Recovery |
| `tool-result` → unexpected output shape | warning | log + flag |
| `tool-result` → unexpected side effect | warning | escalate to Decision |
| `model.response` → finishReason = 'error' | failure | escalate to Recovery |
| `model.response` → finishReason = 'length' | warning | continue (reduce context) |
| `model.response` → finishReason = 'content_filter' | failure | escalate to Recovery |
| `validation` → failed | failure | escalate to Recovery |
| `state-change` → unexpected | warning | log + flag |

**Integration**:
- No direct dependencies on other subsystems (pure event-driven)
- Published `observation.*` events consumed by Recovery Engine, Learning Engine, and UI
- Maintains `ObservationRing` (bounded circular buffer, last N observations per mission)
- Ring is persisted to Memory for post-mission analysis

---

### 4.7 Recovery Engine

**Package**: `@gamedev-agent/recovery-engine` (new)

**Purpose**: When something fails, analyze the failure, diagnose root cause, choose a recovery strategy, and execute it. Never immediately fail — always attempt recovery first.

**Responsibilities**:
- Receive failure observations from Observer
- Analyze failure context (what failed, when, what state were we in)
- Diagnose probable root cause (tool error, model error, context error, state error, external error)
- Select recovery strategy from available options
- Execute recovery (retry, fallback, alternative approach, reduce scope)
- Escalate to human if recovery is not possible or high-risk
- Record failure diagnosis and recovery for Learning Engine

**Input**: `Observation` with classification `failure` + current `ExecutionContext`

**Output**: `RecoveryPlan`

```
FailureDiagnosis {
  observationId: ObservationId
  symptoms: string[]               // what we observed going wrong
  probableCauses: Cause[]          // { cause, confidence, evidence }
  rootCause: Cause | null          // diagnosed root cause
  severity: 'transient' | 'recoverable' | 'fatal'
}

RecoveryPlan {
  diagnosis: FailureDiagnosis
  strategy: 'retry' | 'fallback_model' | 'fallback_tool' | 'reduce_scope'
         | 'alternative_approach' | 'skip_step' | 'escalate'
  steps: RecoveryStep[]            // ordered recovery actions
  condition: string                // what must be true for recovery to be attempted
  estimatedSuccessProbability: number
  maxRetries: number
  recorded: boolean                // whether this was stored for learning
}
```

**Recovery Strategies** (ordered by preference):

| Strategy | When | What |
|----------|------|------|
| `retry` | Transient failure | Re-execute the same step with same plan (max 3) |
| `fallback_model` | Model capability/quality failure | Re-execute with next model in ReasoningPlan.fallback |
| `fallback_tool` | Tool unavailable | Re-execute using alternative tool with same capability |
| `reduce_scope` | Context or complexity failure | Re-plan with smaller scope, execute simpler version |
| `alternative_approach` | Approach fundamentally wrong | Re-enter Reasoning Engine with failure context |
| `skip_step` | Non-critical step fails | Mark step as skipped, continue mission |
| `escalate` | Fatal or high-risk | Halt, present diagnosis to human |

**Decision Points** (delegated to Decision Engine):
- Is this failure transient or permanent?
- Should we retry or switch strategies immediately?
- Is the recovery high-risk? Should we ask human first?
- After multiple recoveries: escalate or try something else?

**Integration**:
- Subscribes to `observation.classification: 'failure'` events
- Can trigger re-execution through Executor (retry, fallback)
- Can trigger re-reasoning through Reasoning Engine (alternative approach)
- Can trigger re-planning through Mission Planner (reduce scope)
- Records all recovery attempts in `Strategy.retryCount` and `DecisionLog`
- Publishes `recovery.*` events for observability

---

### 4.8 Learning Engine

**Package**: `@gamedev-agent/learning-engine` (new)

**Purpose**: Every completed mission (success or failure) becomes structured experience. Nova should get better over time without retraining the LLM — by accumulating, indexing, and retrieving past mission patterns.

**Responsibilities**:
- Consolidate complete mission artifacts after mission ends
- Extract patterns: what worked, what failed, what was surprising
- Produce structured learning records with recommendations
- Store learning records in Memory (pattern tier)
- Prune low-confidence or outdated patterns
- Serve pattern retrieval for Mission Planner and Reasoning Engine

**Input**: Complete mission artifact bundle (Goal, Plan, Reasoning, Execution, Observations, Recovery, Outcome)

**Output**: `LearningRecord` (stored in Memory)

```
LearningRecord {
  id: RecordId
  missionId: MissionId
  type: 'success' | 'failure' | 'partial' | 'insight'
  summary: string                  // one-line lesson
  pattern: {
    goalIntents: string[]          // similar goal intents this applies to
    constraints: string[]          // relevant constraints
    contextSignals: string[]       // what was true about the environment
  }
  approach: {
    used: string                   // the approach that was taken
    alternatives: string[]         // alternatives that were considered
    recommendation: string         // what future missions should do
  }
  errors: FailurePattern[]         // { error, rootCause, recovery, preventativeMeasure }
  effectiveness: number            // 0-1, how well did this work
  applicability: string[]          // conditions under which this pattern applies
  provenance: {
    goalId: GoalId
    planId: PlanId
    reasoningId: ReasoningPlanId
    executionId: ExecutionId
    recordedAt: Timestamp
  }
}
```

**Learning Consolidation Pipeline**:
```
1. Collect all mission artifacts (Goal Engine → Execution Result)
2. Classify outcome type (success / failure / partial / insight)
3. Extract success patterns (what worked, why)
4. Extract failure patterns (what failed, why, recovery used)
5. Generate recommendation (what future missions should do)
6. Score effectiveness (objective: success rate, retries, time)
7. Store in Memory (tier: pattern, category: execution)
8. Update Knowledge Graph relationships (component → pattern)
9. Prune: demote low-confidence or outdated patterns
```

**Integration**:
- Triggered by mission completion/failure events from Coordinator
- Reads mission artifacts from Memory (stored by Execution Engine's MemoryRecorder)
- Stores learning records in Memory (pattern tier, execution category)
- Learning Engine does NOT use AI inference — it's a deterministic pattern extractor
- The "intelligence" comes from structured consolidation, not model-generated lessons
- Serves retrieval to Mission Planner (what similar missions did) and Reasoning Engine (what approach worked before)

---

### 4.9 Knowledge Graph

**Package**: `@gamedev-agent/knowledge-graph` (new)

**Purpose**: Structured, queryable graph of project entities and their relationships — beyond what flat vector search can provide. Nova should reason about *connections*, not just *similarity*.

**Responsibilities**:
- Maintain entity catalog (projects, files, components, systems, architectures, modules, classes, functions, assets, decisions)
- Define and store relationship types (depends-on, contains, implements, extends, configures, violates, documents)
- Support graph traversal queries (what depends on X? what does Y contain? what architecture rule applies to Z?)
- Auto-extract entities and relationships from project structure and execution observations
- Integrate with Context Pipeline to provide relationship context

**Entity Model**:

```
GraphEntity {
  id: EntityId
  type: 'project' | 'file' | 'component' | 'system' | 'module' | 'class'
      | 'function' | 'interface' | 'asset' | 'decision' | 'architecture_rule'
  name: string
  qualifiedName: string            // fully qualified (e.g., 'packages/context/src/ContextPipeline.ts')
  metadata: Record<string, Json>   // language, framework, size, complexity, etc.
  tags: string[]
  firstSeen: Timestamp
  lastModified: Timestamp
}

GraphRelationship {
  id: RelationshipId
  sourceId: EntityId
  targetId: EntityId
  type: 'depends_on' | 'contains' | 'implements' | 'extends' | 'configures'
      | 'violates' | 'documents' | 'related_to' | 'sibling_of'
      | 'required_by' | 'called_by' | 'imported_by'
  weight: number                   // 0-1 strength of relationship
  metadata: Record<string, Json>
  firstSeen: Timestamp
}
```

**Query Capabilities**:

| Query | Example |
|-------|---------|
| Direct dependencies | "What does module X depend on?" |
| Reverse dependencies | "What depends on component Y?" |
| Path traversal | "What is the dependency path from A to B?" |
| Impact analysis | "If I change file X, what else is affected?" |
| Architecture validation | "Does module X violate any architecture rule?" |
| Relationship discovery | "What entities are related to feature Z?" |

**Integration**:
- Entity extraction hooks into: FileSystemProvider (file structure), BuildProvider (import analysis), GitProvider (change tracking)
- Relationship extraction: static analysis (imports, extends, implements), dynamic observation (tool calls that modify files), explicit recording (architectural decisions)
- Context Pipeline has a `KnowledgeGraphProvider` that enriches context with relationship data
- Learning Engine records entity → pattern relationships
- Recovery Engine uses impact analysis to assess recovery risk
- Memory stores the graph data (nodes and edges as separate memory entries)
- Query API exposed to all intelligence subsystems

**Why not vector search?**
Vector search answers "what is semantically similar?" The Knowledge Graph answers "what is connected, how, and why?" Both are needed. Vector search for recall; Knowledge Graph for reasoning.

---

### 4.10 Decision Engine

**Package**: `@gamedev-agent/decision-engine` (new — cross-cutting)

**Purpose**: The central decision-making component consulted at every branching point in the intelligence pipeline. It determines *what to do next* based on current state, confidence, risk, and learned patterns.

**Decision Points** (where Decision Engine is consulted):

| Decision Point | Context | Possible Actions |
|---------------|---------|-----------------|
| Goal Engine → Producer | Intent confidence < threshold | ask_clarifying_question | proceed | split_goal |
| Mission Planner → Coordinator | Risk > threshold | flag_for_review | replan | proceed |
| Reasoning Engine → Execute | Approach confidence < threshold | try_alternative | escalate | proceed |
| Executor → Tool Round | Validation failed | retry | skip | escalate |
| Executor → Next Step | Output partially correct | continue | retry_step | partial_accept |
| Recovery Engine → Action | Failure diagnosis complete | retry | fallback | escalate | stop |
| Observer → Flag | Unexpected observation | log | investigate | escalate |
| Learning Engine → Store | Pattern effectiveness low | store | discard | store_with_caveat |

**Input**: Decision request with context

**Output**: Decision

```
DecisionRequest {
  point: DecisionPoint
  context: {
    missionId?: MissionId
    stepId?: StepId
    currentState: string           // machine-readable state
    availableActions: Action[]     // { id, description, risk, confidence }
    constraints: Constraint[]      // applicable constraints
    learnedPatterns: LearningRecord[]  // relevant past patterns
  }
}

Decision {
  requestId: RequestId
  chosenAction: string
  rationale: string
  confidence: number
  alternativesRejected: { action: string, reason: string }[]
  provenance: {
    consultedPatterns: LearningRecord[]
    consultedRules: string[]
    timestamp: Timestamp
  }
}
```

**Decision Logic** (layered, deterministic-first):

```
Layer 1: Hard Rules (deterministic, always applies)
  - If state is terminal → stop
  - If max retries exceeded → escalate
  - If action is destructive and no approval → ask human
  - If precondition not met → cannot execute

Layer 2: Policy Rules (configurable, project-specific)
  - If risk > project.riskThreshold → require approval
  - If confidence < project.confidenceThreshold → ask clarification
  - If mission priority is critical → use best model regardless of cost

Layer 3: Learned Patterns (from Learning Engine)
  - If similar situation had successful pattern X → prefer X
  - If similar situation had failed pattern Y → avoid Y
  - If pattern effectiveness > threshold → follow recommendation

Layer 4: AI Reasoning (fallback, only when layers 1-3 insufficient)
  - Use model provider with structured output
  - Present options with rationale
  - Record model decision
```

**Integration**:
- Exposed as a service consumed by all other intelligence subsystems
- Each subsystem sends `DecisionRequest` and receives `Decision`
- Decisions are always recorded in the mission's Decision Log
- Decision Engine has no AI dependency for Layers 1-2 (deterministic)
- Layer 4 (AI Reasoning) uses Model Providers through the standard gateway
- Learning Engine records decision outcomes to improve future decisions

---

## 5. Data Flow

### 5.1 Full Mission Flow

```
User: "Create a browser racing game"

    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ GOAL ENGINE                                                       │
│                                                                    │
│  Intent: feature                                                   │
│  Constraints: browser-based, real-time, multiplayer?               │
│  Ambiguity: "racing game" is broad → generate clarifying questions │
│  Success: playable prototype with physics, tracks, AI opponents    │
│                                                                    │
│  Output: StructuredGoal                                            │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ PRODUCER (existing)                                                │
│                                                                    │
│  Receives StructuredGoal → produces GoalAnalysis + MissionTree     │
│  Objectives: vehicle physics, track system, AI opponents, UI/HUD   │
│  Milestones: prototype → alpha → beta → polish                     │
│  MissionTree: 6 proposed missions with dependencies                │
│                                                                    │
│  Output: MissionProposal + ApprovalPackage                         │
└──────────────────────────────────────────────────────────────────┘
    │  (Creative Director approves)
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ MISSION PLANNER                                                    │
│                                                                    │
│  Phase 1: Foundation (project setup, engine config, build system)  │
│  Phase 2: Vehicle Physics (movement, collision, input handling)    │
│  Phase 3: Track System (track loading, rendering, obstacles)       │
│  Phase 4: AI Opponents (pathfinding, difficulty scaling)           │
│  Phase 5: UI/HUD (speed, position, menus)                          │
│  Phase 6: Polish (visual effects, audio, performance)              │
│                                                                    │
│  Task Graph: 24 tasks with dependencies                            │
│  Risk: AI Opponents highest risk → flag for review                │
│                                                                    │
│  Output: PhasedMissionPlan                                         │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ COORDINATOR + PLANNER + WORKFLOW (existing)                        │
│                                                                    │
│  Create missions per phase, plan execution steps, order workflow   │
│  Output: ExecutionPlan (step sequence)                             │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ REASONING ENGINE (per step)                                        │
│                                                                    │
│  Step: "Implement vehicle physics"                                 │
│  Approach: generate (build from scratch with Three.js)             │
│  Model: claude-sonnet (best for 3D code)                           │
│  Fallback: gpt-4o → deepseek-coder                                 │
│  Tools: filesystem (create/edit), terminal (npm install)           │
│  Context: project structure, existing Three.js config, physics     │
│           patterns from Memory, Knowledge Graph for deps           │
│  Compression: balanced                                             │
│                                                                    │
│  Output: ReasoningPlan                                             │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ CONTEXT ENGINE v2                                                  │
│                                                                    │
│  Context Pipeline (extended):                                      │
│  Resolver → Builder → Deduplicator → NoiseFilter → Ranker →       │
│  RelevanceScorer → TokenBudget → Compressor → ExplainabilityInject│
│                                                                    │
│  Output: AssembledContext (for model)                              │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ EXECUTOR                                                           │
│                                                                    │
│  Round 1:                                                          │
│  ├── Validate preconditions ✓                                      │
│  ├── Dispatch model → receives code generation                     │
│  ├── Tool call 1: create physics.ts                                │
│  │   ├── Observer: success ✓                                       │
│  │   └── Validation: file created, contains class skeleton ✓      │
│  ├── Tool call 2: write update loop                                │
│  │   ├── Observer: warning ⚠ (missing import)                     │
│  │   └── Decision Engine: proceed (minor issue)                    │
│  └── Tool call 3: npm install three                                │
│      ├── Observer: failure ✗ (network error)                      │
│      └── → Recovery Engine                                         │
│                                                                    │
│  Round 2 (after recovery):                                         │
│  ├── Retry npm install (fallback: yarn) ✓                          │
│  ├── Continue...                                                   │
│  └── All validations pass → step complete                          │
│                                                                    │
│  Output: ExecutionResult                                           │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│ LEARNING ENGINE (post-mission)                                     │
│                                                                    │
│  Consolidate:                                                      │
│  - Goal: racing game vehicle physics                               │
│  - Plan: Single file approach vs. module approach                  │
│  - Approach: Three.js + cannon-es (physics engine)                 │
│  - Error: npm network → use yarn fallback                          │
│  - Recovery: retry with alternative package manager                │
│  - Outcome: success (8 rounds, 2 retries)                          │
│  - Recommendation: For Three.js projects, pre-install dependencies │
│                    in setup phase to avoid network issues           │
│                                                                    │
│  Output: LearningRecord (stored in Memory, pattern tier)           │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Event Flow (cross-subsystem communication)

```
Goal Engine         → publishes  goal.* events
Mission Planner     → publishes  mission-plan.* events
Reasoning Engine    → publishes  reasoning.* events
Context Engine v2   → publishes  context.* events
Executor            → publishes  execution.* events  (reuses existing)
Observer            → publishes  observation.* events
Recovery Engine     → publishes  recovery.* events
Learning Engine     → publishes  learning.* events
Decision Engine     → publishes  decision.* events
Knowledge Graph     → publishes  knowledge-graph.* events

All subsystems      → subscribe to events they need
                    → read state from Memory (not direct coupling)
```

---

## 6. Interfaces

### 6.1 GoalEngine

```
interface GoalEngine {
  analyze(input: RawUserInput, context: CurrentContext): Promise<StructuredGoal>
  detectAmbiguity(goal: StructuredGoal): Promise<Ambiguity[]>
  clarify(goal: StructuredGoal, answers: ClarificationAnswers): Promise<StructuredGoal>
  validateSuccessCriteria(goal: StructuredGoal): Promise<ValidationReport>
}

interface StructuredGoal {
  id: GoalId
  intent: IntentClassification
  description: string
  constraints: Constraint[]
  successCriteria: Criterion[]
  ambiguityFlags: Ambiguity[]
  confidence: number
  priority: GoalPriority
  metadata: Record<string, Json>
}
```

### 6.2 MissionPlanner

```
interface MissionPlanner {
  plan(goal: StructuredGoal, proposal: MissionProposal): Promise<PhasedMissionPlan>
  rePlan(plan: PhasedMissionPlan, failureContext: FailureContext): Promise<PhasedMissionPlan>
  estimateRisk(plan: PhasedMissionPlan): Promise<RiskAssessment>
}

interface PhasedMissionPlan {
  id: PlanId
  goalId: GoalId
  phases: Phase[]
  taskGraph: TaskGraph
  priorities: PriorityAssignment[]
  capabilityEstimates: CapabilityMap
  riskProfile: RiskAssessment
  alternatives: ConsideredAlternative[]
}
```

### 6.3 ReasoningEngine

```
interface ReasoningEngine {
  reason(step: ExecutionStep, context: ExecutionContext): Promise<ReasoningPlan>
  selectModel(requirements: ModelRequirements, registry: ModelRegistry): Promise<ModelSelection>
  selectTools(requirements: ToolRequirements, registry: ToolRegistry): Promise<ToolSelection>
  determineContextStrategy(step: ExecutionStep, plan: ReasoningPlan): Promise<ContextStrategy>
}

interface ReasoningPlan {
  stepId: StepId
  approach: ApproachSelection
  modelSelection: ModelSelection
  toolSelection: ToolSelection
  memoryStrategy: MemoryStrategy
  contextStrategy: ContextStrategy
  confidence: number
  created: Timestamp
}
```

### 6.4 ContextEngineV2

```
interface ContextEngineV2 {
  assemble(request: ContextRequest): Promise<AssembledContext>
}

// Extends existing ContextPipeline with:
interface NoiseFilter {
  filter(items: ContextItem[], threshold: number): ContextItem[]
}
interface RelevanceScorer {
  score(items: ContextItem[], mission: PhasedMissionPlan, reasoning: ReasoningPlan): ContextItem[]
}
interface ExplainabilityInjector {
  inject(package: ContextPackage, reasoning: ReasoningPlan): ContextExplainability
}
```

### 6.5 Executor

```
interface Executor {
  executeStep(step: ExecutionStep, plan: ReasoningPlan, context: AssembledContext): Promise<ExecutionResult>
  validate(snapshot: ExecutionSnapshot, criteria: Criterion[]): Promise<ValidationResult[]>
  continue(result: PartialResult, plan: ReasoningPlan): Promise<NextAction>
}

interface ExecutionResult {
  stepId: StepId
  status: 'success' | 'failed' | 'partial' | 'cancelled'
  rounds: ExecutionRound[]
  validationResults: Validation[]
  artifacts: Artifact[]
  summary: string
  metrics: ExecutionMetrics
  error: ExecutionError | null
}
```

### 6.6 Observer

```
interface Observer {
  observe(event: DomainEvent): Promise<Observation>
  getMissionTrace(missionId: MissionId): Promise<Observation[]>
  getLastObservations(missionId: MissionId, n: number): Promise<Observation[]>
}

interface Observation {
  id: ObservationId
  type: ObservationType
  timestamp: Timestamp
  correlationId: CorrelationId
  classification: 'success' | 'failure' | 'warning' | 'unexpected' | 'info'
  payload: Json
  diagnosis: string | null
  action: 'continue' | 'retry' | 'escalate' | 'stop' | 'log'
}
```

### 6.7 RecoveryEngine

```
interface RecoveryEngine {
  diagnose(observation: Observation, context: ExecutionContext): Promise<FailureDiagnosis>
  plan(diagnosis: FailureDiagnosis, reasoning: ReasoningPlan): Promise<RecoveryPlan>
  execute(plan: RecoveryPlan): Promise<RecoveryResult>
}

interface RecoveryPlan {
  diagnosis: FailureDiagnosis
  strategy: RecoveryStrategy
  steps: RecoveryStep[]
  condition: string
  estimatedSuccessProbability: number
  maxRetries: number
}

type RecoveryStrategy = 'retry' | 'fallback_model' | 'fallback_tool'
                     | 'reduce_scope' | 'alternative_approach' | 'skip_step' | 'escalate'
```

### 6.8 LearningEngine

```
interface LearningEngine {
  consolidate(mission: CompleteMission): Promise<LearningRecord>
  findSimilar(goal: StructuredGoal, constraints: Constraint[]): Promise<LearningRecord[]>
  getRecommendation(task: ExecutionStep, context: ExecutionContext): Promise<Recommendation | null>
  prune(threshold: number): Promise<number>  // returns count pruned
}

interface LearningRecord {
  id: RecordId
  missionId: MissionId
  type: 'success' | 'failure' | 'partial' | 'insight'
  summary: string
  pattern: PatternSignature
  approach: ApproachRecord
  errors: FailurePattern[]
  effectiveness: number
  applicability: string[]
  provenance: LearningProvenance
}
```

### 6.9 KnowledgeGraph

```
interface KnowledgeGraph {
  registerEntity(entity: GraphEntityInput): Promise<GraphEntity>
  registerRelationship(relationship: RelationshipInput): Promise<GraphRelationship>
  getEntity(id: EntityId): Promise<GraphEntity | null>
  getRelationships(entityId: EntityId, type?: string): Promise<GraphRelationship[]>
  traverse(start: EntityId, query: TraversalQuery): Promise<TraversalResult>
  findImpact(changedEntity: EntityId): Promise<ImpactAnalysis>
  search(query: GraphQuery): Promise<SearchResult[]>
}
```

### 6.10 DecisionEngine

```
interface DecisionEngine {
  decide(request: DecisionRequest): Promise<Decision>
  getHistory(missionId: MissionId): Promise<Decision[]>
}

interface DecisionRequest {
  point: DecisionPoint
  context: DecisionContext
}

interface Decision {
  requestId: RequestId
  chosenAction: string
  rationale: string
  confidence: number
  alternativesRejected: RejectedAlternative[]
  provenance: DecisionProvenance
}
```

---

## 7. Integration Map

### 7.1 New Packages

| Package | Depends On | Depended On By |
|---------|-----------|----------------|
| `goal-engine` | model-providers, context, memory, decision-engine | producer (consumer) |
| `mission-planner` | memory, context, knowledge-graph, decision-engine | coordinator, planner |
| `reasoning-engine` | model-providers, tool-runtime, memory, context, knowledge-graph, decision-engine | executor |
| `context-engine-v2` | context (existing), knowledge-graph, memory, mission-planner | executor |
| `executor` | execution-engine (existing), context-engine-v2, observer, decision-engine | workflow (existing) |
| `observer` | events (existing), memory | executor, recovery-engine, learning-engine |
| `recovery-engine` | memory, reasoning-engine, decision-engine, observer | executor |
| `learning-engine` | memory, knowledge-graph | mission-planner, reasoning-engine |
| `knowledge-graph` | memory, runtime (existing) | context-engine-v2, mission-planner, reasoning-engine, learning-engine |
| `decision-engine` | model-providers, memory, learning-engine | all other intelligence packages |

### 7.2 Existing Package Modifications

| Package | Modification |
|---------|-------------|
| `context` | Accept new context providers and pipeline stage plugins (already extensible) |
| `execution-engine` | No changes (Executor wraps it) |
| `producer` | Accept `StructuredGoal` as input alongside `GoalRequest` |
| `coordinator` | Accept `PhasedMissionPlan` phases as Mission inputs |
| `planner` | Accept task graph from Mission Planner as input to `ExecutionPlan` |
| `memory` | No changes (existing entries, tiers, and categories sufficient) |

### 7.3 Event Contracts (new events)

```
// Goal Engine
goal.analyzed             { goalId, intent, confidence, ambiguityCount }
goal.clarification_needed { goalId, questions[] }

// Mission Planner
mission-plan.created      { planId, goalId, phaseCount, taskCount, risk }
mission-plan.alternatives { planId, alternatives[] }

// Reasoning Engine
reasoning.started         { stepId, approach, model, toolCount }
reasoning.completed       { stepId, confidence, contextStrategy }

// Context Engine v2
context.noise_filtered    { removedCount, threshold }
context.relevance_scored  { itemsScored, topItems[] }

// Executor
execution.round_complete  { stepId, round, toolCalls, validation }
execution.step_validated  { stepId, check, passed, detail }

// Observer
observation.recorded      { missionId, type, classification, action }
observation.flags.raised  { missionId, flags[] }

// Recovery Engine
recovery.diagnosed        { missionId, stepId, rootCause, severity }
recovery.planned          { missionId, strategy, probability }
recovery.executed         { missionId, strategy, success, retryCount }
recovery.escalated        { missionId, reason, diagnosis }

// Learning Engine
learning.record_created   { recordId, type, pattern, effectiveness }
learning.recommendation   { recordId, forStep, recommendation }

// Knowledge Graph
knowledge-graph.entity_registered   { entityId, type, name }
knowledge-graph.relationship_added  { sourceId, targetId, type, weight }

// Decision Engine
decision.made             { decisionId, point, action, confidence }
decision.rationale        { decisionId, rationale, alternatives[] }
```

---

## 8. Mission Lifecycle

Complete lifecycle of a mission through the Intelligence Layer.

```
1. RECEIVE
   └─ User submits request
   └─ Goal Engine analyzes → StructuredGoal
   └─ Decision: proceed? ask clarification? split?

2. PROPOSE
   └─ Producer transforms → MissionProposal
   └─ Creative Director reviews + approves

3. PLAN
   └─ Mission Planner → PhasedMissionPlan
   └─ Coordinator creates Missions per phase
   └─ Planner → ExecutionPlan
   └─ Workflow → ordered steps

4. REASON (per step)
   └─ Reasoning Engine → ReasoningPlan
   └─ Model selected, tools chosen, context strategy defined

5. CONTEXTUALIZE
   └─ Context Engine v2 → AssembledContext
   └─ Noise filtered, relevance scored, explainability injected

6. EXECUTE (per step, may loop)
   └─ Executor validates preconditions
   └─ Dispatch model → receives response
   └─ For each tool call:
       ├─ Invoke tool
       ├─ Observer classifies result
       ├─ Success → continue
       └─ Failure → Recovery
   └─ Verify output against success criteria
   └─ All rounds complete → step done

7. RECOVER (on failure, may loop)
   └─ Observer detects failure → Recovery Engine
   └─ Diagnose root cause
   └─ Select strategy:
       ├─ Retry → back to Execute
       ├─ Fallback model → back to Reason
       ├─ Reduce scope → back to Plan
       ├─ Alternative approach → back to Reason
       ├─ Skip step → continue to next step
       └─ Escalate → wait for human

8. COMPLETE
   └─ All steps complete
   └─ Final verification
   └─ Learning Engine consolidates → LearningRecord
   └─ Mission state: completed

9. FAIL
   └─ Unrecoverable failure
   └─ Recovery Engine escalates (final)
   └─ Learning Engine consolidates failure → LearningRecord
   └─ Mission state: failed

10. LEARN
    └─ Learning Engine stores record in Memory (pattern tier)
    └─ Knowledge Graph updated with entity relationships
    └─ Future missions benefit from accumulated experience
```

---

## 9. Failure Lifecycle

Detailed failure handling from detection to resolution.

```
1. DETECTION
   └─ Trigger: Observer receives event with classification 'failure'
   └─ Sources: tool invocation error, model error, validation failure, state corruption
   └─ Information captured:
       ├─ What failed (event payload)
       ├─ When (timestamp)
       ├─ Where (step, round, tool)
       └─ State at failure (context snapshot)

2. TRIAGE
   └─ Observer classifies severity:
       ├─ 'transient': network blip, timeout, rate limit
       ├─ 'recoverable': tool returned unexpected but usable result
       └─ 'fatal': invariant broken, state corrupted, permission denied
   └─ Observer publishes observation.failure event

3. DIAGNOSIS (Recovery Engine)
   └─ Analyze failure context:
       ├─ What was the expected output?
       ├─ What was the actual output?
       ├─ What changed between success and failure?
       └─ Are there similar failures in mission history?
   └─ Identify probable root causes:
       ├─ Model error (hallucination, wrong format)
       ├─ Tool error (file not found, command failed)
       ├─ Context error (missing information, wrong assumptions)
       ├─ State error (precondition not met, race condition)
       └─ External error (network, filesystem, permissions)
   └─ Select most likely root cause + confidence

4. STRATEGY SELECTION (Recovery Engine + Decision Engine)
   └─ Decision Engine evaluates options:
       ├─ Retry (transient failures, max 3 retries)
       ├─ Fallback model (model quality failures)
       ├─ Fallback tool (tool availability failures)
       ├─ Reduce scope (context complexity failures)
       ├─ Alternative approach (approach fundamentally wrong)
       ├─ Skip step (non-critical step failures)
       └─ Escalate (fatal failures, max retries exceeded)
   └─ Decision recorded with rationale

5. EXECUTION
   ├─ Retry: same plan, same tools, re-execute
   ├─ Fallback: new ReasoningPlan with different model/tool → re-execute
   ├─ Reduce scope: new PhasedMissionPlan with smaller scope → re-plan → re-execute
   ├─ Alternative: new ReasoningPlan with different approach → re-execute
   ├─ Skip: mark step as skipped, continue mission
   └─ Escalate: present diagnosis to human, wait for input

6. VERIFICATION
   └─ Did recovery succeed?
       ├─ Yes → continue mission from recovered state
       └─ No → back to diagnosis with accumulated retry count
   └─ If retry count > maxRetries → escalate (even if not fatal)

7. RECORD
   └─ Recovery Engine publishes recovery.* events
   └─ Failure context stored in Memory (feature tier)
   └─ Learning Engine includes failure in post-mission consolidation
   └─ Knowledge Graph updated: entity → failure pattern relationship

---

## 10. Learning Lifecycle

How Nova gets better over time.

```
1. TRIGGER
   └─ Mission completes (success, failure, partial)
   └─ Or: Insight detected during execution (unexpected success, surprising pattern)

2. COLLECT
   └─ Gather all mission artifacts:
       ├─ StructuredGoal (from Goal Engine)
       ├─ PhasedMissionPlan (from Mission Planner)
       ├─ ReasoningPlans (from Reasoning Engine, one per step)
       ├─ ContextExplainability (from Context Engine v2)
       ├─ ExecutionResults (from Executor, one per step)
       ├─ Observations (from Observer, all events)
       ├─ RecoveryPlans (from Recovery Engine, if any)
       └─ Final outcome (success/failure/partial + metrics)

3. CLASSIFY
   └─ Outcome type: success | failure | partial | insight
   └─ Pattern signature: {
         intent, constraints, project type, complexity,
         model used, tools used, error types (if any)
       }
   └─ Effectiveness score: 0-1 (speed, retries, quality, verification pass rate)

4. EXTRACT
   └─ Success patterns:
       ├─ What approach worked?
       ├─ What model was effective for this type of work?
       ├─ What context was most relevant?
       └─ What was faster than expected?
   └─ Failure patterns:
       ├─ What went wrong?
       ├─ What was the root cause?
       ├─ What recovery worked?
       └─ What should have been done differently?
   └─ Recommendations:
       ├─ For similar goals: use X approach
       ├─ For similar tasks: include Y context
       ├─ For similar errors: try Z recovery first

5. STORE
   └─ Create LearningRecord
   └─ Store in Memory:
       ├─ Tier: pattern
       ├─ Category: execution
       ├─ Tags: [intent, approach, model, error-type, outcome]
       └─ Provenance: full chain back to mission
   └─ Update Knowledge Graph:
       ├─ Entity → pattern relationship
       ├─ This pattern is relevant to these components
       └─ This pattern is an alternative to these approaches

6. INDEX
   └─ Pattern signatures indexed for fast retrieval
   └─ Applicability conditions indexed (when does this pattern apply?)
   └─ Cross-reference: similar patterns grouped, contradictions flagged
   └─ Pruning candidates: patterns with low effectiveness or low confidence

7. SERVE
   └─ Mission Planner queries: "What patterns apply to this goal?"
   └─ Reasoning Engine queries: "What approach worked for similar tasks?"
   └─ Recovery Engine queries: "What recovery worked for this error?"
   └─ Decision Engine queries: "What decisions had good outcomes in similar situations?"

8. PRUNE
   └─ Periodic maintenance:
       ├─ Demote patterns with effectiveness < threshold
       ├─ Remove patterns with confidence = 'low' and age > TTL
       ├─ Merge duplicate patterns
       └─ Flag contradictory patterns for human review
```

---

## 11. Future Expansion Points

### 11.1 Multi-Mission Orchestration

When multiple missions run concurrently, a new `Orchestrator` component would sit above the Mission Planner, managing:
- Resource allocation across missions (which model is available for which mission)
- Priority scheduling (high-priority missions preempt low-priority)
- Cross-mission dependency resolution (mission A depends on mission B's output)
- Global context sharing (learnings from one mission benefit another in-flight)

**Expansion interface**: Mission Planner already produces a `PhasedMissionPlan` with priorities and dependencies — the Orchestrator would consume these and schedule accordingly.

### 11.2 Human-in-the-Loop Refinement

The Decision Engine's Layer 2 (Policy Rules) can be extended with user-configurable policies per project:
- "Always ask before deleting files"
- "Auto-approve low-risk refactoring"
- "Use only GPT-4 for architecture decisions"

**Expansion interface**: `DecisionEngine.decide()` already accepts constraints — user-facing policy configuration would feed into these constraints.

### 11.3 Collaborative Multi-Agent Execution

The Executor could dispatch sub-tasks to specialized agents (architect, engineer, QA):
- Reasoning Engine produces separate reasoning plans per agent
- Executor coordinates agent handoff
- Observer monitors each agent independently
- Recovery Engine handles per-agent failures

**Expansion interface**: Executor already executes one step at a time — a step could reference a sub-mission with its own lifecycle.

### 11.4 Knowledge Graph Auto-Extraction

The Knowledge Graph currently relies on explicit registration and runtime observation. Future:
- Static analysis pass on project files (imports, types, class hierarchies)
- Architecture rule extraction from code patterns
- Automatic dependency graph generation from build system
- Change impact prediction using graph topology

**Expansion interface**: Knowledge Graph's `registerEntity` and `registerRelationship` are idempotent — any analysis tool can feed into them.

### 11.5 Learning Engine Federation

For multi-project studios, learning patterns could be shared across projects (with permission):
- Global patterns (works for all projects of this type)
- Project-specific patterns (only relevant to this project)
- Cross-project recommendations ("Project X solved this same problem using approach Y")

**Expansion interface**: Learning records already have `applicability` conditions — federation would add a `scope` field (global | studio | project).

### 11.6 Predictive Recovery

The Recovery Engine could, given enough learned patterns, predict failures before they happen:
- If previous similar steps had pattern X failure → pre-emptively adjust
- If confidence of success < threshold → add validation gates before execution
- If tool is known to have issues with this type of input → prepare fallback

**Expansion interface**: Recovery Engine already has access to Learning Records and can query for patterns matching the current step.

### 11.7 Performance Optimization Layer

A layer that monitors execution metrics and optimizes:
- Model selection tuning (which model is actually fastest for which task)
- Context budget tuning (how much context actually needed)
- Tool selection tuning (which tools add value vs. noise)
- Retry threshold tuning (when is retry ineffective)

**Expansion interface**: All tuning parameters are already configurable in ReasoningPlan — an optimizer would produce better default values from observed metrics.

### 11.8 Plugin Intelligence

Plugins could contribute their own:
- Goal patterns (the plugin understands what "create a new scene" means for its engine)
- Reasoning advice ("for Unity physics, use model X")
- Context providers (the plugin knows what files are relevant)
- Recovery strategies ("for Godot import errors, try reimport")
- Learning patterns (engine-specific best practices)

**Expansion interface**: All intelligence subsystems accept plugin-contributed strategies and providers through the existing plugin/capability system.

---

## Appendix: Mapping to Existing Subsystems

| Intelligence Component | Existing Counterpart | Relationship |
|------------------------|---------------------|--------------|
| Goal Engine | Producer (GoalRequest) | Feeds structured goals INTO Producer |
| Mission Planner | Planner (ExecutionPlan) | Higher-level decomposition feeding INTO Planner |
| Reasoning Engine | ContextAssembler (model selection) | Extends model selection with full reasoning |
| Context Engine v2 | Context Pipeline | Extends with new providers + stages |
| Executor | Execution Engine | Wraps with validation + observation |
| Observer | Event Bus (raw events) | Adds classification + action layer |
| Recovery Engine | Middleware (RetryHandler) | Full diagnosis + multi-strategy recovery |
| Learning Engine | Memory (execution storage) | Adds pattern extraction + recommendation |
| Knowledge Graph | Memory (flat storage) | Adds structured relationships + traversal |
| Decision Engine | Director (strategy) | Generalizes to all decision points |

---

*Nova Intelligence Architecture v1 — July 2026*
