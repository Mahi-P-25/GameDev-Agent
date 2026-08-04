import { motion } from 'motion/react';
import { Sparkles, Terminal, Code2, Cpu, Wrench } from 'lucide-react';

interface WelcomeViewProps {
  readonly onSelectPrompt: (prompt: string) => void;
}

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
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Late night dev';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 py-12 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface/80 px-3.5 py-1 text-xs font-medium text-fg-subtle backdrop-blur-md shadow-sm">
          <Sparkles className="size-3.5 text-accent animate-pulse" />
          <span>Nova Autonomous AI GameDev OS</span>
        </div>

        <h1 className="text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          {getGreeting()}.
        </h1>
        <p className="text-balance text-lg text-fg-muted max-w-xl leading-relaxed">
          What would you like to build today? Describe your game, mechanics, or optimization task.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2"
      >
        {PROMPT_SUGGESTIONS.map((s, idx) => {
          const IconComp = s.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(s.title)}
              className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-bg-panel/70 p-4 text-left backdrop-blur-md transition-all duration-fast hover:border-accent/40 hover:bg-bg-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <div className="flex items-center gap-2 text-fg">
                <IconComp className="size-4 text-accent transition-transform duration-fast group-hover:scale-110" />
                <span className="text-sm font-semibold group-hover:text-accent transition-colors duration-fast">{s.title}</span>
              </div>
              <p className="text-xs text-fg-subtle leading-normal">{s.description}</p>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
