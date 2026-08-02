import type { AgentTypeDescriptor } from '@gamedev-agent/agent-runtime';
import { agentTypeForRole, roleCapabilities } from '../AgentTypes';
import { SpecialistAgent } from './base';

export class TechnicalArtistAgent extends SpecialistAgent {}

export const technicalArtistAgentDescriptor: AgentTypeDescriptor = {
  type: agentTypeForRole('technical-artist'),
  name: 'Technical Artist',
  description:
    'Owns the art-tech boundary: prepares and validates assets, wiring, scenes, and rendering pipeline integration.',
  capabilities: roleCapabilities('technical-artist'),
  factory: () => new TechnicalArtistAgent(),
};
