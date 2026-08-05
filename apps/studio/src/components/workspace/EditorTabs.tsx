import { X, FileCode, FileText, FileJson } from 'lucide-react';
import { cn } from '../../design/cn';
import type { FileItem } from './ExplorerNode';

interface EditorTabsProps {
  readonly openFiles: ReadonlyArray<FileItem>;
  readonly activeFileId?: string | null;
  readonly dirtyFileIds?: ReadonlySet<string>;
  readonly onSelectTab: (fileId: string) => void;
  readonly onCloseTab: (fileId: string, e: React.MouseEvent) => void;
}

function getTabIcon(extension?: string) {
  const ext = extension?.toLowerCase() || '';
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return FileCode;
  if (['json'].includes(ext)) return FileJson;
  return FileText;
}

export function EditorTabs({
  openFiles,
  activeFileId,
  dirtyFileIds = new Set(),
  onSelectTab,
  onCloseTab,
}: EditorTabsProps): React.ReactNode {
  if (openFiles.length === 0) return null;

  return (
    <div className="flex h-9 w-full items-center overflow-x-auto border-b border-border bg-bg-panel/90 select-none scrollbar-none">
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;
        const isDirty = dirtyFileIds.has(file.id);
        const IconComp = getTabIcon(file.extension);

        return (
          <div
            key={file.id}
            onClick={() => onSelectTab(file.id)}
            className={cn(
              'group relative flex h-full items-center gap-2 border-r border-border px-3 text-xs font-mono transition-colors cursor-pointer shrink-0',
              isActive
                ? 'bg-bg-base text-accent font-semibold border-t-2 border-t-accent'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
            )}
          >
            <IconComp className={cn('size-3.5', isActive ? 'text-accent' : 'text-fg-subtle')} />
            <span className="truncate max-w-[140px]">{file.name}</span>

            {/* Dirty Indicator or Close Button */}
            <div className="flex items-center ml-1">
              {isDirty ? (
                <span className="size-2 rounded-full bg-accent animate-pulse group-hover:hidden" />
              ) : null}
              <button
                type="button"
                onClick={(e) => onCloseTab(file.id, e)}
                className={cn(
                  'rounded p-0.5 text-fg-subtle hover:bg-bg-hover hover:text-fg',
                  isDirty ? 'hidden group-hover:block' : 'opacity-60 group-hover:opacity-100',
                )}
                title="Close tab"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
