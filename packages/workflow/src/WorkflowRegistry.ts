import type { Disposable } from '@gamedev-agent/shared';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionId,
} from './WorkflowDefinition';
import { DuplicateWorkflowError, WorkflowNotFoundError } from './WorkflowErrors';

/**
 * Tracks registered {@link WorkflowDefinition}s and active
 * {@link WorkflowExecution} runs.
 *
 * Responsibilities (and nothing more): register/unregister workflow
 * definitions, look them up, and store/retrieve execution runs by id. It is
 * purely about *bookkeeping* — it emits no events and never touches the Event
 * Bus, Logger, or filesystem. This keeps registration and run tracking
 * testable and fast, and lets the {@link WorkflowManager} own all orchestration
 * (state, events, integration).
 */
export class WorkflowRegistry implements Disposable {
  private readonly definitionMap = new Map<string, WorkflowDefinition>();
  private readonly executionMap = new Map<string, WorkflowExecution>();

  /** Register a workflow definition. Throws on duplicate id. */
  register(definition: WorkflowDefinition): void {
    if (this.definitionMap.has(definition.id)) {
      throw new DuplicateWorkflowError(definition.id);
    }
    this.definitionMap.set(definition.id, definition);
  }

  /** Replace (or add) a workflow definition, tolerating an existing id. */
  upsert(definition: WorkflowDefinition): void {
    this.definitionMap.set(definition.id, definition);
  }

  /** Remove a workflow definition. No-op when absent. */
  unregister(id: string): void {
    this.definitionMap.delete(id);
  }

  /** True when a workflow definition is registered. */
  has(id: string): boolean {
    return this.definitionMap.has(id);
  }

  /** Fetch a definition by id, or throw {@link WorkflowNotFoundError}. */
  get(id: string): WorkflowDefinition {
    const definition = this.definitionMap.get(id);
    if (definition === undefined) {
      throw new WorkflowNotFoundError('workflow', id);
    }
    return definition;
  }

  /** Fetch a definition by id, or `undefined` when absent. */
  find(id: string): WorkflowDefinition | undefined {
    return this.definitionMap.get(id);
  }

  /** Every registered definition (for discovery/UI). */
  definitions(): ReadonlyArray<WorkflowDefinition> {
    return Array.from(this.definitionMap.values());
  }

  // --- executions ------------------------------------------------------------

  /** Store (or replace) an execution run. */
  add(execution: WorkflowExecution): void {
    this.executionMap.set(execution.id, execution);
  }

  /** Update a stored execution run in place. */
  update(execution: WorkflowExecution): void {
    this.executionMap.set(execution.id, execution);
  }

  /** Fetch an execution by id, or throw {@link WorkflowNotFoundError}. */
  getExecution(id: WorkflowExecutionId): WorkflowExecution {
    const execution = this.executionMap.get(id);
    if (execution === undefined) {
      throw new WorkflowNotFoundError('execution', id);
    }
    return execution;
  }

  /** Fetch an execution by id, or `undefined` when absent. */
  findExecution(id: WorkflowExecutionId): WorkflowExecution | undefined {
    return this.executionMap.get(id);
  }

  /** Every tracked execution, insertion order. */
  executions(): ReadonlyArray<WorkflowExecution> {
    return Array.from(this.executionMap.values());
  }

  /** Executions for a given workflow definition. */
  executionsFor(workflowId: string): ReadonlyArray<WorkflowExecution> {
    return this.executions().filter((e) => e.workflowId === workflowId);
  }

  /** Reset all state (used by tests and teardown). */
  clear(): void {
    this.definitionMap.clear();
    this.executionMap.clear();
  }

  dispose(): void {
    this.clear();
  }
}
