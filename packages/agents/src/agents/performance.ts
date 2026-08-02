import type { AgentTypeDescriptor } from '@gamedev-agent/agent-runtime';
import { agentTypeForRole, roleCapabilities } from '../AgentTypes';
import { SpecialistAgent } from './base';

export class PerformanceAgent extends SpecialistAgent {}

export const performanceAgentDescriptor: AgentTypeDescriptor = {
  type: agentTypeForRole('performance'),
  name: 'Performance',
  description:
    'Measures and improves performance: profiling, load tests, and build output analysis against frame/time budgets.',
  capabilities: roleCapabilities('performance'),
  factory: () => new PerformanceAgent(),
};
