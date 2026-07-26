# Terminal (`@gamedev-agent/terminal`)

The **Nova Terminal Tool** is the second integration built on the Tool Runtime. It executes terminal commands — `run` (foreground), `start` (background), `stop` (cancel), and `output` (read the captured buffer) — behind an explicit approval model, under the same contract and guardrails as `VSCodeToolAdapter`.

It is a pure **Tool Runtime integration**: it depends only on `tool-runtime`, and reaches the rest of Nova through the injected **Event Bus**, **Coordinator** link, and **Capabilities** seam. It imports no AI, Memory, Knowledge, Git, or Browser package, and it never runs anything on its own initiative.

## Why

Nova needs to run shell commands for the user (build, test, scaffold, inspect) without re-implementing process lifecycle, streaming, timeouts, or cancellation for every future tool. The Terminal Tool proves the Tool Runtime architecture scales: a second adapter follows the exact same shape as `VSCodeToolAdapter`, so future tools (Git, Browser, Blender, …) reuse the same lifecycle, permission gating, and event surface.

## Architecture

```
TerminalModule ──▶ TerminalClient (audited façade + event publisher)
                       └─ ProcessManager (registry / lifecycle)
                            └─ CommandRunner (spawn → ProcessHandle)
                                 └─ ProcessHandle (buffer, timeout, SIGTERM→SIGKILL)
                                      └─ TerminalProcessRunner  (backend seam)
                                            ├─ NodeProcessBridge   (node:child_process)
                                            └─ FakeProcessRunner   (tests)

TerminalToolAdapter implements ToolHandler
  connect / disconnect / isConnected / health / capabilities / invoke
  ── maps actions ──▶ TerminalClient methods
       terminal.run   → runCommand      (foreground, resolves with result)
       terminal.start → startProcess    (background, returns id)
       terminal.stop  → stopProcess     (cancel)
       terminal.output→ getProcessOutput (read buffer by id)
```

The adapter is registered with the `ToolManager` and connected, exactly like `VSCodeToolAdapter`. The client is the only place that talks to the `EventBusContract` and the optional `CoordinatorLink`. The `ProcessManager` / `ProcessHandle` / `CommandRunner` layer is pure process state — no events, no subsystem imports.

## Capabilities

| capability | actions | permissions |
| --- | --- | --- |
| `shell` | `terminal.run`, `terminal.start` | `process.spawn`, `system.env` |
| `process-control` | `terminal.stop` | `process.kill` |
| `output` | `terminal.output` | _(none)_ |

## Safety invariants

- **No auto-execute.** Every run names an explicit `TerminalActor` and a `correlationId`; nothing is scheduled or run internally.
- **Captured output.** stdout / stderr / exit code are buffered (capped at 4 MB) and surfaced via `terminal.output` events and the `output` action.
- **Cancellation & timeout.** `stop` and timeouts escalate `SIGTERM → SIGKILL` after a grace period; the result carries a `timedOut` flag and the terminating signal.
- **Immutable audit trail.** Every execution is recorded (actor, correlation id, command line, outcome) and retrievable via `TerminalClient.auditTrail()`.
- **Spawn failures reject.** A failed spawn surfaces as `TerminalSpawnError` and a `terminal.command-failed` event — never a silent success.

## Integration seams

- **Event Bus** — publishes typed `terminal.*` events (`terminal.command-started`, `terminal.output`, `terminal.command-completed`, `terminal.command-failed`, `terminal.process-stopped`). The Studio API consumes the tool/event stream; it needs no direct import.
- **Coordinator** — read-only `resolveMission(correlationId)` to correlate a command with a mission.
- **Capabilities** — the adapter advertises the `shell` / `process-control` / `output` capabilities through the runtime's capability seam.
- **Studio API** — reached *only* via the event stream / capabilities; never imported (the terminal runs node-side, like `@gamedev-agent/vscode`).

## Usage

```ts
import { terminalModule, TERMINAL_CLIENT_TOKEN, TERMINAL_TOOL_ID } from '@gamedev-agent/terminal';

// Inside a KernelModule graph, after tool-runtime is registered:
//   terminalModule resolves COORDINATOR_MANAGER_TOKEN → CoordinatorLink,
//   registers TerminalClient, then registers + connects TerminalToolAdapter.

const client = container.resolve(TERMINAL_CLIENT_TOKEN);
const result = await client.runCommand({ kind: 'director' }, null, { command: 'npm', args: ['test'] });
// result: { stdout, stderr, exitCode, signal, timedOut, pid }

const info = client.startProcess({ kind: 'director' }, null, { command: 'tsc', args: ['--watch'], background: true });
const out = client.getProcessOutput(info.id);
client.stopProcess({ kind: 'director' }, null, info.id, 'SIGTERM');
```

## Backend seam

`TerminalProcessRunner.spawn` returns a `SpawnedProcess`. The node backend is `NodeProcessBridge` (wraps `node:child_process.spawn`); tests use `FakeProcessRunner`. Swapping backends never touches the client, manager, or adapter.

## Testing

`vitest` with source-path aliases. Run `npx vitest run` — covers run/capture, streaming events, spawn failure, non-zero exit, background start, stop, timeout (SIGTERM), output-by-id, unknown-process errors, coordinator link, and the audit trail.
