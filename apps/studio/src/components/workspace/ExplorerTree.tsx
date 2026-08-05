import { Search, X, FolderTree, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ExplorerNode, type FileItem } from './ExplorerNode';

interface ExplorerTreeProps {
  readonly items: ReadonlyArray<FileItem>;
  readonly selectedId?: string | null | undefined;
  readonly onSelectFile: (file: FileItem) => void;
  readonly className?: string;
}

export function ExplorerTree({
  items,
  selectedId,
  onSelectFile,
}: ExplorerTreeProps): React.ReactNode {
  const [query, setQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['dir-src', 'dir-components']));

  const handleToggleFolder = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter items by search query
  const filterItems = (nodes: ReadonlyArray<FileItem>, search: string): FileItem[] => {
    if (!search.trim()) return [...nodes];
    const q = search.trim().toLowerCase();
    const result: FileItem[] = [];

    for (const node of nodes) {
      if (node.isDirectory && node.children) {
        const matchingChildren = filterItems(node.children, q);
        if (matchingChildren.length > 0 || node.name.toLowerCase().includes(q)) {
          result.push({ ...node, children: matchingChildren });
        }
      } else if (node.name.toLowerCase().includes(q)) {
        result.push(node);
      }
    }
    return result;
  };

  const visibleItems = filterItems(items, query);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-bg-panel/95 backdrop-blur-xl select-none">
      {/* Explorer Header */}
      <div className="flex h-11 items-center justify-between border-b border-border/80 px-3 py-2 text-xs font-semibold text-fg">
        <div className="flex items-center gap-2">
          <FolderTree className="size-4 text-accent" />
          <span className="uppercase tracking-wider text-[11px]">Explorer</span>
        </div>
        <button
          type="button"
          onClick={() => setExpandedIds(new Set(['dir-src']))}
          className="rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg"
          title="Collapse Folders"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {/* Instant Search Filter */}
      <div className="p-2.5 border-b border-border/60">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-2.5 py-1.5 transition-colors focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20">
          <Search className="size-3.5 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full bg-transparent text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-fg-subtle hover:text-fg">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-2">
        {visibleItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-fg-subtle">No files match “{query}”.</div>
        ) : (
          visibleItems.map((item) => (
            <ExplorerNode
              key={item.id}
              item={item}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleFolder={handleToggleFolder}
              onSelectFile={onSelectFile}
            />
          ))
        )}
      </div>
    </aside>
  );
}
