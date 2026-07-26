import type { Command } from './types';

/**
 * RecentCommands — pure selectors that turn the raw command list + history into
 * a recency-aware view.
 *
 * The Command Center shows a "Recent" group at the top of the browse state. We
 * implement that by reordering: commands whose id is in `recentIds` float up and
 * are tagged `recent`. The underlying command objects are never mutated — we
 * return shallow copies with `recent` set.
 */

export function withRecents(
  commands: ReadonlyArray<Command>,
  recentIds: ReadonlyArray<string>,
): ReadonlyArray<Command> {
  if (recentIds.length === 0) {
    return commands;
  }
  const byId = new Map(commands.map((command) => [command.id, command]));
  const recent: Command[] = [];
  for (const id of recentIds) {
    const command = byId.get(id);
    if (command !== undefined && command.disabled !== true) {
      recent.push({ ...command, recent: true });
    }
  }
  const recentSet = new Set(recentIds);
  const rest = commands.filter((command) => !recentSet.has(command.id));
  return [...recent, ...rest];
}
