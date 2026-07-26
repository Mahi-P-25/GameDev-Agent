import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../components/ui/toastStore';
import { useStudioData } from '../../studio/StudioDataProvider';
import { useStudioPresence } from '../studio-presence/PresenceStore';
import { type StudioMode, deriveSuggestion, studioMood } from '../studio-presence/ambient';
import { useCommandHistory } from './CommandHistory';
import { CommandPalette } from './CommandPalette';
import { useCommandRegistry } from './CommandRegistry';
import { searchCommands } from './CommandSearch';
import { withRecents } from './RecentCommands';
import { builtInProviders } from './providers';
import type { CommandContext } from './types';

/**
 * CommandCenterModule — the orchestrator that wires the Command Center core
 * (registry + search + history) to the live Nova app and renders the palette.
 *
 * It is the public surface of the feature: mount `<CommandCenterModule />` once
 * (the shared page chrome does this), call `useCommandCenter()` anywhere to
 * open/close it, and it handles Ctrl/Cmd+K, ranking, recency, and execution.
 *
 * Extending the palette never requires touching this file: register a new
 * `CommandProvider` on `builtInProviders` (or pass a custom `providers` prop).
 */

export interface CommandCenterModuleProps {
  /** Override the providers. Defaults to Nova's built-in set. */
  readonly providers?: ReadonlyArray<import('./types').CommandProvider>;
}

export function CommandCenterModule(props: CommandCenterModuleProps): ReactNode {
  const { providers = builtInProviders } = props;
  const controller = useCommandCenter(providers);
  const { snapshot, overall } = useStudioPresence();

  // The palette reads as the studio's mind: a calm, truthful line reflecting
  // real state — never fabricated AI chatter. Derived from the same presence
  // the Home screen uses.
  const intent = useMemo(() => {
    const mode = studioMood(snapshot, overall);
    const focal =
      snapshot.missionTitle !== null
        ? `“${snapshot.missionTitle}”`
        : snapshot.projectName !== null
          ? snapshot.projectName
          : null;
    const base: Record<StudioMode, string> = {
      reviewing: 'The studio is waiting on your review.',
      building: 'The studio is building right now.',
      planning: 'We are shaping direction.',
      waiting: 'The studio is between actions.',
      blocked: 'Something is blocked.',
      idle: 'The studio is ready.',
    };
    const tail = focal !== null ? ` Focused on ${focal}.` : '';
    const suggestion = deriveSuggestion(snapshot);
    const verb = suggestion !== null ? (suggestion.label.split(' ')[0] ?? 'do') : null;
    const ask = verb !== null ? ` What should we ${verb.toLowerCase()}?` : ' What do you need?';
    return `${base[mode]}${tail}${ask}`;
  }, [snapshot, overall]);

  return (
    <CommandPalette
      open={controller.open}
      onOpenChange={controller.setOpen}
      commands={controller.visibleCommands}
      showRecents={controller.showRecents}
      intent={intent}
      placeholder="Tell Nova what you need, or type to search…"
    />
  );
}

export interface CommandCenterController {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly toggle: () => void;
  /** Commands to render right now (search + recency applied). */
  readonly visibleCommands: ReadonlyArray<import('./types').Command>;
  /** Whether the current view is the browse state (recents float up). */
  readonly showRecents: boolean;
}

export function useCommandCenter(
  providers: ReadonlyArray<import('./types').CommandProvider> = builtInProviders,
): CommandCenterController {
  const navigate = useNavigate();
  const { api } = useStudioData();
  const history = useCommandHistory();
  const registry = useCommandRegistry(providers);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const toggle = useCallback(() => setOpen((value) => !value), []);

  const context = useMemo<CommandContext>(
    () => ({
      api,
      navigate,
      notify: ({ title, description, intent }) => {
        if (intent === 'danger' || intent === 'warning') {
          toast.error(title, description);
        } else if (intent === 'success') {
          toast.success(title, description);
        } else {
          toast.info(title, description);
        }
      },
    }),
    [api, navigate],
  );

  const allCommands = useMemo(() => registry.resolve(context), [registry, context]);

  const visibleCommands = useMemo(() => {
    const browsed = withRecents(allCommands, history.recent);
    const result = searchCommands(browsed, { search, recentIds: history.recent });
    return result.commands;
  }, [allCommands, history.recent, search]);

  // Recording happens at open time of the chosen command. We wrap each command's
  // run so history is updated and the palette closes after execution.
  const wrapped = useMemo(
    () =>
      visibleCommands.map((command) => ({
        ...command,
        run: () => {
          history.record(command.id);
          try {
            command.run();
          } catch (error) {
            toast.error('Command failed', error instanceof Error ? error.message : String(error));
          }
          setOpen(false);
          setSearch('');
        },
      })),
    [visibleCommands, history],
  );

  // When the palette opens, clear any stale query so the browse state shows.
  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (!value) {
      setSearch('');
    }
  }, []);

  return {
    open,
    setOpen: handleOpenChange,
    toggle,
    visibleCommands: wrapped,
    showRecents: search.trim().length === 0,
  };
}
