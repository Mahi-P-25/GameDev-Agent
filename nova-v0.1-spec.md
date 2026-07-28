# Nova v0.1 — Implementation Specification

> First real mission: "Create a Three.js + TypeScript + Vite project"
>
> Every component described here maps directly to code.
> No architecture documents. No speculation. No over-engineering.

---

## 1. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MISSION CONTROLLER                               │
│  Coordinates: Parser → Planner → [Executor → Observer → Recovery]*   │
└──────┬────────────────────────────────────────────────────────┬──────┘
       │                                                        │
       ▼                                                        ▼
┌──────────────┐                                    ┌──────────────────┐
│  GoalParser  │                                    │  Observer        │
│  NL → Goal   │                                    │  Result → Status │
└──────┬───────┘                                    └────────┬─────────┘
       │                                                    │
       ▼                                                    ▼
┌──────────────┐                                    ┌──────────────────┐
│  Planner     │                                    │  Recovery        │
│  Goal → Plan │                                    │  Retry or Stop   │
└──────┬───────┘                                    └──────────────────┘
       │
       ▼
┌──────────────┐
│  Executor    │
│  Task → Result│
│  (one at a    │
│   time)      │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│  EXISTING: ToolManager.invoke()  │
│  Tool Runtime (files, terminal,  │
│  git)                            │
└──────────────────────────────────┘
```

No new packages. One new file per component. Total new code: ~400 lines.

---

## 2. Data Flow

```
User: "Create a new Three.js + TypeScript + Vite project"

    │
    ▼
┌────────────────────────────────────────────────┐
│ GoalParser.parse(message)                       │
│                                                 │
│  → Call LLM with structured output schema       │
│    "Extract: framework, language, bundler"      │
│                                                 │
│  → Returns StructuredGoal {                     │
│      framework: 'three.js',                     │
│      language: 'typescript',                    │
│      bundler: 'vite',                           │
│      projectName: 'my-threejs-project'          │
│    }                                            │
└────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────┐
│ Planner.createPlan(goal, workspace)              │
│                                                 │
│  → Generates ordered Task[]                     │
│    [0] prepare: create project directory        │
│    [1] init: npm create vite@latest             │
│    [2] deps: npm install three                  │
│    [3] config: write vite.config.ts             │
│    [4] entry: write src/main.ts                 │
│    [5] html: write index.html                   │
│    [6] verify: npm run build                    │
│                                                 │
│  → Each task has:                               │
│    { id, type, toolId, action, input,           │
│      timeoutMs, retryOnce }                     │
└────────────────────────────────────────────────┘
    │
    ▼  for each task in order:
    │
┌────────────────────────────────────────────────┐
│ Executor.execute(task)                          │
│                                                 │
│  → Builds ToolInvocationRequest                 │
│  → Calls toolManager.invoke(request)            │
│  → Measures duration                            │
│  → Returns TaskResult {                         │
│      success: boolean,                          │
│      output: Json,                              │
│      logs: string[],                            │
│      durationMs: number,                        │
│      artifacts: string[]                        │
│    }                                            │
└────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────┐
│ Observer.observe(task, result)                  │
│                                                 │
│  → Classifies: success / failure                │
│  → Extracts logs from output                    │
│  → Captures artifacts (file paths, etc.)        │
│  → Returns Observation {                        │
│      status: 'success' | 'failure',             │
│      diagnosis: string | null,                  │
│      artifacts: string[]                        │
│    }                                            │
└────────────────────────────────────────────────┘
    │
    ├── success ──→ continue to next task
    │
    └── failure ──→
         │
         ▼
    ┌────────────────────────────────────────┐
    │ Recovery.handle(task, observation)      │
    │                                        │
    │  → If retryOnce AND first attempt:     │
    │    return retry                        │
    │  → If already retried OR fatal:        │
    │    return stop                         │
    │                                        │
    │  → Returns RecoveryAction {            │
    │      action: 'retry' | 'stop',         │
    │      diagnosis: string                 │
    │    }                                   │
    └────────────────────────────────────────┘
         │
         ├── retry ──→ Executor.execute(task) again
         │
         └── stop ──→ MissionController reports failure

    │ (all tasks complete)
    ▼
