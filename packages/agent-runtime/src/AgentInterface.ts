import type { AgentMessage } from './AgentTypes';
import type { AgentContext } from './AgentContext';

export interface Agent {
  onInit(ctx: AgentContext): Promise<void>;
  onMessage(msg: AgentMessage): Promise<AgentMessage | undefined>;
  onStart(): Promise<void>;
  onStop(): Promise<void>;
}
