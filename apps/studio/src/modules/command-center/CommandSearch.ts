import type { Command, CommandQuery, CommandSearchResult } from './types';

/**
 * CommandSearch — the pure ranking/filtering engine.
 *
 * Kept free of React and of any UI framework so it is trivially testable and
 * the Command Palette stays a thin view. The engine:
 *   1. When the query is blank, shows a *browse* state: recents first (tagged
 *      `recent`), then everything else in provider order.
 *   2. When there is a query, score every command by label/keyword overlap and
 *      recency, then return the highest matches ordered best-first.
 */

const RECENCY_BOOST = 50;
const EXACT_TITLE_BOOST = 100;
const PREFIX_TITLE_BOOST = 40;
const SUBTITLE_BOOST = 12;
const KEYWORD_BOOST = 18;

interface Scored {
  readonly command: Command;
  readonly score: number;
}

function normalize(value: string): string {
  const stripped = value
    .normalize('NFKD')
    .split('')
    .filter((ch) => ch.charCodeAt(0) < 0x300 || ch.charCodeAt(0) > 0x36f)
    .join('');
  return stripped.toLowerCase().trim();
}

function recencyRank(id: string, recentIds: ReadonlyArray<string>): number {
  const idx = recentIds.indexOf(id);
  return idx === -1 ? -1 : recentIds.length - idx;
}

/**
 * Score a single command against a normalized query. Returns a negative score
 * when the command does not match at all (caller filters these out).
 */
function scoreCommand(command: Command, query: string, recentIds: ReadonlyArray<string>): number {
  if (query.length === 0) {
    // Browse mode: recents surface first, everything else is eligible.
    const rank = recencyRank(command.id, recentIds);
    return rank === -1 ? 1 : RECENCY_BOOST + rank;
  }

  const title = normalize(command.title);
  const haystackPieces = [title];
  if (command.subtitle !== undefined) {
    haystackPieces.push(normalize(command.subtitle));
  }
  if (command.keywords !== undefined) {
    for (const kw of command.keywords) {
      haystackPieces.push(normalize(kw));
    }
  }
  const haystack = haystackPieces.join(' ');

  let score = 0;
  if (title === query) {
    score += EXACT_TITLE_BOOST;
  } else if (title.startsWith(query)) {
    score += PREFIX_TITLE_BOOST;
  } else if (title.includes(query)) {
    score += PREFIX_TITLE_BOOST / 2;
  }
  if (command.subtitle !== undefined && normalize(command.subtitle).includes(query)) {
    score += SUBTITLE_BOOST;
  }
  for (const kw of command.keywords ?? []) {
    const kn = normalize(kw);
    if (kn === query || kn.startsWith(query) || kn.includes(query)) {
      score += KEYWORD_BOOST;
    }
  }
  if (haystack.includes(query)) {
    score += 4;
  }

  const rank = recencyRank(command.id, recentIds);
  if (rank !== -1) {
    score += (RECENCY_BOOST + rank) / 2;
  }

  return score;
}

export function searchCommands(
  commands: ReadonlyArray<Command>,
  query: CommandQuery,
): CommandSearchResult {
  const raw = normalize(query.search);
  const isBrowse = raw.length === 0;

  const scored: ReadonlyArray<Scored> = commands
    .map((command) => ({
      command,
      score: scoreCommand(command, raw, query.recentIds),
    }))
    .filter((entry) => isBrowse || entry.score > 0);

  const ordered = [...scored].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Stable tie-break: keep provider/insertion order for a calm, predictable UI.
    return 0;
  });

  const isRecent = (id: string): boolean => query.recentIds.includes(id) && isBrowse;

  const result = ordered.map((entry) =>
    isRecent(entry.command.id) ? { ...entry.command, recent: true } : entry.command,
  );

  return { commands: result, empty: isBrowse };
}
