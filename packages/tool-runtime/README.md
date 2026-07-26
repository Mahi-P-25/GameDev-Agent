# Tool Runtime (`@gamedev-agent/tool-runtime`)

The **Nova Tool Runtime** manages external tools (discover, connect, disconnect, monitor, invoke) through a single, consistent interface. It is the integration point between **Capabilities**, **Coordinator**, the **Studio API** (via the shared event stream), and the **Event Bus** — and depends on no other subsystem directly.

## Why

Nova must control many external tools (VS Code, Git, Terminal, Browser, Blender, …) without each one knowing about the others. The runtime gives every tool the same shape, the same lifecycle, and the same guardrails, then surfaces them to the rest of Nova as **capabilities** and **events**.

## Architecture

```
ToolModule ──▶ ToolManager (orchestrator)
                  ├─ ToolRegistry        (registration store)
                  ├─ ToolConnectionStateMachine  (per-tool lifecycle)
                  ├─ ToolHealthMonitor   (periodic health polling)
                  ├─ ToolInvoker         (resolve → permission → connection → route)
                  ├─ CapabilitiesLink    (read-only advertise seam → CapabilityManager)
                  ├─ CoordinatorLink     (correlationId → mission seam)
                  └─ EventBusContract    (publishes typed ToolEvents)
```

Each concrete tool implements the **`ToolHandler`** contract (`connect` / `disconnect` / `isConnected` / `health` / `capabilities` / `invoke`). The first tool, **`VSCodeToolAdapter`**, wraps `@gamedev-agent/vscode`'s `VSCodeClient` without changing its behavior — it only translates the runtime's `action`/`input` into the client's existing, audited methods.

## Integration seams (proven from SPRINT-15)

- **Event Bus** — publishes typed `tool.*` events (`tool.registered`, `tool.connection-changed`, `tool.health-changed`, `tool.invoked`, `tool.invocation-succeeded`, `tool.invocation-failed`, `tool.permission-denied`, `tool.unregistered`). The Studio API already consumes the capability/tool event stream; it needs no direct import.
- **Coordinator** — read-only `resolveMission(correlationId)` for correlating invocations with missions.
- **Capabilities** — read-only `advertise` / `withdraw` so tools appear in the Studio API's discovered capabilities.
- **Studio API** — reached *only* via the event stream / capabilities; never imported.

## Permission model

A tool descriptor declares `permissions`; each `ToolCapability` declares per-action `permissions`. The manager gates every invocation against an injected granted-permission set (the same `CapabilityPermission` strings `CapabilityManager` uses). A denied invocation returns `ok: false` with `error.code === 'permission-denied'` and emits `tool.permission-denied`.

## Versioning & platform

Every descriptor carries `version` (semver) and `supportedPlatforms`. `register` rejects tools that do not support the host platform (`ToolPlatformError`) and rejects duplicate ids (`ToolAlreadyRegisteredError`).

## Audit trail

Every register / connect / disconnect / invoke is recorded with an actor, correlation id, `ok` flag, and timestamp — retrievable via `ToolManager.auditTrail()`.

## Usage

```ts
const manager = container.resolve(TOOL_RUNTIME_TOKEN);
await manager.register(vscodeDescriptor, new VSCodeToolAdapter(client));
await manager.connect('nova.tool.vscode', { kind: 'director' });
const result = await manager.invoke({
  toolId: 'nova.tool.vscode',
  action: 'files.read',
  input: { path: 'src/index.ts' },
  actor: { kind: 'director' },
  correlationId: null,
});
```

## Testing

`vitest` with source-path aliases. Run `npx vitest run` (coverage: registration, connection lifecycle, invocation, health transitions, permission gating).
