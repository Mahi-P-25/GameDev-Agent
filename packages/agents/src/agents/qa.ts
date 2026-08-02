import type { AgentTypeDescriptor } from '@gamedev-agent/agent-runtime';
import { agentTypeForRole, roleCapabilities } from '../AgentTypes';
import { SpecialistAgent } from './base';

export class QaAgent extends SpecialistAgent {}

export const qaAgentDescriptor: AgentTypeDescriptor = {
  type: agentTypeForRole('qa'),
  name: 'QA',
  description:
    'Validates behavior and regressions: runs tests and builds, inspects output, and reports defects with evidence.',
  capabilities: roleCapabilities('qa'),
  factory: () => new QaAgent(),
};
