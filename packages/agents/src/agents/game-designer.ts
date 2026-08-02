import type { AgentTypeDescriptor } from '@gamedev-agent/agent-runtime';
import { agentTypeForRole, roleCapabilities } from '../AgentTypes';
import { SpecialistAgent } from './base';

export class GameDesignerAgent extends SpecialistAgent {}

export const gameDesignerAgentDescriptor: AgentTypeDescriptor = {
  type: agentTypeForRole('game-designer'),
  name: 'Game Designer',
  description:
    'Owns design intent: gameplay, levels, tuning, and content structure expressed as assets, config, and data.',
  capabilities: roleCapabilities('game-designer'),
  factory: () => new GameDesignerAgent(),
};
