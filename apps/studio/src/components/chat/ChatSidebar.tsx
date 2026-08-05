import { Plus, MessageSquare, Trash2, Pin, PinOff, Search, Pencil, Check, X, FolderGit2, Cpu, Brain, Workflow as WorkflowIcon, Settings, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../design/cn';
import { NovaWordmark, NovaMark } from '../brand';

import type { ChatThread } from '../../services/ConversationStore';
export type { ChatThread };

interface ChatSidebarProps {
  readonly threads: ReadonlyArray<ChatThread>;
  readonly activeThreadId: string | null;
  readonly onSelectThread: (id: string) => void;
  readonly onNewChat: () => void;
  readonly onDeleteThread: (id: string) => void;
  readonly onRenameThread?: ((id: string, title: string) => void) | undefined;
  readonly onTogglePin?: ((id: string) => void) | undefined;
  readonly searchThreads?: ((query: string) => ReadonlyArray<ChatThread>) | undefined;
}

export function ChatSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onRenameThread,
  onTogglePin,
  searchThreads,
}: ChatSidebarProps): React.ReactNode {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editingRef = useRef<HTMLInputElement>(null);

  const hasSearch = searchThreads !== undefined;
  const visibleThreads = hasSearch && query.trim()
    ? searchThreads(query)
    : threads;

  const pinned = visibleThreads.filter((t) => t.pinned === true);
  const unpinned = visibleThreads.filter((t) => t.pinned !== true);

  const categorizeThreadTime = (thread: ChatThread): 'today' | 'yesterday' | 'older' => {
    const rawId = thread.id.replace('thread-', '');
    const timestampPart = rawId.split('-')[0];
    const ts = timestampPart ? parseInt(timestampPart, 10) : NaN;
    const date = !Number.isNaN(ts) && ts > 1000000000000 ? new Date(ts) : null;

    if (!date) {
      if (thread.updatedAt === 'Just now' || /AM|PM/i.test(thread.createdAt)) {
        return 'today';
      }
      return 'older';
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const time = date.getTime();

    if (time >= startOfToday) return 'today';
    if (time >= startOfYesterday) return 'yesterday';
    return 'older';
  };

  const todayThreads = unpinned.filter((t) => categorizeThreadTime(t) === 'today');
  const yesterdayThreads = unpinned.filter((t) => categorizeThreadTime(t) === 'yesterday');
  const olderThreads = unpinned.filter((t) => categorizeThreadTime(t) === 'older');

  useEffect(() => {
    if (editingId !== null) {
      editingRef.current?.focus();
      editingRef.current?.select();
    }
  }, [editingId]);

  const startRename = (thread: ChatThread): void => {
    if (!onRenameThread) return;
    setEditingId(thread.id);
    setEditingTitle(thread.title);
  };

  const commitRename = (threadId: string): void => {
    const title = editingTitle.trim();
    if (title && title !== threads.find((t) => t.id === threadId)?.title) {
      onRenameThread?.(threadId, title);
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const renderThread = (thread: ChatThread): React.ReactNode => {
    const isActive = thread.id === activeThreadId;
    const isEditing = editingId === thread.id;

    return (
      <div
        key={thread.id}
        className={cn(
          'group relative flex items-center rounded-xl transition-colors duration-fast',
          isActive ? 'bg-accent/15 text-accent font-medium' : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
          thread.pinned === true && 'border border-border/70'
        )}
      >
        {isEditing ? (
          <div className="flex w-full items-center gap-1.5 px-2 py-1.5">
            <input
              ref={editingRef}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(thread.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="min-w-0 flex-1 rounded-md border border-accent/50 bg-bg-surface px-2 py-1 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => commitRename(thread.id)}
              className="rounded p-1 text-success hover:bg-bg-hover"
              title="Save name"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg"
              title="Cancel"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelectThread(thread.id)}
              onDoubleClick={() => startRename(thread)}
              className={cn(
                'flex flex-1 items-center gap-2.5 text-left py-2',
                collapsed ? 'justify-center px-0' : 'px-3'
              )}
              title={thread.pinned === true ? `${thread.title} (pinned)` : thread.title}
            >
              <MessageSquare className="size-4 shrink-0 text-accent" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{thread.title}</div>
                  <div className="text-[10px] text-fg-subtle">{thread.updatedAt}</div>
                </div>
              )}
            </button>
            {!collapsed && (
              <div className="mr-1.5 hidden items-center gap-0.5 group-hover:flex">
                {onRenameThread && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(thread);
                    }}
                    className="rounded p-1 text-fg-subtle hover:bg-bg-surface hover:text-fg"
                    title="Rename conversation"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(thread.id);
                    }}
                    className={cn(
                      'rounded p-1 text-fg-subtle hover:bg-bg-surface hover:text-fg',
                      thread.pinned === true && 'text-accent'
                    )}
                    title={thread.pinned === true ? 'Unpin conversation' : 'Pin conversation'}
                  >
                    {thread.pinned === true ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(thread.id);
                  }}
                  className="rounded p-1 text-fg-subtle hover:bg-bg-surface hover:text-danger"
                  title="Delete thread"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderGroup = (title: string, items: ReadonlyArray<ChatThread>): React.ReactNode => {
    if (items.length === 0) return null;
    return (
      <div>
        <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
          {title}
        </span>
        <div className="flex flex-col gap-1">{items.map(renderThread)}</div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-bg-panel/95 backdrop-blur-xl transition-[width] duration-300 ease-standard',
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 py-3">
        {collapsed ? (
          <NavLink to="/" aria-label="Nova home" className="mx-auto">
            <NovaMark size="sm" />
          </NavLink>
        ) : (
          <NavLink to="/" className="flex items-center gap-2">
            <NovaWordmark size="sm" withMark withEyebrow={false} />
          </NavLink>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'grid size-7 place-items-center rounded-lg text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg',
            collapsed && 'rotate-180 mx-auto'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          type="button"
          onClick={onNewChat}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-semibold text-accent-fg shadow-sm transition-all duration-fast hover:opacity-90 active:scale-[0.98]',
            collapsed && 'px-0'
          )}
        >
          <Plus className="size-4" />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Search */}
      {!collapsed && hasSearch && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-2.5 py-1.5 transition-colors duration-fast focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30">
            <Search className="size-3.5 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              className="min-w-0 flex-1 bg-transparent text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-fg-subtle hover:text-fg" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex flex-1 flex-col overflow-y-auto px-2 py-2">
        {query.trim() ? (
          <div className="flex flex-col gap-3">
            {visibleThreads.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-fg-subtle">No conversations match “{query}”.</p>
            ) : (
              renderGroup('Results', visibleThreads)
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {renderGroup('Pinned', pinned)}
            {renderGroup('Today', todayThreads)}
            {renderGroup('Yesterday', yesterdayThreads)}
            {renderGroup('Older', olderThreads)}
          </div>
        )}
      </div>

      {/* Navigation Shortcuts */}
      <div className="border-t border-border p-2">
        {!collapsed && (
          <span className="mb-1.5 block px-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Cockpit Views
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl py-2 transition-colors duration-fast text-xs',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-bg-hover text-accent font-medium' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              )
            }
          >
            <FolderGit2 className="size-4" />
            {!collapsed && <span>Projects</span>}
          </NavLink>

          <NavLink
            to="/studio"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl py-2 transition-colors duration-fast text-xs',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-bg-hover text-accent font-medium' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              )
            }
          >
            <Cpu className="size-4" />
            {!collapsed && <span>Agents & Studio Team</span>}
          </NavLink>

          <NavLink
            to="/intelligence"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl py-2 transition-colors duration-fast text-xs',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-bg-hover text-accent font-medium' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              )
            }
          >
            <Brain className="size-4" />
            {!collapsed && <span>Project Intelligence</span>}
          </NavLink>

          <NavLink
            to="/workflows"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl py-2 transition-colors duration-fast text-xs',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-bg-hover text-accent font-medium' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              )
            }
          >
            <WorkflowIcon className="size-4" />
            {!collapsed && <span>Workflows</span>}
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl py-2 transition-colors duration-fast text-xs',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-bg-hover text-accent font-medium' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              )
            }
          >
            <Settings className="size-4" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
