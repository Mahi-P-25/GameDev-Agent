import type { Json, Timestamp, UUID } from '@gamedev-agent/shared';
import { ToolActionNotFoundError, ToolNotConnectedError, ToolPermissionError } from './ToolErrors';
import type {
  ToolCapability,
  ToolHandler,
  ToolId,
  ToolInvocationContext,
  ToolInvocationRequest,
  ToolInvocationResult,
} from './ToolTypes';

/**
 * Routes and gates a single tool invocation.
 *
 * The invoker is the seam the {@link ToolManager} uses to turn a
 * {@link ToolInvocationRequest} into a {@link ToolInvocationResult} without the
 * manager bloating with per-call policy. It performs, in order:
 *  1. **Resolve** — find the handler and the capability/action.
 *  2. **Permission gate** — the action's required permissions must be a subset
 *     of the runtime's granted permissions.
 *  3. **Connection gate** — the tool must be connected (tools are not invoked
 *     while disconnected; that would be an implicit, unaudited reach).
 *  4. **Route** — delegate to {@link ToolHandler.invoke}, timing the call and
 *     converting thrown errors into a structured failure.
 *
 * The invoker itself does **not** publish events or write the audit trail —
 * that remains the manager's orchestration concern — but it returns a rich
 * result and the structured failure info the manager needs to do both.
 */
export class ToolInvoker {
  constructor(
    private readonly handlers: ReadonlyMap<string, ToolHandler>,
    private readonly capabilitiesByTool: ReadonlyMap<string, ReadonlyArray<ToolCapability>>,
    private readonly granted: ReadonlySet<string>,
  ) {}

  /** Invoke a tool action. Never throws for expected failures. */
  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const { toolId, action } = request;
    const handler = this.handlers.get(toolId);
    if (handler === undefined) {
      return this.fail(toolId, action, 'tool-not-found', `tool "${toolId}" is not registered`);
    }

    const capability = this.resolveCapability(toolId, action);
    if (capability === undefined) {
      return this.fail(toolId, action, 'action-not-found', `action "${action}" is not available`);
    }

    const missing = capability.permissions.filter((p) => !this.granted.has(p));
    if (missing.length > 0) {
      return this.fail(
        toolId,
        action,
        'permission-denied',
        `missing permissions: ${missing.join(', ')}`,
        {
          missing,
        },
      );
    }

    if (!handler.isConnected()) {
      return this.fail(toolId, action, 'not-connected', `tool "${toolId}" is not connected`);
    }

    const context: ToolInvocationContext =
      request.signal === undefined
        ? { correlationId: request.correlationId }
        : { correlationId: request.correlationId, signal: request.signal };

    const startedAt = Date.now();
    try {
      const result = await handler.invoke(action, request.input, context);
      const durationMs = Date.now() - startedAt;
      return { ...result, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      return this.fail(toolId, action, 'invocation-error', message, undefined, durationMs);
    }
  }

  /** Find the capability that owns `action`, if any. */
  private resolveCapability(toolId: ToolId, action: string): ToolCapability | undefined {
    const caps = this.capabilitiesByTool.get(toolId) ?? [];
    for (const cap of caps) {
      if (cap.actions.includes(action)) {
        return cap;
      }
    }
    return undefined;
  }

  private fail(
    toolId: ToolId,
    action: string,
    code: string,
    message: string,
    extra?: { missing?: ReadonlyArray<string> },
    durationMs = 0,
  ): ToolInvocationResult {
    return {
      ok: false,
      toolId,
      action,
      durationMs,
      output: null,
      error: {
        code,
        message,
        ...(extra?.missing !== undefined ? { cause: { missing: extra.missing } } : {}),
      },
    };
  }
}

// Re-export error types so callers can branch on invoker-level failures.
export { ToolActionNotFoundError, ToolNotConnectedError, ToolPermissionError };
export type { Json, Timestamp, UUID };