┌────────────────────────────────────────────────┐
│ MissionController.report(missionResult)         │
│                                                 │
│  → Summary: 7/7 tasks succeeded                 │
│  → Artifacts: [project/package.json, ...]       │
│  → Duration: 45.2s                              │
│  → Errors: none                                 │
│  → Output to console / CLI / UI                 │
└────────────────────────────────────────────────┘
```

---

## 3. Event Flow

v0.1 uses the existing Event Bus for two events only:

```
Existing:                              New:
┌─────────────────────┐                ┌─────────────────────────┐
│ tool.invoked        │  (from         │ mission.started         │
│ tool.invocation-    │   existing     │ mission.task-started    │
│   succeeded         │   ToolManager) │ mission.task-completed  │
│ tool.invocation-    │                │ mission.task-failed     │
│   failed            │                │ mission.completed       │
│ tool.permission-    │                │ mission.failed          │
│   denied            │                └─────────────────────────┘
└─────────────────────┘
    │
    ▼  (Observer subscribes to these instead of creating new types)
```

The Observer does NOT create a new `observation.*` event namespace. It subscribes to existing `tool.invocation-succeeded` and `tool.invocation-failed` events.

**New events (4 total, added to existing event catalog):**

| Event | Payload | Publisher |
|-------|---------|-----------|
| `mission.started` | `{ goal, taskCount, timestamp }` | MissionController |
| `mission.task-started` | `{ missionId, taskId, action, timestamp }` | MissionController |
| `mission.task-completed` | `{ missionId, taskId, success, durationMs, artifacts }` | Executor |
| `mission.task-failed` | `{ missionId, taskId, error, attempt, timestamp }` | Observer |
| `mission.completed` | `{ missionId, summary, totalDurationMs, taskResults[] }` | MissionController |
| `mission.failed` | `{ missionId, failedTask, diagnosis, timestamp }` | MissionController |

Just 6 events. No `reasoning.*`, `planning.*`, `observer.*`, `recovery.*` namespaces. The observation and recovery logic is inline—no events needed for internal transitions.

---

## 4. Folder/Package Placement

v0.1 lives in a single new directory: `packages/nova-v0.1/`

```
packages/nova-v0.1/
├── package.json
├── tsconfig.json
└── src/
    ├── types.ts              # All shared types for v0.1
    ├── GoalParser.ts         # Parse NL → StructuredGoal
    ├── Planner.ts            # StructuredGoal → Task[]
    ├── Executor.ts           # Task → TaskResult
    ├── Observer.ts           # TaskResult → Observation
    ├── Recovery.ts           # Failure → Retry | Stop
    ├── MissionController.ts  # Orchestrator
    └── index.ts              # Public API (runMission)

tests/
└── packages/nova-v0.1/
    ├── GoalParser.test.ts
    ├── Planner.test.ts
    ├── Executor.test.ts      # INTEGRATION test — real tool calls
    ├── Observer.test.ts
    ├── Recovery.test.ts
    ├── MissionController.test.ts
    └── fixtures/
        └── expected-project/  # Known-good project output for comparison
```

**package.json dependencies:**

```json
{
  "name": "@gamedev-agent/nova-v0.1",
  "private": true,
  "dependencies": {
    "@gamedev-agent/tool-runtime": "workspace:*",
    "@gamedev-agent/runtime": "workspace:*",
    "@gamedev-agent/model-providers": "workspace:*",
    "@gamedev-agent/events": "workspace:*",
    "@gamedev-agent/shared": "workspace:*",
    "@gamedev-agent/logging": "workspace:*"
  }
}
```

**No new external dependencies.** Everything uses existing packages.

---

## 5. Interfaces

### types.ts

Every type has exactly one responsibility. No inheritance. No generics beyond what's necessary.

```typescript
// ─── Goal ─────────────────────────────────────────────────────────────

export interface StructuredGoal {
  readonly projectName: string;       // auto-generated from intent
  readonly framework: string;         // 'three.js'
  readonly language: string;          // 'typescript'
  readonly bundler: string;           // 'vite'
  readonly raw: string;               // original user message
  readonly confidence: number;        // 0-1 from LLM parsing
}

// ─── Plan ─────────────────────────────────────────────────────────────

export type TaskAction =
  | 'files.create'
  | 'files.write'
  | 'terminal.run'
  | 'terminal.run-long';    // longer timeout for npm install

export interface Task {
  readonly id: TaskId;                // 'step-0', 'step-1', etc.
  readonly label: string;             // "Create project directory"
  readonly toolId: string;            // tool-runtime tool id
  readonly action: TaskAction;        // action name
  readonly input: Record<string, unknown>;  // action params
  readonly timeoutMs: number;         // max execution time
  readonly retryOnce: boolean;        // auto-retry on failure
  readonly dependsOn: ReadonlyArray<TaskId>;  // task ids that must complete first
}

export type TaskId = string;

// ─── Execution ────────────────────────────────────────────────────────

export interface TaskResult {
  readonly taskId: TaskId;
  readonly success: boolean;
  readonly output: Record<string, unknown> | null;
  readonly logs: ReadonlyArray<string>;       // captured stdout/stderr
  readonly durationMs: number;
  readonly artifacts: ReadonlyArray<string>;   // files created/modified
  readonly error: string | null;
}

