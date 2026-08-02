import type { Agent, AgentContext, AgentMessage } from '@gamedev-agent/agent-runtime';

/**
 * Base no-op specialist. Phase 2 lands the contracts and the type
 * registration; real per-role behavior (subscribing to `mission.agent.assigned`
 * and publishing `mission.agent.result`) lands Phase 3.
 */
export abstract class SpecialistAgent implements Agent {
  async onInit(_ctx: AgentContext): Promise<void> {}

  async onStart(): Promise<void> {}

  async onStop(): Promise<void> {}

  async onMessage(_msg: AgentMessage): Promise<AgentMessage | undefined> {
    return undefined;
  }
}
