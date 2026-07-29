import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Json, UUID } from '@gamedev-agent/shared';
import { CapabilityPlanner } from './CapabilityPlanner';
import { ToolCapabilityCompleted, ToolCapabilityFailed, ToolCapabilityStarted } from './ToolEvents';
import type { ToolManager } from './ToolManager';
import { ToolSchemaRegistry } from './ToolSchemaRegistry';
import { ToolSessionManager } from './ToolSession';
import type { SessionId } from './ToolSession';
import type {
  CapabilityExecutionRequest,
  MissionAbility,
  ResolvedCapability,
  ToolActor,
  ToolId,
  ToolOrchestratorOptions,
  ToolSchema,
  ToolSession,
  ToolSessionOptions,
} from './ToolTypes';

/**
 * Model tool definition shape consumed by AI model providers.
 * Replaces the hardcoded buildActionSchema in the execution engine.
 */
export interface ModelToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/**
 * Result of a capability execution through the orchestrator.
 */
export interface CapabilityResult {
  readonly ok: boolean;
  readonly toolId: ToolId;
  readonly capabilityId: string;
  readonly output: Json | null;
  readonly durationMs: number;
  readonly sessionId?: string;
  readonly error?: { readonly code: string; readonly message: string };
}

/**
 * ToolOrchestrator — the public facade for Nova's game-dev Tool Orchestrator.
 *
 * Wraps the low-level ToolManager with:
 *  - Capability-first routing (find tool by capability, not action name)
 *  - ToolSession management (stateful multi-invocation interactions)
 *  - Embedded CapabilityPlanner (abstract mission abilities → concrete capabilities)
 *  - Self-describing model tool definitions (replaces buildActionSchema)
 *
 * The orchestrator is engine-agnostic: it routes capabilities to the right
 * tool without knowing which game engine or tool is on the other end.
 */
export class ToolOrchestrator {
  private readonly toolManager: ToolManager;
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly planner: CapabilityPlanner;
  private readonly sessions: ToolSessionManager;
  private readonly schemas: ToolSchemaRegistry;

  constructor(options: ToolOrchestratorOptions) {
    this.toolManager = options.toolManager;
    this.bus = options.eventBus;
    this.logger =
      options.logger ?? new RootLogger('nova.tool-orchestrator', [new ConsoleLogSink()]);
    this.sessions = new ToolSessionManager((event) => {
      void this.bus.publish({ type: 'tool.session-event', version: 1 } as any, event as any);
    }, options.defaultSessionTimeoutMs);
    this.planner = new CapabilityPlanner({ toolManager: this.toolManager, logger: this.logger });
    this.schemas = new ToolSchemaRegistry();
  }

  // --- Capability Execution ----------------------------------------------------