// ─── Observation ──────────────────────────────────────────────────────

export type ObservationStatus = 'success' | 'failure';

export interface Observation {
  readonly taskId: TaskId;
  readonly status: ObservationStatus;
  readonly diagnosis: string | null;   // human-readable explanation
  readonly artifacts: ReadonlyArray<string>;
  readonly attempt: number;
}

// ─── Recovery ─────────────────────────────────────────────────────────

export type RecoveryActionType = 'retry' | 'stop';

export interface RecoveryAction {
  readonly action: RecoveryActionType;
  readonly diagnosis: string;
}

// ─── Mission ──────────────────────────────────────────────────────────

export type MissionStatus = 'running' | 'completed' | 'failed';

export interface MissionResult {
  readonly status: MissionStatus;
  readonly goal: StructuredGoal;
  readonly taskResults: ReadonlyArray<TaskResult>;
  readonly totalDurationMs: number;
  readonly summary: string;
  readonly failedTask: Task | null;
  readonly failureDiagnosis: string | null;
}
```

### GoalParser.ts

```typescript
export interface GoalParserOptions {
  readonly modelService: ModelProvidersService;
  readonly logger?: Logger;
}

export class GoalParser {
  constructor(options: GoalParserOptions);

  async parse(message: string): Promise<StructuredGoal>;
}

// parse() implementation:
// 1. Calls model with structured output schema:
//    System: "Extract framework, language, and bundler from the user's 
//             request. Respond with JSON: { framework, language, bundler }"
//    User: message
// 2. Parses JSON response
// 3. Generates projectName from intent (slugify)
// 4. Returns StructuredGoal
//    If parsing fails: throw ParseError
//    If confidence < threshold: throw LowConfidenceError (v0.1: threshold=0.3)
```

Uses existing `ModelProvidersService.generate()` with `responseFormat: 'json_object'`.

### Planner.ts

```typescript
export class Planner {
  constructor();

  createPlan(goal: StructuredGoal): Task[];

  // createPlan() implementation:
  // 1. For the "Three.js + TypeScript + Vite" project:
  //    Returns these tasks in dependency order:
  //
  //    step-0: "Create project directory"
  //      toolId: 'nova.tool.filesystem'
  //      action: 'files.create'
  //      input: { path: goal.projectName, kind: 'directory' }
  //      timeoutMs: 5000
  //      retryOnce: true
  //      dependsOn: []
  //
  //    step-1: "Initialize Vite project"
  //      toolId: 'nova.tool.terminal'
  //      action: 'terminal.run'
  //      input: { command: 'npm', args: ['create', 'vite@latest',
  //               goal.projectName, '--', '--template', 'vanilla-ts'] }
  //      timeoutMs: 30000
  //      retryOnce: true
  //      dependsOn: ['step-0']
  //
  //    step-2: "Install Three.js"
  //      toolId: 'nova.tool.terminal'
  //      action: 'terminal.run'
  //      input: { command: 'npm', args: ['install', 'three'],
  //               cwd: goal.projectName }
  //      timeoutMs: 60000
  //      retryOnce: true
  //      dependsOn: ['step-1']
  //
  //    step-3: "Write Vite config"
  //      toolId: 'nova.tool.filesystem'
  //      action: 'files.write'
  //      input: { path: `${goal.projectName}/vite.config.ts`,
  //               content: viteConfigTemplate() }
  //      timeoutMs: 5000
  //      retryOnce: false
  //      dependsOn: ['step-1']
  //
  //    step-4: "Write entry file"
  //      toolId: 'nova.tool.filesystem'
  //      action: 'files.write'
  //      input: { path: `${goal.projectName}/src/main.ts`,
  //               content: mainTsTemplate() }
  //      timeoutMs: 5000
  //      retryOnce: false
  //      dependsOn: ['step-1']
  //
  //    step-5: "Write HTML entry"
  //      toolId: 'nova.tool.filesystem'
  //      action: 'files.write'
  //      input: { path: `${goal.projectName}/index.html`,
  //               content: htmlTemplate(goal.projectName) }
  //      timeoutMs: 5000
  //      retryOnce: false
  //      dependsOn: ['step-1']
  //
  //    step-6: "Verify build"
  //      toolId: 'nova.tool.terminal'
  //      action: 'terminal.run'
  //      input: { command: 'npm', args: ['run', 'build'],
  //               cwd: goal.projectName }
  //      timeoutMs: 30000
  //      retryOnce: true
  //      dependsOn: ['step-2', 'step-3', 'step-4', 'step-5']
}
```

The Plan is currently deterministic for this mission. In v0.2, the Planner will use the LLM to generate plans for any goal. For v0.1, the pattern is: match known patterns → produce known plans. Unknown patterns → throw UnsupportedGoalError.

### Executor.ts

```typescript
export interface ExecutorOptions {
  readonly toolManager: ToolManager;
  readonly logger?: Logger;
}

