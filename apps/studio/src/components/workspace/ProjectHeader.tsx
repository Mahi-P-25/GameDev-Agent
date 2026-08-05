import { Boxes, GitBranch, Sparkles, CheckCircle2, HardDrive, Code2, Layers } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface ProjectHeaderProps {
  readonly projectName: string;
  readonly language?: string;
  readonly engine?: string;
  readonly gitBranch?: string;
  readonly buildStatus?: 'passing' | 'failing' | 'building';
  readonly intelligenceScore?: number;
  readonly rootPath?: string;
}

export function ProjectHeader({
  projectName,
  language = 'TypeScript',
  engine = 'Three.js / React',
  gitBranch = 'main',
  buildStatus = 'passing',
  intelligenceScore = 96,
  rootPath,
}: ProjectHeaderProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-2 border-b border-border/80 bg-bg-panel/95 px-4 py-3 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {/* Left: Project Title & Root Path */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/15 text-accent shadow-sm">
            <Boxes className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-fg">{projectName}</h2>
              <Badge intent="success" dot size="sm">
                Active Workspace
              </Badge>
            </div>
            {rootPath && (
              <div className="flex items-center gap-1 font-mono text-[11px] text-fg-subtle truncate">
                <HardDrive className="size-3 shrink-0" />
                <span className="truncate">{rootPath}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metrics Pills */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-bg-surface px-2.5 py-1 text-fg-muted">
            <Code2 className="size-3.5 text-accent" />
            <span>{language}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-bg-surface px-2.5 py-1 text-fg-muted">
            <Layers className="size-3.5 text-accent" />
            <span>{engine}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-bg-surface px-2.5 py-1 text-fg-muted">
            <GitBranch className="size-3.5 text-success" />
            <span className="font-semibold text-fg">{gitBranch}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/15 px-2.5 py-1 text-success font-semibold">
            <CheckCircle2 className="size-3.5" />
            <span className="uppercase text-[10px]">{buildStatus}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-accent font-bold">
            <Sparkles className="size-3.5 animate-pulse" />
            <span>{intelligenceScore}% indexed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
