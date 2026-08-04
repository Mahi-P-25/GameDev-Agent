import { Plus, MessageSquare, Trash2, FolderGit2, Cpu, Brain, Workflow as WorkflowIcon, Settings, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
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
}

export function ChatSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
}: ChatSidebarProps): React.ReactNode {
  const [collapsed, setCollapsed] = useState(false);

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

      {/* Conversations List */}
      <div className="flex flex-1 flex-col overflow-y-auto px-2 py-2">
        {!collapsed && (
          <span className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Recent Conversations
          </span>
        )}

        <div className="flex flex-col gap-1">
          {threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                className={cn(
                  'group relative flex items-center rounded-xl transition-colors duration-fast',
                  isActive ? 'bg-accent/15 text-accent font-medium' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className={cn(
                    'flex flex-1 items-center gap-2.5 text-left py-2',
                    collapsed ? 'justify-center px-0' : 'px-3'
                  )}
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                    className="mr-2 hidden rounded p-1 text-fg-subtle hover:bg-bg-surface hover:text-fg group-hover:block"
                    title="Delete thread"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