export class Executor {
  constructor(options: ExecutorOptions);

  async execute(task: Task): Promise<TaskResult>;
}

// execute() implementation:
// 1. Build ToolInvocationRequest:
//    { toolId: task.toolId,
//      action: task.action,
//      input: task.input,
//      actor: { kind: 'nova-v0.1', id: 'mission-controller' },
//      correlationId: generateUUID() }
// 2. Call toolManager.invoke(request)
// 3. Capture duration
// 4. Parse result:
//    If result.ok: TaskResult { success: true, output: result.output,
//      logs: extractLogs(result), durationMs, artifacts: extractArtifacts(task, result),
//      error: null }
//    If !result.ok: TaskResult { success: false, output: null,
//      logs: [result.error?.message ?? 'Unknown error'], durationMs,
//      artifacts: [], error: result.error?.message ?? 'Unknown error' }
// 5. Return TaskResult
```

The Executor does NOT handle retries. That's the Recovery's job. Single responsibility.

The Executor does NOT interpret results. That's the Observer's job. Single responsibility.

### Observer.ts

```typescript
export class Observer {
  constructor();

  observe(task: Task, result: TaskResult, attempt: number): Observation;

  // observe() implementation:
  // 1. If result.success:
  //    Classification: 'success'
  //    Diagnosis: null
  //    Artifacts: result.artifacts
  // 2. If !result.success:
  //    Classification: 'failure'
  //    Diagnosis: buildDiagnosis(task, result)
  //      - "Command failed with exit code N"
  //      - "File write failed: path"
  //      - "Unknown error: <message>"
  //    Artifacts: []
  // 3. Return Observation
}

function buildDiagnosis(task: Task, result: TaskResult): string {
  // Simple deterministic diagnosis:
  if (task.action === 'terminal.run' && result.error) {
    return `Command failed: ${result.error}`;
  }
  if (task.action === 'files.create' && result.error) {
    return `Could not create: ${result.error}`;
  }
  if (task.action === 'files.write' && result.error) {
    return `Could not write: ${result.error}`;
  }
  return result.error ?? 'Unknown failure';
}
```

No event subscription in v0.1. The Observer is called directly by the MissionController.

### Recovery.ts

```typescript
export class Recovery {
  readonly maxRetries: number;  // default: 1

  constructor(options?: { maxRetries?: number });

  handle(task: Task, observation: Observation): RecoveryAction;
}

// handle() implementation:
// 1. If observation.status === 'success':
//    return { action: 'continue', diagnosis: null }
//    (caller doesn't call Recovery on success, but handle it gracefully)
//
// 2. If observation.attempt >= this.maxRetries:
//    return { action: 'stop', diagnosis: observation.diagnosis }
//
// 3. If task.retryOnce === false:
//    return { action: 'stop', diagnosis: observation.diagnosis }
//
// 4. Otherwise:
//    return { action: 'retry', diagnosis: observation.diagnosis }
```

### MissionController.ts

```typescript
export interface MissionControllerOptions {
  readonly goalParser: GoalParser;
  readonly planner: Planner;
  readonly executor: Executor;
  readonly observer: Observer;
  readonly recovery: Recovery;
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
}

export class MissionController {
  constructor(options: MissionControllerOptions);

  async runMission(message: string): Promise<MissionResult>;
}

