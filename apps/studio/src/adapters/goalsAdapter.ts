import type { Goal, PlaceholderAdapter } from './types';

/**
 * Placeholder Goals adapter.
 *
 * The Goals subsystem is not implemented in Sprint 10. This adapter returns
 * typed, clearly-labelled preview data so the Goals page is fully rendered and
 * the contract is exercised. Replace `list()` with a live client call when the
 * Goals backend lands — the {@link Goal} type and UI components stay unchanged.
 */
const SAMPLE_GOALS: ReadonlyArray<Goal> = [
  {
    id: 'goal-ship-prototype',
    title: 'Ship vertical-slice prototype',
    description: 'Playable core loop with one level and the three signature mechanics.',
    status: 'on-track',
    progress: 62,
    dueLabel: 'Sprint 12',
  },
  {
    id: 'goal-combat-feel',
    title: 'Nail the combat feel',
    description: 'Hit-pause, knockback, and animation cancels to a shippable standard.',
    status: 'at-risk',
    progress: 38,
    dueLabel: 'Sprint 13',
    projectId: 'project-core',
  },
  {
    id: 'goal-art-pillars',
    title: 'Lock art-direction pillars',
    description: 'Finalize palette, material library, and lighting rig for the biome set.',
    status: 'achieved',
    progress: 100,
    dueLabel: 'Sprint 9',
  },
  {
    id: 'goal-tools-pipeline',
    title: 'Stand up the content pipeline',
    description: 'Asset import, LOD generation, and build farm integration.',
    status: 'paused',
    progress: 20,
    dueLabel: 'Sprint 14',
  },
];

export class PlaceholderGoalsAdapter implements PlaceholderAdapter<Goal> {
  readonly source = 'placeholder' as const;
  list(): ReadonlyArray<Goal> {
    return SAMPLE_GOALS;
  }
}
