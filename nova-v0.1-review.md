# Nova v0.1: Principal Engineering Review

> Review of `nova-v0.1-spec.md` — determining whether this is the correct first implementation.

---

## Executive Summary

The spec is **70% correct** but has four specific problems that would create unnecessary maintenance burden:

1. **Observer and Recovery are over-engineered abstractions.** Each is a 10-line pure function. Making them classes with constructors, interfaces, and dedicated data types is Java-style ceremony that v0.1 doesn't need.

2. **GoalParser depends on an LLM call** to parse "Create a Three.js project." A deterministic keyword matcher handles this more reliably, more quickly, and with zero external dependencies.

3. **MissionController has constructor injection with 5 dependencies** but only actually calls 2 of them (Executor + EventBus). GoalParser and Planner are called once before the loop. Observer and Recovery should be inline. This is premature DI complexity.

4. **Too many intermediate data types.** `Observation`, `ObservationStatus`, `RecoveryAction`, `RecoveryActionType` exist solely to pass data between Observer → Recovery → MissionController. If those two are inline, these types vanish.

The corrected v0.1 should be **4 files, ~250 lines, zero external LLM dependency**.

---

## 1. Component-by-Component Review

### 1.1 GoalParser

**Verdict: Keep, but replace LLM with keyword matching.**

The spec calls for `ModelProvidersService.generate()` with `responseFormat: 'json_object'`. For v0.1's single mission, this is the wrong choice:

- The LLM call adds 2-5 seconds of latency to the parse step
- The LLM can return invalid JSON, requiring error handling
- The LLM has a non-zero failure rate (rate limits, network errors, content filters)
- The LLM may hallucinate values (framework: 'three.js', language: 'javascript' — misspelled)
- The LLM requires a dependency on `@gamedev-agent/model-providers` with all its transitive deps

For a pattern as simple as "Create a Three.js + TypeScript + Vite project," a 10-line keyword matcher is more reliable, faster, and testable without mocks:

```
map framework: three.js, three
map language: typescript, ts
map bundler: vite
default project name from message or use "nova-project"
throw UnsupportedGoalError if no known framework found
```

This is deterministic, instant, and handles all reasonable variations of the v0.1 mission.

**The LLM GoalParser belongs in v0.2**, when Nova supports multiple mission types and needs real natural language understanding. For v0.1, it's premature optimization and an unnecessary failure point.

### 1.2 Planner

**Verdict: Keep as-is.**

This is the most solid component in the spec. Pure function, deterministic, testable without mocks. The 7-step task list is correct. The template files are appropriately inline (not separate config files). The dependency graph between tasks is correct (step-0 before step-1, etc.).

One minor suggestion: remove the `retryOnce` field from the `Task` type. Not all tasks need to declare this per-instance — it should be a single configuration value on the MissionController. For v0.1, ALL tasks get exactly one retry, or none. Per-task retry configuration is v0.2 work.

### 1.3 Executor

**Verdict: Keep, with minor simplification.**

The Executor is the only component that should perform IO, and this boundary is correctly drawn. However:

- The `ExecutorOptions` class with constructor injection is unnecessary for a 15-line wrapper. Export a function.
- The `logs` field on `TaskResult` is speculative — `ToolInvocationResult.output` contains the output, and there's no structured log capture in v0.1's tool runtime. Remove the field until there's actually log data to populate it.
- The `artifacts` field on `TaskResult` is also speculative — for v0.1, no tool returns artifact lists. Remove until tool runtime supports it.

### 1.4 Observer

**Verdict: Merge into MissionController.**

The Observer is 15 lines of code:

```
if (result.success) { success }
else { diagnosis = result.error ?? 'Unknown failure' }
```

This is a private method on MissionController, not a separate file. The `Observation` and `ObservationStatus` types disappear. The `buildDiagnosis` function is 5 lines inline.

### 1.5 Recovery

**Verdict: Merge into MissionController.**

The Recovery is 10 lines of code:

```
if (attempt >= maxRetries) stop
if (!task.retryOnce) stop
else retry
```

This is inline logic in the task loop. The `RecoveryAction` type disappears. The recovery loop becomes:

```
for each task:
  for attempt = 1 to maxRetries:
    result = execute(task)
    if result.success: break
    if attempt < maxRetries: continue (retry)
    else: fail mission
```

No separate Recovery component. No intermediate data types. Three lines of loop logic.

### 1.6 MissionController

**Verdict: Keep, but simplify to a function.**

The current spec has MissionController accepting 5 injected dependencies in a constructor. In practice:

- `GoalParser` is called once before the loop
- `Planner` is called once before the loop
- `Executor` is the only real dependency during the loop
- `Observer` and `Recovery` should be inline
- `EventBus` is called 6 times

For v0.1, MissionController should be a function that takes exactly what it needs:

```typescript
async function runMission(
  message: string,
  toolManager: ToolManager,
  eventBus?: EventBusContract,
): Promise<MissionResult>
```

