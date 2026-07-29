import type { ToolCapability, ToolSchema } from './ToolTypes';

/**
 * ToolSchemaRegistry — adapter-owned schema registry.
 *
 * Each tool adapter registers its action schemas at registration time.
 * The runtime never constructs schemas itself — it only queries the registry.
 * This eliminates the giant `buildActionSchema` switch statement.
 *
 * When no schema is registered for an action, a permissive default is returned.
 */
export class ToolSchemaRegistry {
  private readonly schemas = new Map<string, ToolSchema>();

  /**
   * Register schemas from a tool's capabilities.
   * Each capability declares schemas for its actions.
   */
  register(
    toolId: string,
    capabilities: ReadonlyArray<ToolCapability>,
    getSchema?: (action: string) => ToolSchema | undefined,
  ): void {
    for (const cap of capabilities) {
      for (const action of cap.actions) {
        const schema = getSchema?.(action);
        if (schema !== undefined) {
          this.schemas.set(`${toolId}:${action}`, schema);
        }
        // Also register the non-prefixed version for global lookup
        if (schema !== undefined && !this.schemas.has(action)) {
          this.schemas.set(action, schema);
        }
      }
    }
  }

  /**
   * Unregister all schemas for a tool.
   */
  unregister(toolId: string): void {
    for (const key of this.schemas.keys()) {
      if (key.startsWith(`${toolId}:`)) {
        this.schemas.delete(key);
      }
    }
  }

  /**
   * Get the schema for an action.
   * Falls back to a permissive default schema if none registered.
   */
  get(action: string): ToolSchema {
    return this.schemas.get(action) ?? DEFAULT_SCHEMA;
  }

  /**
   * Get the schema for a specific tool's action.
   */
  getForTool(toolId: string, action: string): ToolSchema {
    return this.schemas.get(`${toolId}:${action}`) ?? this.get(action);
  }

  /**
   * Check if a schema is registered for an action.
   */
  has(action: string): boolean {
    return this.schemas.has(action);
  }

  /**
   * Get all registered action names.
   */
  actions(): readonly string[] {
    return [...this.schemas.keys()].filter((k) => !k.includes(':'));
  }

  /**
   * Register a single schema.
   */
  set(action: string, schema: ToolSchema): void {
    this.schemas.set(action, schema);
  }

  /**
   * Clear all schemas.
   */
  clear(): void {
    this.schemas.clear();
  }
}

const DEFAULT_SCHEMA: ToolSchema = {
  input: {
    type: 'object',
    properties: {},
    additionalProperties: true,
  },
};
