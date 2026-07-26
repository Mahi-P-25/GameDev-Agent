import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { CornerDownLeft, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import { useNovaMotion } from '../../design/motion';
import { NovaMark } from '../../components/brand';
import type { CommandIntent, Command as CommandModel } from './types';

/**
 * CommandPalette — the visual surface of the Nova Command Center.
 *
 * A centered, blurred modal built on Radix Dialog (focus trap + Esc + scroll
 * lock) and `cmdk` (accessible filtering), animated with Motion. It is a pure
 * view: given a flat list of {@link CommandModel}s it groups, renders, and
 * reports selection. All ranking/search already happened upstream in
 * `CommandSearch`, so this component only presents.
 *
 * Keyboard model (handled by cmdk + Radix):
 *   ↑ / ↓   move selection      Enter  run selected
 *   Esc     close               typing  filters instantly
 * Mouse is fully supported (hover + click).
 */

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Flat, already-ranked command list (from the registry + search). */
  readonly commands: ReadonlyArray<CommandModel>;
  /** When true, the leading block is labeled "Recent". */
  readonly showRecents: boolean;
  readonly placeholder?: string;
  /**
   * A calm line reflecting the studio's real state — the palette reads as the
   * studio's mind, not a menu. Truthful, derived from live state; never
   * fabricated. Shown above the input as a quiet intent surface.
   */
  readonly intent?: string;
}

const intentText: Record<CommandIntent, string> = {
  neutral: 'text-fg-subtle',
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  showRecents,
  placeholder = 'Search commands, projects, files, missions…',
  intent,
}: CommandPaletteProps): ReactNode {
  const presets = useNovaMotion();
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Reset the query each time the palette opens for a clean first keystroke.
  useEffect(() => {
    if (open) {
      setSearch('');
    }
  }, [open]);

  const groups = useMemo(() => groupCommands(commands, showRecents), [commands, showRecents]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md"
                {...presets.overlay}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              aria-label="Nova Command Center"
              onOpenAutoFocus={(e) => {
                // Let cmdk own focus; prevent Radix from stealing it from the input.
                e.preventDefault();
              }}
            >
              <motion.div
                className={cn(
                  'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl',
                  '-translate-x-1/2 -translate-y-1/2',
                  'overflow-hidden rounded-2xl border border-border-strong',
                  'bg-bg-elevated/95 shadow-2xl shadow-black/40 backdrop-blur-xl',
                  'flex flex-col',
                )}
                {...presets.surface}
              >
                <Dialog.Title className="sr-only">Nova Command Center</Dialog.Title>

                <Command
                  className="flex flex-col"
                  loop
                  filter={(value, query) =>
                    // Ranking is done upstream; cmdk only needs to match the
                    // already-filtered list. We match on the cmdk value (title).
                    value.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
                  }
                  shouldFilter={search.trim().length > 0}
                >
                  {intent !== undefined && (
                    <div className="flex items-center gap-2.5 px-4 pt-4 text-[13px] text-fg-muted">
                      <span className="nova-mark text-primary" aria-hidden>
                        <NovaMark size="sm" />
                      </span>
                      <span className="truncate">{intent}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 border-b border-border px-4">
                    <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                    <Command.Input
                      autoFocus
                      value={search}
                      onValueChange={setSearch}
                      placeholder={placeholder}
                      className="h-14 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
                    />
                    <kbd className="rounded border border-border bg-bg-inset px-1.5 py-0.5 text-[10px] text-fg-subtle">
                      ESC
                    </kbd>
                  </div>

                  <Command.List
                    ref={listRef}
                    className="max-h-[min(60vh,26rem)] overflow-y-auto p-2"
                  >
                    <Command.Empty className="px-3 py-8 text-center text-[13px] text-fg-subtle">
                      No matching commands.
                    </Command.Empty>
                    {groups.map(([group, items]) => (
                      <Command.Group
                        key={group}
                        heading={group}
                        className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle"
                      >
                        {items.map((item) => (
                          <CommandItemRow key={item.id} item={item} />
                        ))}
                      </Command.Group>
                    ))}
                  </Command.List>
                </Command>

                <PaletteFooter />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function CommandItemRow({ item }: { item: CommandModel }): ReactNode {
  return (
    <Command.Item
      value={item.title}
      keywords={[item.group, item.subtitle ?? '', ...(item.keywords ?? [])]}
      disabled={item.disabled === true}
      onSelect={() => item.run()}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13px] text-fg-muted',
        'data-[selected=true]:bg-primary-soft data-[selected=true]:text-fg',
        'data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40',
        'transition-colors duration-instant',
      )}
    >
      {item.icon !== undefined && (
        <span className="grid size-5 shrink-0 place-items-center text-fg-subtle">{item.icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.title}</span>
        {item.subtitle !== undefined && (
          <span className="block truncate text-xs text-fg-subtle">{item.subtitle}</span>
        )}
      </span>
      {item.badge !== undefined && (
        <span
          className={cn(
            'shrink-0 rounded-full border border-border bg-bg-inset px-2 py-0.5 text-[10px]',
            item.intent !== undefined ? intentText[item.intent] : 'text-fg-subtle',
          )}
        >
          {item.badge}
        </span>
      )}
      {item.recent === true && (
        <span className="shrink-0 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] text-primary">
          Recent
        </span>
      )}
      {item.shortcut !== undefined && (
        <span className="flex shrink-0 gap-1">
          {item.shortcut.map((k) => (
            <kbd
              key={k}
              className="rounded border border-border bg-bg-inset px-1.5 py-0.5 text-[10px] text-fg-subtle"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}

function PaletteFooter(): ReactNode {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-fg-subtle">
      <span className="flex items-center gap-3">
        <Hint keys={['↑', '↓']} label="navigate" />
        <Hint keys={['↵']} label="select" />
        <Hint keys={['esc']} label="close" />
      </span>
      <span className="flex items-center gap-1.5">
        <CornerDownLeft className="size-3" aria-hidden />
        Nova Command Center
      </span>
    </div>
  );
}

function Hint({ keys, label }: { keys: ReadonlyArray<string>; label: string }): ReactNode {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="rounded border border-border bg-bg-inset px-1.5 py-0.5 text-[10px]"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}

/** Group the (already ordered) commands for display. */
function groupCommands(
  commands: ReadonlyArray<CommandModel>,
  showRecents: boolean,
): ReadonlyArray<[string, ReadonlyArray<CommandModel>]> {
  const map = new Map<string, CommandModel[]>();
  for (const command of commands) {
    let key = command.group;
    if (showRecents && command.recent === true) {
      key = 'Recent';
    }
    const list = map.get(key) ?? [];
    list.push(command);
    map.set(key, list);
  }
  // Keep "Recent" first when present for a familiar, calm browse state.
  const entries = [...map.entries()];
  entries.sort((a, b) => {
    if (a[0] === 'Recent') return -1;
    if (b[0] === 'Recent') return 1;
    return 0;
  });
  return entries;
}
