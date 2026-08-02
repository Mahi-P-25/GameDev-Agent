import type { AgentTypeDescriptor } from '@gamedev-agent/agent-runtime';
import { agentTypeForRole, roleCapabilities } from '../AgentTypes';
import { SpecialistAgent } from './base';

export class PlannerAgent extends SpecialistAgent {}

export const plannerAgentDescriptor: AgentTypeDescriptor = {
  type: agentTypeForRole('planner'),
  name: 'Planner',
  description:
    'Decomposes mission goals into ordered plans, sequences specialist work, and monitors mission progress.',
  capabilities: roleCapabilities('planner'),
  factory: () => new PlannerAgent(),
};
