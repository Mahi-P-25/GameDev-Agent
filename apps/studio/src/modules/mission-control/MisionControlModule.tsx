import { FolderOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNovaMotion } from '../../design/motion';
import {
  DependencyView,
  MissionCard,
  MissionControlSkeleton,
  NextStepCard,
  ObjectiveList,
} from './MisionCards';
import { useMissionControl } from './MisionStore';

/**
 * Mission Control — the primary productivity surface for game development.
 *
 * It answers one question immediately: "What should I work on next?" That answer
 * is the {@link NextStepCard}, derived from the live {@link MissionView}. The
 * rest of the surface (mission detail, objectives, dependencies, progress) is
 * read entirely from real Nova state via {@link useMissionControl} — no AI agents,
 * no synthetic data.
 *
 * The exported {@link useMissionControl} hook is the public seam other parts of
 * the studio can reuse; a future AI system overrides `resolveMission` without
 * any component here changing.
 */
export function MissionControlModule() {
  const navigate = useNavigate();
  const { view, loading, snapshot } = useMissionControl();
  const m = useNovaMotion();

  if (loading) {
    return <MissionControlSkeleton />;
  }

  if (!snapshot.hasProjects) {
    return (
      <EmptyState
        icon={<FolderOpen className="size-5" />}
        title="Set up a project first"
        hint="Mission Control tracks work against a project. Create one to begin."
        action={
          <Button
            variant="primary"
            leftIcon={<FolderOpen className="size-4" />}
            onClick={() => navigate('/projects')}
          >
            Create a project
          </Button>
        }
      />
    );
  }

  const open = (to: string): void => {
    navigate(to);
  };

  return (
    <motion.div {...m.stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div {...m.staggerItem}>
        <NextStepCard
          nextStep={view.nextStep}
          onOpen={() => open(view.nextStep?.to ?? '/missions')}
        />
      </motion.div>

      <motion.div {...m.staggerItem}>
        <MissionCard view={view} />
      </motion.div>

      <motion.div {...m.staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ObjectiveList objectives={view.objectives} />
        </div>
        <DependencyView dependencies={view.dependencies} />
      </motion.div>
    </motion.div>
  );
}

export { useMissionControl } from './MisionStore';