Internally, it creates the GoalParser and Planner (they're stateless). This eliminates the DI boilerplate while keeping the components separable for testing.

### 1.7 Types

**Verdict: Remove 4 types, keep 4 types.**

Current types:
- `StructuredGoal` — KEEP
- `TaskAction` — KEEP (but simplify to just `string`)
- `Task`, `TaskId` — KEEP
- `TaskResult` — KEEP (remove `logs` and `artifacts` for v0.1)
- `ObservationStatus`, `Observation` — REMOVE (Observer inlined)
- `RecoveryActionType`, `RecoveryAction` — REMOVE (Recovery inlined)
- `MissionStatus`, `MissionResult` — KEEP
- `ParseError`, `UnsupportedGoalError` — KEEP

---

## 2. Five Specific Questions Answered

### 2.1 Should nova-v0.1 be a new package?

**Yes**, but only 4 source files (not 7).

A new package is correct because:
- It doesn't modify existing, stable packages
- It's clearly temporary (v0.1 is not the final architecture)
- It depends on existing packages (`tool-runtime`, `events`, `shared`, `logging`)
- It can be deleted or refactored in v0.2 without touching the core

The only alternative would be adding files to `packages/intelligence/`, but that package has a different abstraction level (agent registry, task engine, planning engine). v0.1's components are simpler and more specific.

### 2.2 Should the existing execution-engine be reused?

**No.**

The `ExecutionEngine` is designed for an AI-driven tool-call loop:
```
ContextAssembler → AgentDispatcher (model call) → ToolBridge (tool calls) → repeat
```

v0.1's execution pattern is:
```
for each task in deterministic plan:
  toolManager.invoke(task.params)
```

These are fundamentally different patterns. Using the execution engine would require:
- Disabling ContextAssembler (no context needed)
- Disabling AgentDispatcher (no AI dispatch needed)
- Disabling the tool-call loop (no model-generated tool calls)
- Disabling MemoryRecorder (no memory in v0.1)
- Configuring 4+ sub-systems to do nothing

The overhead of configuring the execution engine for v0.1 is greater than writing 15 lines of direct `ToolManager.invoke()` calls. The spec correctly chose the latter.

### 2.3 Is the GoalParser in the correct place?

**Yes, but it shouldn't call an LLM.**

The separation of goal parsing from mission execution is correct — parsing is a different concern with different error paths. But the LLM dependency is wrong for v0.1. A keyword matcher produces the same result more reliably.

### 2.4 Is the Planner correctly isolated?

**Yes.** Pure function, no dependencies, trivially testable. This is the cleanest component in the spec.

### 2.5 Is MissionController responsible for too much?

**No — it's responsible for the right things, but has too much constructor ceremony.**

MissionController should be responsible for the entire mission lifecycle. That's correct. But accepting 5 constructor dependencies when it only needs 2 (ToolManager, EventBus) is over-engineered. The GoalParser and Planner can be created internally.

---

## 3. Remaining Component Assessment

| Component | Verdict | Reason |
|-----------|---------|--------|
| **GoalParser** | KEEP | Separate concern, different error handling. Replace LLM with keyword matching. |
| **Planner** | KEEP | Pure function, testable, isolated. Best component in the spec. |
| **Executor** | KEEP | The only IO boundary. Export as function, not class. Remove speculative fields. |
| **Observer** | MERGE | 15 lines of if-else. Should be a private method in MissionController. |
| **Recovery** | MERGE | 10 lines of retry logic. Should be inline in the task loop. |
| **MissionController** | KEEP | Orchestrator is necessary. Simplify to function, not class with DI. |
| **Types** | TRIM | Remove 4 types (Observation, ObservationStatus, RecoveryAction, RecoveryActionType). Keep the rest. |
| **Events** | DELAY | 6 events for v0.1's single mission are speculative. Publish 0 events in v0.1. Add when there's something subscribing. |

---

## 4. Final v0.1 Package Structure

```
packages/nova-v0.1/
├── package.json
│   dependencies:
│     @gamedev-agent/tool-runtime  (for ToolManager.invoke)
│     @gamedev-agent/events        (optional, for future subscribers)
│     @gamedev-agent/shared        (for Json, Timestamp types)
│     @gamedev-agent/logging        (for console output)
│
├── tsconfig.json
│
└── src/
    ├── types.ts           # StructuredGoal, Task, TaskResult, MissionResult, errors
    ├── goal-parser.ts     # parse(message): StructuredGoal (keyword matching)
    ├── planner.ts         # createPlan(goal): Task[] (deterministic 7-step plan)
    ├── executor.ts        # execute(task, toolManager): TaskResult
    ├── mission.ts         # runMission(message, toolManager): MissionResult
    └── index.ts           # public API
```

**5 source files. ~250 lines total.**

**Zero LLM calls. Zero events. Zero intermediate data types.**

---

## 5. Dependency Graph

```
mission.ts
  ├── goal-parser.ts        (no deps)
  ├── planner.ts            (depends: types.ts)
  ├── executor.ts           (depends: types.ts)
  │   └── ToolManager       (existing: @gamedev-agent/tool-runtime)
  └── EventBusContract      (existing: @gamedev-agent/events) [optional]

index.ts → mission.ts

No circular dependencies. No transitive dependency chains.
Everything that touches the external world goes through executor.ts → ToolManager.
```

---

## 6. Build Order

| Step | File | Time | Testable? |
|------|------|------|-----------|
| 1 | `types.ts` | 10 min | Compiles |
| 2 | `planner.ts` | 20 min | Unit test |
| 3 | `executor.ts` | 30 min | Integration test (real ToolManager) |
| 4 | `goal-parser.ts` | 20 min | Unit test (no mocks needed) |
| 5 | `mission.ts` | 30 min | Integration test (real ToolManager) |
| 6 | `index.ts` | 10 min | CLI smoke test |

**Total: ~2 hours of coding (not 7).**

---

## 7. Test Order

| Order | File | Type | Why This Order |
|-------|------|------|----------------|
| 1 | `planner.test.ts` | Unit | Fastest feedback. Pure function. No mocks. |
| 2 | `goal-parser.test.ts` | Unit | Pure function. No mocks. Tests keyword patterns. |
| 3 | `executor.test.ts` | Integration | Real ToolManager. Tests that tools actually work. |
| 4 | `mission.test.ts` | Integration | Full flow. Tests everything together. |

**The first test passes within 30 minutes of starting.**

---

## 8. Integration Order

| Step | What | Verifies |
|------|------|----------|
| 1 | `executor.execute(createDirTask, toolManager)` | ToolManager can create directories |
| 2 | `executor.execute(writeFileTask, toolManager)` | ToolManager can write files |
| 3 | `executor.execute(runTask, toolManager)` | ToolManager can run terminal commands |
| 4 | Full 7-step mission via `mission.runMission()` | End-to-end flow works |
| 5 | Mission with broken task | Retry logic works |

**Step 1 is the most critical. If directory creation doesn't work, nothing works.**

---

## 9. First Executable Demo

```
node packages/nova-v0.1/dist/index.js "Create a Three.js project"
```

Expected behavior:
1. Parse goal → `{ framework: 'three.js', language: 'typescript', bundler: 'vite' }`
2. Create 7 tasks
3. Execute each sequentially, printing progress:
   ```
   [1/7] Create project directory...
   [2/7] Initialize Vite project...
   ...
   [7/7] Verify build...
   ```
4. Print result:
   ```
   ✓ Mission complete (26.3s)
     Location: ./threejs-project/
     Files: 12 created
   ```

Or, on failure:
   ```
   ✗ Mission failed at step 3 (Install Three.js)
     Error: npm install three exited with code 1
     npm ERR! Could not resolve dependency
   ```

The executable can be a simple Node.js script. No framework. No CLI framework. Just `process.argv[2]` → `runMission()` → `console.log()`.

---

## 10. What Changed From the Original Spec

| Aspect | Original Spec | Corrected |
|--------|--------------|-----------|
| Source files | 7 | 5 |
| Estimated lines | ~400 | ~250 |
| Estimated time | 7 hours | 2 hours |
| LLM dependency | `model-providers` for GoalParser | None (keyword matching) |
| Events published | 6 | 0 |
| Classes with constructor DI | 5 (GoalParser, Planner, Executor, Observer, Recovery, MissionController) | 0 (all functions) |
| Intermediate types | 8 (incl. Observation, RecoveryAction) | 4 (just the domain types) |
| Separate Observer/Recovery files | 2 files | Inlined in mission.ts |
| ToolManager dependency | Only Executor | Executor + MissionController |
| `Task.retryOnce` per-task field | Yes | No (single config value) |
| `TaskResult.logs` + `TaskResult.artifacts` | Yes | No (speculative, removed) |

---

## 11. What v0.1 Actually Ships

After this review, v0.1 is:

> A script that creates a Three.js + TypeScript + Vite project by calling the existing Tool Runtime.
>
> It parses a natural language request using keyword matching, generates a deterministic 7-step plan, executes each step through `ToolManager.invoke()`, retries each step once on failure, and reports completion or failure.

That's it. No AI inference. No events. No learning. No context assembly. No state machine. No plugin system.

And that's exactly what a first implementation should be: the smallest thing that works.

---

## 12. What To Build Tomorrow Morning

**1. `packages/nova-v0.1/src/types.ts`** — All domain types. 10 minutes.

**2. `packages/nova-v0.1/src/planner.ts` + `planner.test.ts`** — Pure function, 7-step plan. 30 minutes.

**3. `packages/nova-v0.1/src/executor.ts`** — Integration test against real ToolManager. 45 minutes.
   - This is the riskiest component. If `ToolManager.invoke()` works, everything works.
   - If it doesn't, you've learned something fundamental in the first 90 minutes.

By lunch on day 1, you have:
- All types defined
- The plan generates correctly
- Tool calls execute against real tools
- One integration test passing

That's a faster feedback cycle than the original spec's "end of day 2."
