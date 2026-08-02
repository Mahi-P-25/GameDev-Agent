import type { AgentTypeDescriptor } from '@gamedev-agent/agent-runtime';
import { gameDesignerAgentDescriptor } from './game-designer';
import { performanceAgentDescriptor } from './performance';
import { plannerAgentDescriptor } from './planner';
import { programmerAgentDescriptor } from './programmer';
import { qaAgentDescriptor } from './qa';
import { technicalArtistAgentDescriptor } from './technical-artist';

export {
  GameDesignerAgent,
  gameDesignerAgentDescriptor,
} from './game-designer';
export {
  PerformanceAgent,
  performanceAgentDescriptor,
} from './performance';
export { PlannerAgent, plannerAgentDescriptor } from './planner';
export { ProgrammerAgent, programmerAgentDescriptor } from './programmer';
export { QaAgent, qaAgentDescriptor } from './qa';
export {
  TechnicalArtistAgent,
  technicalArtistAgentDescriptor,
} from './technical-artist';

/** Every specialist type descriptor, registered once at kernel boot. */
export function createSpecialistDescriptors(): ReadonlyArray<AgentTypeDescriptor> {
  return [
    plannerAgentDescriptor,
    programmerAgentDescriptor,
    technicalArtistAgentDescriptor,
    gameDesignerAgentDescriptor,
    qaAgentDescriptor,
    performanceAgentDescriptor,
  ];
}
