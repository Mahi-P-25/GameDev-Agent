import { motion } from 'motion/react';
import { FolderOpen, FolderInput, FolderPlus, Sparkles } from 'lucide-react';

interface WorkspaceEmptyStateProps {
  readonly onOpenFolder?: () => void;
  readonly onImportProject?: () => void;
  readonly onCreateProject?: () => void;
}

export function WorkspaceEmptyState({
  onOpenFolder,
  onImportProject,
  onCreateProject,
}: WorkspaceEmptyStateProps): React.ReactNode {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-bg-base p-8 text-center select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-w-xl flex-col items-center gap-5"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface px-4 py-1 text-xs font-medium text-fg-subtle backdrop-blur-md shadow-sm">
          <Sparkles className="size-3.5 text-accent animate-pulse" />
          <span>Nova AI-Native Workspace IDE</span>
        </div>

        <h2 className="text-balance text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          No Workspace Opened
        </h2>
        <p className="text-balance text-sm text-fg-muted leading-relaxed">
          Open a local directory, import a repository, or scaffold a game workspace to begin coding with Nova.
        </p>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 mt-4">
          <button
            type="button"
            onClick={onOpenFolder}
            className="group flex flex-col items-start gap-2.5 rounded-2xl border border-border bg-bg-panel/90 p-4 text-left shadow-sm backdrop-blur-md transition-all duration-base hover:-translate-y-1 hover:border-accent/50 hover:bg-bg-hover hover:shadow-lg"
          >
            <div className="grid size-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent group-hover:scale-105 transition-transform">
              <FolderOpen className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg group-hover:text-accent transition-colors">Open Folder</h3>
              <p className="mt-1 text-[11px] text-fg-subtle">Browse local filesystem</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onImportProject}
            className="group flex flex-col items-start gap-2.5 rounded-2xl border border-border bg-bg-panel/90 p-4 text-left shadow-sm backdrop-blur-md transition-all duration-base hover:-translate-y-1 hover:border-accent/50 hover:bg-bg-hover hover:shadow-lg"
          >
            <div className="grid size-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent group-hover:scale-105 transition-transform">
              <FolderInput className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg group-hover:text-accent transition-colors">Import Project</h3>
              <p className="mt-1 text-[11px] text-fg-subtle">Import from Git repo</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onCreateProject}
            className="group flex flex-col items-start gap-2.5 rounded-2xl border border-border bg-bg-panel/90 p-4 text-left shadow-sm backdrop-blur-md transition-all duration-base hover:-translate-y-1 hover:border-accent/50 hover:bg-bg-hover hover:shadow-lg"
          >
            <div className="grid size-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent group-hover:scale-105 transition-transform">
              <FolderPlus className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg group-hover:text-accent transition-colors">Create Project</h3>
              <p className="mt-1 text-[11px] text-fg-subtle">Scaffold game template</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