// runMission() implementation:
// 1. Publish 'mission.started'
//
// 2. goal = await GoalParser.parse(message)
//    If parse fails → publish 'mission.failed', return failure
//
// 3. tasks = Planner.createPlan(goal)
//
// 4. For each task in topological order:
//    a. Publish 'mission.task-started'
//    b. result = await Executor.execute(task)
//    c. observation = Observer.observe(task, result, attempt=1)
//    d. If observation.status === 'failure':
//       recoveryAction = Recovery.handle(task, observation)
//       If recoveryAction.action === 'retry':
//         result = await Executor.execute(task)  // retry
//         observation = Observer.observe(task, result, attempt=2)
//         If observation.status === 'failure':
//           Publish 'mission.task-failed'
//           Publish 'mission.failed'
//           Return failure
//       If recoveryAction.action === 'stop':
//         Publish 'mission.task-failed'
//         Publish 'mission.failed'
//         Return failure
//    e. Publish 'mission.task-completed'
//
// 5. Publish 'mission.completed'
// 6. Return success MissionResult
```

---

## 6. Mission Lifecycle

```
                         ┌─────────────┐
                         │  IDLE       │
                         └──────┬──────┘
                                │ receive mission
                                ▼
                     ┌─────────────────────┐
                     │  PARSING            │
                     │  GoalParser.parse() │
                     └──────────┬──────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
               success                  failure
                    │                       │
                    ▼                       ▼
           ┌────────────────┐    ┌────────────────────┐
           │  PLANNING      │    │  FAILED            │
           │  Planner.      │    │  "Could not        │
           │  createPlan()  │    │   understand goal" │
           └───────┬────────┘    └────────────────────┘
                   │
              success
                   │
                   ▼
           ┌────────────────┐
           │  EXECUTING     │
           │  (loop)        │
           │  ┌──────────┐  │
           │  │task N    │  │
           │  │Execute → │  │
           │  │Observe → │  │
           │  │Recover   │  │
           │  └────┬─────┘  │
           │       │        │
           │  ┌────┴─────┐  │
           │  │success   │  │
           │  │→ next    │  │
           │  │  task    │  │
           │  └──────────┘  │
           │                │
           │  ┌──────────┐  │
           │  │failure   │  │
           │  │→ retry?  │──┼── retry loop (max 1)
           │  │→ stop!   │  │
           │  └──────────┘  │
           └───────┬────────┘
                   │
          ┌────────┴────────┐
          │                 │
    all complete        any failed
          │                 │
          ▼                 ▼
  ┌─────────────┐  ┌─────────────────┐
  │  COMPLETED  │  │  FAILED         │
  │  Summary:   │  │  "Step X        │
  │  7/7 tasks  │  │   failed: ..."  │
  └─────────────┘  └─────────────────┘
