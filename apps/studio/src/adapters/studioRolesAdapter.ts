import type { PlaceholderAdapter, StudioRole } from './types';

/**
 * Placeholder Studio Team (Roles) adapter.
 *
 * The Role System is not implemented yet (the Coordinator only records
 * `RoleRequirement`s). This adapter derives a typed, clearly-labelled preview of
 * the studio's working roles — including the live working status, availability,
 * current mission, and last activity the Home screen needs. Replace `list()`
 * with a live Role System client when it lands — the {@link StudioRole} type and
 * UI components stay unchanged.
 */
const now = Date.now();
const MIN = 60_000;

const SAMPLE_ROLES: ReadonlyArray<StudioRole> = [
  {
    id: 'role-producer',
    name: 'Producer',
    description: 'Owns mission intake, sequencing, and studio priorities.',
    category: 'production',
    capabilities: ['browser', 'git'],
    members: 1,
    status: 'planning',
    availability: '1 of 1 available',
    currentMission: 'Draft Sprint 12 mission plan',
    lastActivity: now - 3 * MIN,
  },
  {
    id: 'role-lead-architect',
    name: 'Lead Architect',
    description: 'Owns system design, constraints, and technical direction.',
    category: 'engineering',
    capabilities: ['filesystem', 'terminal', 'git'],
    members: 1,
    status: 'working',
    availability: '1 of 1 available',
    currentMission: 'Design the Workflow Engine integration',
    lastActivity: now - 12 * MIN,
  },
  {
    id: 'role-gameplay-engineer',
    name: 'Gameplay Engineer',
    description: 'Owns interactive systems, player controllers, and combat logic.',
    category: 'engineering',
    capabilities: ['filesystem', 'terminal', 'git'],
    members: 3,
    status: 'working',
    availability: '2 of 3 available',
    currentMission: 'Implement dash mechanic',
    lastActivity: now - 1 * MIN,
  },
  {
    id: 'role-rendering-engineer',
    name: 'Rendering Engineer',
    description: 'Owns the render pipeline, shaders, and performance budgets.',
    category: 'engineering',
    capabilities: ['three-js', 'filesystem', 'git'],
    members: 2,
    status: 'waiting',
    availability: '1 of 2 available',
    currentMission: 'Awaiting art-direction pillars',
    lastActivity: now - 38 * MIN,
  },
  {
    id: 'role-technical-artist',
    name: 'Technical Artist',
    description: 'Bridges art and code: shaders, tools, and pipeline automation.',
    category: 'art',
    capabilities: ['blender', 'three-js', 'filesystem'],
    members: 2,
    status: 'blocked',
    availability: '0 of 2 available',
    currentMission: 'Asset import pipeline (blocked on Tools Engineer)',
    lastActivity: now - 95 * MIN,
  },
  {
    id: 'role-qa-engineer',
    name: 'QA Engineer',
    description: 'Owns test coverage, regression gating, and build health.',
    category: 'quality',
    capabilities: ['terminal', 'git', 'browser'],
    members: 2,
    status: 'ready',
    availability: '2 of 2 available',
    currentMission: null,
    lastActivity: now - 22 * MIN,
  },
];

export class PlaceholderStudioRolesAdapter implements PlaceholderAdapter<StudioRole> {
  readonly source = 'placeholder' as const;
  list(): ReadonlyArray<StudioRole> {
    return SAMPLE_ROLES;
  }
}
