import type { Agent } from './IntelligenceTypes';

/**
 * The built-in, truthful roster of specialized agents. Each agent is a *host* for
 * real operations; registering one emits only an `agent.registered` event. New
 * agent kinds (Claude Code, OpenCode, Git, Build) are added here as integrations
 * land — they are inert until given a real task to run.
 *
 * Kept in a kernel-free module so both the {@link Intelligence} facade and the
 * kernel {@link intelligenceModule} can seed the same roster without a cycle.
 */
export const DEFAULT_AGENTS: ReadonlyArray<{
  readonly kind: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: ReadonlyArray<string>;
}> = [
  {
    kind: 'architect',
    name: 'Studio Architect',
    description: 'Plans structure, dependencies, and system design.',
    capabilities: ['design', 'architecture'],
  },
  {
    kind: 'engineer',
    name: 'Studio Engineer',
    description: 'Implements features and fixes through real operations.',
    capabilities: ['implement', 'edit', 'workflow'],
  },
  {
    kind: 'qa',
    name: 'Studio QA',
    description: 'Validates builds and runs inspection workflows.',
    capabilities: ['validate', 'inspect', 'workflow'],
  },
  {
    kind: 'builder',
    name: 'Studio Builder',
    description: 'Runs build and terminal operations.',
    capabilities: ['build', 'terminal'],
  },
];

/** Seed a registry with the default specialized agents. Returns the registered agents. */
export function seedDefaultAgents(registry: {
  register(input: {
    readonly kind: string;
    readonly name: string;
    readonly description: string;
    readonly capabilities: ReadonlyArray<string>;
  }): Agent;
}): ReadonlyArray<Agent> {
  return DEFAULT_AGENTS.map((def) => registry.register(def));
}
