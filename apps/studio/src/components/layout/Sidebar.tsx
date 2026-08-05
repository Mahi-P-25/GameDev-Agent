import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Boxes,
  LayoutDashboard,
  Rocket,
  Brain,
  Terminal,
  Settings,
  Sparkles,
  ChevronDown,
  Pin,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../design/cn';
import { useConversationStore } from '../../services/ConversationStoreProvider';

const COCKPIT_VIEWS = [
  { to: '/projects', label: 'Projects', icon: Boxes },
  { to: '/workspace', label: 'Workspace', icon: LayoutDashboard },
  { to: '/missions', label: 'Missions', icon: Rocket },
  { to: '/intelligence', label: 'Memory', icon: Brain },
  { to: '/workflows', label: 'Terminal', icon: Terminal },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar(): React.ReactNode {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const {
    threads,
    activeThreadId,
    createThread,
    switchThread,
    deleteThread,
    renameThread,
    togglePin,
    searchThreads,
  } = useConversationStore();

  const filteredThreads = searchQuery.trim() ? searchThreads(searchQuery) : threads;

  const pinned = filteredThreads.filter((t) => t.pinned);
  const unpinned = filteredThreads.filter((t) => !t.pinned);

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      renameThread(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border/80 bg-bg-panel/95 backdrop-blur-2xl select-none transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand Header */}
      <div className="flex h-12 items-center justify-between border-b border-border/80 px-4">
        {!collapsed ? (
          <NavLink to="/" className="flex items-center gap-2 font-bold text-fg text-base hover:opacity-80 transition-opacity">
            <Sparkles className="size-4 text-accent animate-pulse" />
            <span>Nova</span>
          </NavLink>
        ) : (
          <NavLink to="/" title="Nova Home">
            <Sparkles className="size-5 text-accent mx-auto" />
          </NavLink>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      {/* Main Sidebar Scroll Body */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-3 gap-4">
        {/* + New Chat Button */}
        <button
          type="button"
          onClick={() => createThread()}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-all hover:bg-accent/20 hover:scale-[1.02] shadow-sm',
            collapsed && 'px-0 justify-center',
          )}
        >
          <Plus className="size-4 text-accent" />
          {!collapsed && <span>New Chat</span>}
        </button>

        {/* Search Bar */}
        {!collapsed && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-xl border border-border bg-bg-surface py-1.5 pl-8 pr-3 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
          </div>
        )}

        {/* PINNED CONVERSATIONS */}
        {!collapsed && pinned.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
              Pinned
            </span>
            {pinned.map((t) => (
              <div
                key={t.id}
                onClick={() => switchThread(t.id)}
                className={cn(
                  'group flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium cursor-pointer transition-colors shadow-sm',
                  t.id === activeThreadId
                    ? 'border-accent/50 bg-accent/15 text-accent font-semibold'
                    : 'border-border/60 bg-bg-surface text-fg hover:border-accent/30 hover:bg-bg-hover',
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Rocket className="size-3.5 text-accent shrink-0" />
                  {editingId === t.id ? (
                    <form onSubmit={(e) => handleSaveRename(t.id, e)} className="flex-1">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={(e) => handleSaveRename(t.id, e)}
                        autoFocus
                        className="w-full bg-bg-base px-1.5 py-0.5 rounded text-xs text-fg outline-none border border-accent"
                      />
                    </form>
                  ) : (
                    <span className="truncate">{t.title}</span>
                  )}
                </div>

                {/* Hover Action Buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(t.id);
                    }}
                    className="p-1 text-fg-subtle hover:text-accent"
                    title="Unpin conversation"
                  >
                    <Pin className="size-3 text-accent fill-current" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(t.id, t.title, e)}
                    className="p-1 text-fg-subtle hover:text-fg"
                    title="Rename"
                  >
                    <Edit2 className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(t.id);
                    }}
                    className="p-1 text-fg-subtle hover:text-danger"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* UNPINNED CONVERSATIONS */}
        {!collapsed && unpinned.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
              Recent
            </span>
            {unpinned.map((t) => (
              <div
                key={t.id}
                onClick={() => switchThread(t.id)}
                className={cn(
                  'group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition-colors',
                  t.id === activeThreadId
                    ? 'bg-accent/15 text-accent font-semibold'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
                )}
              >
                {editingId === t.id ? (
                  <form onSubmit={(e) => handleSaveRename(t.id, e)} className="flex-1">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={(e) => handleSaveRename(t.id, e)}
                      autoFocus
                      className="w-full bg-bg-base px-1.5 py-0.5 rounded text-xs text-fg outline-none border border-accent"
                    />
                  </form>
                ) : (
                  <span className="truncate flex-1">{t.title}</span>
                )}

                {/* Hover Action Buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(t.id);
                    }}
                    className="p-1 text-fg-subtle hover:text-accent"
                    title="Pin conversation"
                  >
                    <Pin className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(t.id, t.title, e)}
                    className="p-1 text-fg-subtle hover:text-fg"
                    title="Rename"
                  >
                    <Edit2 className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(t.id);
                    }}
                    className="p-1 text-fg-subtle hover:text-danger"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cockpit Views Navigation */}
        <div className="mt-auto border-t border-border/60 pt-3 flex flex-col gap-1">
          {COCKPIT_VIEWS.map((item) => {
            const IconComp = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-accent/15 text-accent shadow-sm'
                      : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <IconComp className="size-4 shrink-0 text-accent" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* User Profile Card */}
      <div className="border-t border-border/80 p-3 select-none">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-bg-surface p-2 text-xs cursor-pointer hover:bg-bg-hover transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-7 place-items-center rounded-lg border border-accent/40 bg-accent/20 text-xs font-bold text-accent">
              MV
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-fg truncate">Mahi Vardhan</div>
                <div className="text-[10px] text-fg-subtle">Free Plan</div>
              </div>
            )}
          </div>
          {!collapsed && <ChevronDown className="size-3.5 text-fg-subtle" />}
        </div>
      </div>
    </aside>
  );
}
