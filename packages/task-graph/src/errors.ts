export class TaskGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskGraphError';
  }
}

export class DuplicateNodeError extends TaskGraphError {
  constructor(id: string) {
    super(`Node "${id}" already exists in the graph`);
    this.name = 'DuplicateNodeError';
  }
}

export class CycleDetectedError extends TaskGraphError {
  constructor() {
    super('Graph contains a cycle: topological sort is impossible');
    this.name = 'CycleDetectedError';
  }
}

export class InvalidGraphError extends TaskGraphError {
  constructor(reason: string) {
    super(`Invalid task graph: ${reason}`);
    this.name = 'InvalidGraphError';
  }
}

export class MissingNodeError extends TaskGraphError {
  constructor(id: string) {
    super(`Node "${id}" not found in the graph`);
    this.name = 'MissingNodeError';
  }
}
