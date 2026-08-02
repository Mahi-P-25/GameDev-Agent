import { describe, expect, it } from 'vitest';
import { AgentEventCatalog } from './AgentEvents';

/**
 * The `agent.*` vocabulary owned by execution-engine's MissionAgentEvents
 * (report §7.4). Hardcoded here so the two catalogs can never silently drift
 * into an overlap.
 */
const SINGLE_AGENT_EVENT_TYPES: ReadonlyArray<string> = [
  'agent.state-changed',
  'agent.thought',
  'agent.observation',
  'agent.decision',
  'agent.action-started',
  'agent.action-result',
  'agent.verification',
  'agent.progress',
  'agent.mission-complete',
  'agent.artifact-created',
];

describe('mission.agent event catalog', () => {
  it('defines nine events under the mission.agent namespace at version 1', () => {
    expect(AgentEventCatalog).toHaveLength(9);
    for (const definition of AgentEventCatalog) {
      expect(definition.version).toBe(1);
      expect(definition.type.startsWith('mission.agent.')).toBe(true);
    }
  });

  it('has distinct event types', () => {
    const types = AgentEventCatalog.map((definition) => definition.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('never overlaps the single-agent agent.* vocabulary', () => {
    const multiAgentTypes = new Set(AgentEventCatalog.map((definition) => definition.type));
    for (const existing of SINGLE_AGENT_EVENT_TYPES) {
      expect(multiAgentTypes.has(existing)).toBe(false);
    }
  });
});