```

---

## 7. Error Lifecycle

```
Error occurs during execution
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 1. ToolManager.invoke() returns result.ok = false    │
│    - OR throws unexpected exception                  │
│    - Executor catches exception, returns             │
│      TaskResult { success: false, error: msg }      │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 2. Observer.observe(task, result)                    │
│    - Returns Observation { status: 'failure',        │
│      diagnosis: "Command 'npm install three'         │
│                  failed with exit code 1" }          │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 3. Recovery.handle(task, observation)                │
│    - attempt=1, task.retryOnce=true → retry          │
│    OR: already retried → stop                        │
│    OR: task.retryOnce=false → stop                   │
│    → Returns RecoveryAction { action, diagnosis }    │
└──────────────────────────────────────────────────────┘
    │
    ├── retry ───────────┐
    │                     │
    │                     ▼
    │            ┌─────────────────────────────┐
    │            │ Executor.execute(task)      │
    │            │ (same task, same params)    │
    │            │ attempt=2                   │
    │            └─────────────────────────────┘
    │                     │
    │                success ──→ continue mission
    │                     │
    │                failure ──→ stop mission
    │
    └── stop ────────────┐
                         │
                         ▼
                ┌─────────────────────────────┐
                │ MissionController stops     │
                │ Publishes 'mission.failed'  │
                │ Returns MissionResult {     │
                │   status: 'failed',         │
                │   failedTask: task,         │
                │   failureDiagnosis: ...     │
                │ }                           │
                └─────────────────────────────┘
```

**Error types (in types.ts, thrown by GoalParser):**

```typescript
export class ParseError extends Error {
  readonly cause: 'llm-error' | 'invalid-response' | 'unsupported';
  readonly raw: string;
}

export class UnsupportedGoalError extends Error {
  readonly goal: StructuredGoal;
  readonly reason: string;
}
```

The Executor never throws. ToolManager.invoke() never throws for expected failures (it returns result.ok = false). The Observer never throws. The Recovery never throws. Only GoalParser can throw (if the LLM call fails or returns garbage).

This keeps error handling simple: either parsing fails (early exit) or execution fails (recovery handles it).

---

## 8. Sequence Diagram

```
User      MissionCtrl    GoalParser    Planner     Executor     Observer   Recovery   ToolManager  Tool
 │            │              │            │           │            │          │          │           │
 │  message   │              │            │           │            │          │          │           │
 │───────────>│              │            │           │            │          │          │           │
 │            │ parse(msg)   │            │           │            │          │          │           │
 │            │─────────────>│            │           │            │          │          │           │
 │            │              │──LLM──────>│           │            │          │          │(provider) │
 │            │              │<──JSON─────│           │            │          │          │           │
 │            │<──Goal───────│            │           │            │          │          │           │
 │            │              │            │           │            │          │          │           │
 │            │  plan(goal)  │            │           │            │          │          │           │
 │            │─────────────────────────>│           │            │          │          │           │
 │            │<────────Plan─────────────│           │            │          │          │           │
 │            │              │            │           │            │          │          │           │
 │            │  ─── loop over tasks ──────────────────────────────────────────────────────────────>│
 │            │              │            │           │            │          │          │           │
 │            │ exec(task-0) │            │           │            │          │          │           │
 │            │────────────────────────────────────>│            │          │          │           │
 │            │              │            │           │ invoke()   │          │          │           │
 │            │              │            │           │─────────────────────────────────────────>│  mkdir
 │            │              │            │           │<──result─────────────────────────────────│
 │            │              │            │           │            │          │          │           │
 │            │              │            │           │<──result────│          │          │           │
 │            │              │            │           │ observe()  │          │          │           │
 │            │              │            │           │────────────>│          │          │           │
 │            │              │            │           │   success   │          │          │           │
 │            │              │            │           │<──obs───────│          │          │           │
 │            │              │            │           │            │          │          │           │
 │            │              │            │           │  (success, no recovery needed)            │
 │            │              │            │           │            │          │          │           │
 │            │  ─── repeat for each task ───────────────────────────────────────────────────────>│
 │            │              │            │           │            │          │          │           │
 │            │ exec(task-6) │            │           │            │          │          │           │
 │            │────────────────────────────────────>│            │          │          │           │
 │            │              │            │           │ invoke()   │          │          │           │
 │            │              │            │           │─────────────────────────────────────────>│  build
 │            │              │            │           │<──result (ok=false)──────────────────────│
 │            │              │            │           │            │          │          │           │
 │            │              │            │           │ observe()  │          │          │           │
 │            │              │            │           │────────────>│          │          │           │
 │            │              │            │           │   failure   │          │          │           │
 │            │              │            │           │<──obs───────│          │          │           │
 │            │              │            │           │            │          │          │           │
 │            │              │            │           │  recover() │          │          │           │
 │            │              │            │           │──────────────────────>│          │           │
 │            │              │            │           │<──retry────│          │          │           │
 │            │              │            │           │            │          │          │           │
 │            │              │            │           │  invoke() (retry)     │          │           │
 │            │              │            │           │─────────────────────────────────────────>│  build
 │            │              │            │           │<──result (ok=true)───────────────────────│
 │            │              │            │           │            │          │          │           │
 │            │              │            │           │ observe()  │          │          │           │
 │            │              │            │           │────────────>│          │          │           │
 │            │              │            │           │   success   │          │          │           │
 │            │              │            │           │            │          │          │           │
 │            │  ─── end loop ────────────────────────────────────────────────────────────────────│
 │            │              │            │           │            │          │          │           │
 │            │<──completed──│            │           │            │          │          │           │
 │            │              │            │           │            │          │          │           │
 │  Result    │              │            │           │            │          │          │           │
 │<───────────│              │            │           │            │          │          │           │
```

---

## 9. Implementation Order

This order minimizes blocked time. Each step produces something testable.

| Order | What | Why First | Can Build On |
|-------|------|-----------|-------------|
| 1 | `types.ts` | All code depends on these types. 15 minutes. | Nothing |
| 2 | `Planner.ts` + test | Zero dependencies (pure function, no IO). 30 minutes. | types.ts |
| 3 | `Executor.ts` + test | Core capability — does anything actually work? Need real tool-runtime. First integration test. 2 hours. | types.ts, ToolManager |
| 4 | `Observer.ts` + test | Pure function, no IO. 20 minutes. | types.ts |
| 5 | `Recovery.ts` + test | Pure function, no IO. 15 minutes. | types.ts |
| 6 | `GoalParser.ts` + test | Needs LLM call. Tests can be mocked. 1 hour. | types.ts, ModelProvidersService |
| 7 | `MissionController.ts` + integration test | Wires everything together. 2 hours. | All of the above |
| 8 | CLI entry point | Runs the mission from command line. 30 minutes. | MissionController |

**Total: ~7 hours of coding.**

### Step 1: types.ts

File: `packages/nova-v0.1/src/types.ts`

Define all interfaces and error types from [Section 5](#5-interfaces). That's it. Test that the file compiles.

### Step 2: Planner.ts

File: `packages/nova-v0.1/src/Planner.ts`

Pure function. Given a `StructuredGoal`, return a `Task[]`. For v0.1, only supports the Three.js mission pattern.

**Test plan:**
- Given valid Three.js goal → returns 7 tasks in correct dependency order
- Given unknown framework → throws `UnsupportedGoalError`
- Dependency order validates: step-0 before step-1, step-1 before step-2, step-6 depends on step-2,3,4,5
- Each task has correct `toolId`, `action`, `input` shape

### Step 3: Executor.ts

File: `packages/nova-v0.1/src/Executor.ts`

Wraps `ToolManager.invoke()`. This is the riskiest component — it's the first integration with real tools.

**Test plan (integration):**
- Must run in a real environment (not jsdom)
- Create a temp directory
- Execute a files.create task → verify directory exists
- Execute a files.write task → verify file has correct content
- Execute a terminal.run task → verify exit code 0
- Execute a terminal.run with invalid command → verify TaskResult.success === false
- All tasks time out after configured duration

**Critical path**: If Executor doesn't work, nothing works. This is where most uncertainty lives. Build and test this first.

### Step 4: Observer.ts

File: `packages/nova-v0.1/src/Observer.ts`

Pure function. Given a Task + TaskResult, return an Observation.

**Test plan:**
- Given success result → status='success', diagnosis=null
- Given failure result with error → status='failure', diagnosis contains error
- Given terminal task failure → diagnosis mentions exit code
- Given filesystem task failure → diagnosis mentions path

### Step 5: Recovery.ts

File: `packages/nova-v0.1/src/Recovery.ts`

Pure function. Given a Task + Observation, return RecoveryAction.

**Test plan:**
- Given success observation → action=retry (no, actually this shouldn't happen; handle gracefully)
- Given failure, attempt=1, retryOnce=true → action=retry
- Given failure, attempt=1, retryOnce=false → action=stop
- Given failure, attempt=2, retryOnce=true → action=stop
- Diagnosis from observation is propagated

### Step 6: GoalParser.ts

File: `packages/nova-v0.1/src/GoalParser.ts`

Uses ModelProvidersService to parse natural language into StructuredGoal.

**Test plan:**
- Given "Create a Three.js + TypeScript + Vite project" → framework='three.js', language='typescript', bundler='vite'
- Given "Set up a new Vite project with Three.js and TS" → same result
- Given "Initialize a Three.js project" → framework='three.js', sensible defaults for language/bundler
- Given "Make a game in Godot" → throws UnsupportedGoalError (v0.1 doesn't support Godot)
- Given LLM returns invalid JSON → throws ParseError

### Step 7: MissionController.ts

File: `packages/nova-v0.1/src/MissionController.ts`

Orchestrates all components. Integration test runs the full mission in a temp directory.

**Test plan (integration):**
- Full mission: create project → init vite → install three → write files → verify build
- Mission succeeds → MissionResult.status === 'completed'
- Mission succeeds → 7/7 tasks completed
- Mission succeeds → project directory exists with expected files
- Mission with failing task → Recovery retries → succeeds on retry
- Mission with permanent failure → MissionResult.status === 'failed'

### Step 8: CLI entry point

File: `packages/nova-v0.1/src/cli.ts` (optional, for testing)

```typescript
import { createServiceContainer } from '@gamedev-agent/di';
import { /* register modules */ } from '@gamedev-agent/kernel';
// ... wire up v0.1 components ...
// Call: MissionController.runMission(process.argv[2])
```

This is the smoke test. Run:
```
node packages/nova-v0.1/dist/cli.js "Create a Three.js + TypeScript + Vite project"
```

And watch it work. Or fail. Either way, you learn something real.

---

## 10. Dependencies on Existing Packages

| v0.1 Component | Existing Package | Existing Class/Service Used | How |
|---------------|-----------------|---------------------------|-----|
| GoalParser | `@gamedev-agent/model-providers` | `ModelProvidersService.generate()` | Single LLM call with `responseFormat: 'json_object'` |
| Executor | `@gamedev-agent/tool-runtime` | `ToolManager.invoke()` | Routes each task to the correct tool |
| Executor | `@gamedev-agent/runtime` | Indirectly via tool-runtime | Tools use runtime providers |
| MissionController | `@gamedev-agent/events` | `EventBusContract.publish()` | Publishes mission lifecycle events |
| All | `@gamedev-agent/shared` | `Json`, `Timestamp`, `UUID` | Shared types |
| All | `@gamedev-agent/logging` | `Logger` | Structured logging |

**What v0.1 does NOT use (even though they exist):**

| Existing Package | Why Not Used |
|-----------------|-------------|
| `execution-engine` | Designed for AI-driven tool-call loops (dispatch model → receive tool calls → invoke → repeat). v0.1 has deterministic steps, not AI-driven loops. |
| `context` | No need for context assembly. v0.1 has a fixed project creation task. |
| `planner` | Full planner with strategies is overkill for a known 7-step mission. v0.1 Planner is a single pure function. |
| `producer` | Goal analysis + mission tree generation is too heavyweight. v0.1 needs simple NL→structured parsing. |
| `coordinator` | Full mission lifecycle state machine is unnecessary. v0.1 has 3 states: running/completed/failed. |
| `workflow` | Workflow engine with pause/resume/complex state machine is overkill for sequential step execution. |
| `memory` | No persistence needed in v0.1. |
| `intelligence` | Agent registry, task engine — all future concerns. |

This list is intentional. Each unused package is deferred because its complexity doesn't serve v0.1's single mission.

---

## 11. Template Files (for Planner)

These are inline string templates in Planner.ts. Not separate files. Not configurable in v0.1.

```typescript
function viteConfigTemplate(): string {
  return [
    'import { defineConfig } from "vite";',
    '',
    'export default defineConfig({',
    '  root: ".",',
    '  build: {',
    '    outDir: "dist",',
    '  },',
    '});',
    '',
  ].join('\n');
}

function mainTsTemplate(): string {
  return [
    'import * as THREE from "three";',
    '',
    'const scene = new THREE.Scene();',
    'const camera = new THREE.PerspectiveCamera(',
    '  75,',
    '  window.innerWidth / window.innerHeight,',
    '  0.1,',
    '  1000',
    ');',
    '',
    'const renderer = new THREE.WebGLRenderer();',
    'renderer.setSize(window.innerWidth, window.innerHeight);',
    'document.body.appendChild(renderer.domElement);',
    '',
    'const geometry = new THREE.BoxGeometry();',
    'const material = new THREE.MeshBasicMaterial({',
    '  color: 0x00ff00,',
    '});',
    'const cube = new THREE.Mesh(geometry, material);',
    'scene.add(cube);',
    '',
    'camera.position.z = 5;',
    '',
    'function animate() {',
    '  requestAnimationFrame(animate);',
    '  cube.rotation.x += 0.01;',
    '  cube.rotation.y += 0.01;',
    '  renderer.render(scene, camera);',
    '}',
    '',
    'animate();',
    '',
  ].join('\n');
}

function htmlTemplate(projectName: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `  <title>${projectName}</title>`,
    '</head>',
    '<body>',
    '  <script type="module" src="/src/main.ts"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
```

---

## 12. What v0.1 Is NOT

| Not | Why |
|-----|-----|
| Not a general-purpose system | Only handles Three.js + TypeScript + Vite project creation |
| Not using the execution-engine | The AI-driven dispatch loop is unnecessary for deterministic steps |
| Not using the context pipeline | No need for context assembly in a fixed mission |
| Not using memory | Nothing to persist in v0.1 |
| Not using the workflow engine | 7 sequential steps don't need a workflow state machine |
| Not using specialist agents | No architect/engineer/blender roles |
| Not using skills | No Three.js skill (templates are hardcoded) |
| Not using the planner package | The existing Planner is designed for LLM-driven planning, not deterministic templates |
| Not an AI assistant | It runs one mission, reports results, and stops |
| Not production-ready | No error recovery beyond retry-once. No cancellation. No progress UI. |

---

## 13. What Should Be Implemented First Tomorrow Morning

**`packages/nova-v0.1/src/types.ts`**

Not because it's the most important, but because:
1. Every other file imports it
2. It has zero dependencies on the rest of the system
3. It forces you to make concrete decisions (what's a Task? what's a MissionResult?)
4. You can write it in 15 minutes and immediately have something that compiles
5. It answers "what is the shape of this system?" before you write any logic

After types.ts compile, immediately write `Planner.ts` and `Planner.test.ts`. Why?

- The Planner is a pure function with no IO
- It's the fastest path to a passing test
- It validates your types work (Task[], StructuredGoal, etc.)
- It forces you to define the exact 7-step execution plan
- By the end of day 1, you have 2 files done and 1 passing test

The Executor (step 3) is the riskiest component, so you want to reach it on day 2 with confidence that the types and plan are solid.

**Day 1 plan:**
```
Morning:  types.ts (15 min) → compile ✅
          Planner.ts + test (45 min) → test passes ✅
Afternoon: Executor.ts (2h) → integration test against real ToolManager ✅
           Observer.ts + test (20 min) → test passes ✅
End of day: 5 files, 4 passing tests, core execution works
```

**Day 2 plan:**
```
Morning:  Recovery.ts + test (15 min) → test passes ✅
          GoalParser.ts + test (1h) → test passes with mock LLM, manual with real LLM ✅
Afternoon: MissionController.ts + integration test (2h) → full mission works ✅
           CLI smoke test (30 min) → "Create a Three.js project" works end-to-end ✅
End of day: v0.1 done
```

---

*Nova v0.1 Implementation Specification — July 2026*
