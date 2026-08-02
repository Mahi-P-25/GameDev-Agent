import type { AgentTypeDescriptor } from '@gamedev-agent/agent-runtime';
import { agentTypeForRole, roleCapabilities } from '../AgentTypes';
import { SpecialistAgent } from './base';

export class ProgrammerAgent extends SpecialistAgent {}

export const programmerAgentDescriptor: AgentTypeDescriptor = {
  type: agentTypeForRole('programmer'),
  name: 'Programmer',
  description:
    'Implements code changes: writes, edits, and refactors source, runs commands and scripts, and keeps the project building and tested.',
  capabilities: roleCapabilities('programmer'),
  factory: () => new ProgrammerAgent(),
};