  /**
   * Execute a capability by its ID. Routes to the correct tool automatically.
   * If a sessionId is provided, the tool's session state is passed through.
   */
  async executeCapability(request: CapabilityExecutionRequest): Promise<CapabilityResult> {
    const { capabilityId, input, actor, correlationId, sessionId, signal } = request;

    const resolved = this.resolveCapabilityToTool(capabilityId);
    if (resolved === undefined) {
      return {
        ok: false,
        toolId: '' as ToolId,
        capabilityId,
        output: null,
        durationMs: 0,
        error: {
          code: 'capability-not-found',
          message: `no tool provides capability "${capabilityId}"`,
        },
      };
    }

    // Emit capability.started
    this.emitCapabilityEvent(ToolCapabilityStarted, {
      toolId: resolved.toolId,
      capabilityId,
      correlationId: correlationId === null ? null : String(correlationId),
      timestamp: Date.now(),
    });

    // Handle session state if present
    let effectiveInput: Json = input;
    if (sessionId !== undefined) {
      const session = this.sessions.get(sessionId as SessionId);
      if (session?.isActive) {
        effectiveInput = {
          ...(input as Record<string, unknown>),
          __session__: { state: session.state, sessionId: session.sessionId },
        } as unknown as Json;
      }
    }

    const startedAt = Date.now();
    try {
      const result = await this.toolManager.invoke({
        toolId: resolved.toolId,
        action: capabilityId,
        input: effectiveInput,
        actor,
        correlationId,
        signal,
      });

      const durationMs = result.durationMs;

      const capabilityResult: CapabilityResult = {
        ok: result.ok,
        toolId: resolved.toolId,
        capabilityId,
        output: result.output,
        durationMs,
        ...(sessionId !== undefined ? { sessionId } : {}),
      };

      if (!result.ok) {
        this.emitCapabilityEvent(ToolCapabilityFailed, {
          toolId: resolved.toolId,
          capabilityId,
          correlationId: correlationId === null ? null : String(correlationId),
          code: result.error?.code ?? 'unknown',
          message: result.error?.message ?? 'unknown failure',
          durationMs,
          timestamp: Date.now(),
        });
        return {
          ...capabilityResult,
          error: {
            code: result.error?.code ?? 'unknown',
            message: result.error?.message ?? 'unknown failure',
          },
        };
      }

      this.emitCapabilityEvent(ToolCapabilityCompleted, {
        toolId: resolved.toolId,
        capabilityId,
        correlationId: correlationId === null ? null : String(correlationId),
        durationMs,
        timestamp: Date.now(),
      });

      return capabilityResult;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      this.emitCapabilityEvent(ToolCapabilityFailed, {
        toolId: resolved.toolId,
        capabilityId,
        correlationId: correlationId === null ? null : String(correlationId),
        code: 'orchestration-error',
        message: error instanceof Error ? error.message : String(error),
        durationMs,
        timestamp: Date.now(),
      });
      return {
        ok: false,
        toolId: resolved.toolId,
        capabilityId,
        output: null,
        durationMs,
        error: {
          code: 'orchestration-error',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Execute a capability within a session — maintains state across invocations.
   * Creates a new session if sessionId is omitted.
   */
  async executeWithSession(
    capabilityId: string,
    input: Json,
    actor: ToolActor,
    correlationId: UUID | null,
    sessionId?: string,
    signal?: AbortSignal,
  ): Promise<CapabilityResult & { readonly sessionId: string }> {
    // Create or reuse session
    let sid = sessionId;
    if (sid === undefined) {
      const resolved = this.resolveCapabilityToTool(capabilityId);
      if (resolved === undefined) {
        return {
          ok: false,
          toolId: '' as ToolId,
          capabilityId,
          output: null,
          durationMs: 0,
          sessionId: '',
          error: {
            code: 'capability-not-found',
            message: `no tool provides capability "${capabilityId}"`,
          },
        };
      }
      const session = this.sessions.create({
        toolId: resolved.toolId,
        initialState: { capabilityId, createdAt: Date.now() },
      });
      sid = session.sessionId;
    }

    const result = await this.executeCapability({
      capabilityId,
      input,
      actor,
      correlationId,
      sessionId: sid,
      signal,
    });

    return { ...result, sessionId: sid };
  }

  // --- Capability Planning -----------------------------------------------------

  /**
   * Resolve mission abilities to concrete tool capabilities.
   * Delegates to the embedded CapabilityPlanner.
   */
  resolveAbilities(abilities: readonly MissionAbility[]): readonly ResolvedCapability[] {
    return this.planner.resolveAbilities(abilities);
  }

  /**
   * List all mission abilities that can be satisfied by currently registered tools.
   */
  getAvailableAbilities(): readonly MissionAbility[] {
    return this.planner.getAvailableAbilities();
  }

  /**
   * Register a custom ability-to-capability mapping.
   */
  registerAbilityMapping(mapping: import('./ToolTypes').AbilityMapping): void {
    this.planner.registerMapping(mapping);
  }

  /**
   * Access the underlying ToolManager for lower-level operations.
   */
  getToolManager(): ToolManager {
    return this.toolManager;
  }

  // --- Session Management ------------------------------------------------------

  createSession(options: ToolSessionOptions): ToolSession {
    return this.sessions.create(options);
  }

  getSession(sessionId: string): ToolSession | undefined {
    return this.sessions.get(sessionId as SessionId);
  }

  updateSession(sessionId: string, state: Readonly<Record<string, Json>>): ToolSession {
    return this.sessions.update(sessionId as SessionId, state);
  }

  closeSession(sessionId: string): void {
    this.sessions.close(sessionId as SessionId);
  }

  listSessions(toolId?: ToolId): readonly ToolSession[] {
    return this.sessions.listSessions(toolId);
  }

  listActiveSessions(toolId?: ToolId): readonly ToolSession[] {
    return this.sessions.listActiveSessions(toolId);
  }

  // --- Schema Management -------------------------------------------------------

  /**
   * Register schemas for a tool's capabilities.
   * Called during tool registration so the orchestrator knows the schemas
   * without using a switch statement.
   */
  registerToolSchemas(
    toolId: ToolId,
    capabilities: ReadonlyArray<import('./ToolTypes').ToolCapability>,
    getSchema?: (action: string) => import('./ToolTypes').ToolSchema | undefined,
  ): void {
    this.schemas.register(toolId, capabilities, getSchema);
  }

  /**
   * Get the schema for a specific action.
   */
  getSchema(action: string): ToolSchema {
    return this.schemas.get(action);
  }

  /**
   * Get the ToolSchemaRegistry for direct access.
   */
  getSchemaRegistry(): ToolSchemaRegistry {
    return this.schemas;
  }

  // --- Model Tool Definitions (adapter-schema driven) --------------------------

  /**
   * Generate tool definitions suitable for AI model provider consumption.
   * Each capability action becomes a named tool with its input schema.
   * Schemas come from the ToolSchemaRegistry — never from a switch statement.
   */
  toModelTools(capabilityFilter?: readonly string[]): readonly ModelToolDefinition[] {
    const registeredTools = this.toolManager.list();
    const tools: ModelToolDefinition[] = [];

    for (const tool of registeredTools) {
      for (const cap of tool.descriptor.capabilities) {
        for (const action of cap.actions) {
          if (capabilityFilter !== undefined && !capabilityFilter.includes(action)) {
            continue;
          }
          const schema = this.schemas.get(action);
          tools.push({
            name: action,
            description: `${tool.descriptor.name}: ${cap.name} — ${cap.description}`,
            inputSchema: schema.input,
          });
        }
      }
    }

    return tools;
  }

  /**
   * Build a list of tool definitions grouped by tool for model consumption.
   */
  toModelToolsByTool(): readonly {
    readonly toolName: string;
    readonly tools: readonly ModelToolDefinition[];
  }[] {
    const registeredTools = this.toolManager.list();
    const groups: { toolName: string; tools: ModelToolDefinition[] }[] = [];

    for (const tool of registeredTools) {
      const defs: ModelToolDefinition[] = [];
      for (const cap of tool.descriptor.capabilities) {
        for (const action of cap.actions) {
          const schema = this.schemas.get(action);
          defs.push({
            name: action,
            description: `${tool.descriptor.name}: ${cap.name} — ${cap.description}`,
            inputSchema: schema.input,
          });
        }
      }
      if (defs.length > 0) {
        groups.push({ toolName: tool.descriptor.name, tools: defs });
      }
    }

    return groups;
  }

  // --- Internal Helpers --------------------------------------------------------

  private resolveCapabilityToTool(
    capabilityId: string,
  ): { readonly toolId: ToolId; readonly action: string } | undefined {
    const registeredTools = this.toolManager.list();
    for (const tool of registeredTools) {
      for (const cap of tool.descriptor.capabilities) {
        if (cap.actions.includes(capabilityId)) {
          return { toolId: tool.descriptor.id, action: capabilityId };
        }
      }
    }
    return undefined;
  }

  private emitCapabilityEvent(
    definition: import('@gamedev-agent/events').EventDefinition<any>,
    payload: Record<string, unknown>,
  ): void {
    void this.bus.publish(definition, payload);
  }
}

export type { Json };
