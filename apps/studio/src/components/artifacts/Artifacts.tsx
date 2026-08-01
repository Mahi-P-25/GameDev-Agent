import { Braces, FileCode2, FileText, Image } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import { Card } from '../ui/Card';

export type ArtifactKind = 'code' | 'asset' | 'document';

export interface Artifact {
  readonly name: string;
  readonly kind: ArtifactKind;
  readonly meta?: string;
}

const DEFAULT_ARTIFACTS: ReadonlyArray<Artifact> = [
  { name: 'uniform-cache.ts', kind: 'code', meta: '18 lines' },
  { name: 'render-optimizer.ts', kind: 'code', meta: '42 lines' },
  { name: 'batch-update-system.md', kind: 'document', meta: 'design note' },
  { name: 'frame-budget.svg', kind: 'asset', meta: 'vector' },
];

const KIND_META: Record<ArtifactKind, { icon: ReactNode; className: string }> = {
  code: { icon: <FileCode2 className="size-3.5" />, className: 'text-accent' },
  asset: { icon: <Image className="size-3.5" />, className: 'text-info' },
  document: { icon: <FileText className="size-3.5" />, className: 'text-success' },
};

export interface ArtifactsProps {
  readonly files?: ReadonlyArray<Artifact>;
  readonly className?: string;
}

/**
 * Artifacts — the outputs Nova has produced, shown as clean file cards rather
 * than a raw file tree. Icon signals the kind; the path reads in mono; each row
 * is a quiet, hoverable target.
 */
export function Artifacts({ files = DEFAULT_ARTIFACTS, className }: ArtifactsProps): ReactNode {
  return (
    <Card
      title="Artifacts"
      subtitle={`${files.length} produced so far`}
      actions={
        <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-subtle">
          <Braces className="size-3" />
          files
        </span>
      }
      className={className}
    >
      <ul className="space-y-1.5">
        {files.map((file, index) => {
          const meta = KIND_META[file.kind];
          return (
            <motion.li
              key={file.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left',
                  'transition-colors duration-fast hover:border-border hover:bg-bg-hover',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              >
                <span className={cn('shrink-0', meta.className)} aria-hidden>
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">
                  {file.name}
                </span>
                {file.meta !== undefined && (
                  <span className="shrink-0 text-[11px] text-fg-subtle">{file.meta}</span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}
