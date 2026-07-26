import type { StudioWorkflowKind } from '@gamedev-agent/studio-api';
import { FolderOpen, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { OpeningStage, QuietList } from '../../components/primitives';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNovaMotion } from '../../design/motion';
import { useStudioData } from '../../studio/StudioDataProvider';
import { PresenceSkeleton } from './PresenceCards';
import { useStudioPresence } from './PresenceStore';
import { StudioActivity, StudioContext, StudioHero } from './StudioHero';
import { deriveAwayFor, deriveSuggestion, formatAway, studioMood } from './ambient';

/**
 * Studio Presence — the Home command center for studio state.
 *
 * It reads ONLY real Nova state (via {@link useStudioPresence}, backed by the
 * same `StudioApi` the rest of the app uses) and renders it. No AI agents, no
 * synthetic activity. Every card consumes the `ModulePresence` / snapshot
 * contract, so a future AI system can drive those values without UI changes.
 *
 * The exported {@link useStudioPresence} hook is the public seam other parts of
 * the studio can reuse.
 */
export function StudioPresenceModule() {
  const { api } = useStudioData();
  const navigate = useNavigate();
  const { snapshot, modules, overall, loading } = useStudioPresence();
  const m = useNovaMotion();

  if (loading) {
    return <PresenceSkeleton />;
  }

  if (snapshot.onboarding) {
    return (
      <EmptyState
        icon={<FolderOpen className="size-5" />}
        title="Welcome to Nova"
        hint="Create your first project to give the studio a focus. Everything else flows from it."
        action={
          <Button
            variant="primary"
            leftIcon={<Plus className="size-4" />}
            onClick={() => navigate('/projects')}
          >
            Create a project
          </Button>
        }
      />
    );
  }

  const runTemplate = (id: string): void => {
    if (snapshot.projectId === null) return;
    const template = snapshot.templates.find((t) => t.id === id);
    if (template === undefined) return;
    void api
      .startWorkflow({ kind: template.kind as StudioWorkflowKind, projectId: snapshot.projectId })
      .then(() => navigate('/workflows'))
      .catch(() => navigate('/workflows'));
  };
  void runTemplate;

  const mood = studioMood(snapshot, overall);
  const away = deriveAwayFor(snapshot);
  const suggestion = deriveSuggestion(snapshot);

  return (
    <OpeningStage data-studio={mood} data-arrival="true">
      <div className="mx-auto w-full max-w-[1080px] px-6 md:px-10">
        <motion.div {...m.stagger} initial="initial" animate="animate" className="nova-rhythm-y-lg">
          <motion.div {...m.staggerItem}>
            <StudioHero
              snapshot={snapshot}
              onContinue={() => navigate('/mission-control')}
              live={mood !== 'idle'}
              {...(away !== null ? { awayFor: formatAway(away) } : {})}
              {...(suggestion !== null ? { suggestion } : {})}
              {...(suggestion !== null ? { onSuggestion: () => navigate(suggestion.to) } : {})}
            />
          </motion.div>

          <motion.div {...m.staggerItem}>
            <StudioContext snapshot={snapshot} modules={modules} />
          </motion.div>

          <motion.div {...m.staggerItem}>
            <section className="matte rounded-xl p-5">
              <span className="font-headline text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
                Recent Activity
              </span>
              <div className="mt-3">
                <QuietList>
                  <StudioActivity snapshot={snapshot} />
                </QuietList>
              </div>
            </section>
          </motion.div>
        </motion.div>
      </div>
    </OpeningStage>
  );
}

export { useStudioPresence } from './PresenceStore';
