import { ChevronDown, ChevronRight, Folder, FolderOpen, FileCode, FileText, FileJson, Image } from 'lucide-react';
import { cn } from '../../design/cn';

export interface FileItem {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;
  readonly extension?: string;
  readonly size?: string;
  readonly content?: string;
  readonly children?: ReadonlyArray<FileItem>;
}

interface ExplorerNodeProps {
  readonly item: FileItem;
  readonly depth?: number;
  readonly selectedId?: string | null | undefined;
  readonly expandedIds: ReadonlySet<string>;
  readonly onToggleFolder: (id: string) => void;
  readonly onSelectFile: (file: FileItem) => void;
}

function getFileIcon(extension?: string, isDirectory?: boolean, isOpen?: boolean) {
  if (isDirectory) {
    return isOpen ? FolderOpen : Folder;
  }
  const ext = extension?.toLowerCase() || '';
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return FileCode;
  if (['json', 'geojson'].includes(ext)) return FileJson;
  if (['png', 'jpg', 'svg', 'webp'].includes(ext)) return Image;
  return FileText;
}

export function ExplorerNode({
  item,
  depth = 0,
  selectedId,
  expandedIds,
  onToggleFolder,
  onSelectFile,
}: ExplorerNodeProps): React.ReactNode {
  const isExpanded = expandedIds.has(item.id);
  const isSelected = selectedId === item.id;
  const IconComp = getFileIcon(item.extension, item.isDirectory, isExpanded);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.isDirectory) {
      onToggleFolder(item.id);
    } else {
      onSelectFile(item);
    }
  };

  return (
    <div className="flex flex-col select-none">
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={cn(
          'group flex items-center gap-2 py-1 pr-3 text-xs font-mono transition-colors duration-fast cursor-pointer rounded-lg mx-1',
          isSelected
            ? 'bg-accent/20 text-accent font-semibold'
            : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
        )}
      >
        {item.isDirectory ? (
          <span className="text-fg-subtle group-hover:text-fg">
            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </span>
        ) : (
          <span className="w-3.5" />
        )}

        <IconComp
          className={cn(
            'size-4 shrink-0',
            item.isDirectory ? 'text-accent' : isSelected ? 'text-accent' : 'text-fg-subtle group-hover:text-fg',
          )}
        />

        <span className="truncate flex-1">{item.name}</span>
      </div>

      {item.isDirectory && isExpanded && item.children && item.children.length > 0 && (
        <div className="flex flex-col">
          {item.children.map((child) => (
            <ExplorerNode
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
