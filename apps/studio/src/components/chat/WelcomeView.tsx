import { motion } from 'motion/react';
import { Sparkles, Terminal, Code2, Cpu, Wrench, FolderInput, FolderPlus, FolderOpen, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WelcomeViewProps {
  readonly onSelectPrompt: (prompt: string) => void;
}

const PRIMARY_ACTIONS = [
  {
    icon: FolderInput,
    title: 'Import Project',
    description: 'Import existing repository or local workspace into Nova OS',
    action: 'import',
  },
  {
    icon: FolderPlus,
    title: 'Create Project',
    description: 'Scaffold a new Three.js, React, or custom game template',
    action: 'create',
  },
  {
    icon: FolderOpen,
    title: 'Open Folder',
    description: 'Browse local filesystem directories and launch cockpit',
    action: 'open',
  },
  {
    icon: Bot,
    title: 'Ask Nova',
    description: 'Start an autonomous AI goal execution session directly',
    action: 'ask',
  },
];

const PROMPT_SUGGESTIONS = [
  {
    icon: Terminal,
    title: 'Create a multiplayer racing game',
    description: 'Scaffold Three.js canvas, physics loop, controls, and vehicle model',
  },
  {
    icon: Code2,
    title: 'Build a Three.js voxel terrain generator',
    description: 'Simplex noise heightmap, chunk meshing, and custom shader materials',
  },
  {
    icon: Cpu,
    title: 'Fix shader compilation and LOD pipeline',
    description: 'Debug GLSL compilation errors and optimize mesh vertex count',
  },
  {
    icon: Wrench,
    title: 'Refactor physics system & rigidbodies',
    description: 'Implement Rapier/Cannon physics integration with spatial partitioning',
  },
];

export function WelcomeView({ onSelectPrompt }: WelcomeViewProps): React.ReactNode {
  const navigate = useNavigate();

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Late night dev';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleAction = (action: string) => {
    if (action === 'import' || action === 'create' || action === 'open') {
      navigate('/projects');
    } else {
      onSelectPrompt('Help me initialize a new game project in Nova Studio');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 py-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-3.5"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface/80 px-4 py-1 text-xs font-medium text-fg-subtle backdrop-blur-md shadow-sm">
          <Sparkles className="size-3.5 text-accent animate-pulse" />
          <span>Nova Autonomous AI GameDev OS</span>
        </div>

        <h1 className="text-balance text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          {getGreeting()}.
        </h1>
        <p className="text-balance text-base text-fg-muted max-w-xl leading-relaxed">
          What would you like to build today? Select a quick action or describe your mission.
        </p>
      </motion.div>

      {/* Primary Action Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
      >
        {PRIMARY_ACTIONS.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.action}
              type="button"
              onClick={() => handleAction(act.action)}
              className="group flex flex-col items-start gap-2.5 rounded-2xl border border-border bg-bg-panel/90 p-4 text-left shadow-sm backdrop-blur-md transition-all duration-base hover:-translate-y-1 hover:border-accent/50 hover:bg-bg-hover hover:shadow-lg"
            >
              <div className="grid size-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent group-hover:scale-105 transition-transform">
                <Icon className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg group-hover:text-accent transition-colors">{act.title}</h3>
                <p className="mt-1 text-xs text-fg-subtle leading-normal">{act.description}</p>
              </div>
            </button>
          );
        })}
      </motion.div>

      {/* Suggested Prompts */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full flex-col gap-3 pt-2"
      >
        <div className="flex items-center gap-2 px-1 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">
          <Terminal className="size-3.5 text-accent" />
          <span>Quick Launch Templates</span>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {PROMPT_SUGGESTIONS.map((s, idx) => {
            const IconComp = s.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(s.title)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border/80 bg-bg-panel/60 p-3.5 text-left backdrop-blur-md transition-all duration-fast hover:border-accent/40 hover:bg-bg-hover hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-fg">
                  <IconComp className="size-4 text-accent transition-transform duration-fast group-hover:scale-110" />
                  <span className="text-xs font-semibold group-hover:text-accent transition-colors">{s.title}</span>
                </div>
                <p className="text-[11px] text-fg-subtle leading-normal">{s.description}</p>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
