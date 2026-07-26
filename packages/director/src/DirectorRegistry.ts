import type { Goal, StrategyBlueprint } from './DirectorTypes';

export interface DirectorImplementation {
  readonly name: string;
  readonly description: string;
  canHandle(goal: Goal): boolean;
  formulate(goal: Goal): StrategyBlueprint;
}

export class DirectorRegistry {
  private readonly implementations = new Map<string, DirectorImplementation>();

  register(impl: DirectorImplementation): void {
    if (this.implementations.has(impl.name)) {
      throw new Error(`Director implementation "${impl.name}" is already registered`);
    }
    this.implementations.set(impl.name, impl);
  }

  resolve(goal: Goal): DirectorImplementation {
    for (const impl of this.implementations.values()) {
      if (impl.canHandle(goal)) {
        return impl;
      }
    }
    throw new Error(`No director implementation can handle goal "${goal.id}"`);
  }

  get(name: string): DirectorImplementation | undefined {
    return this.implementations.get(name);
  }

  list(): ReadonlyArray<DirectorImplementation> {
    return Array.from(this.implementations.values());
  }
}
