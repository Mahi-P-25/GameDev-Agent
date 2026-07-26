import { useCallback, useEffect, useState } from 'react';

/**
 * CommandHistory — remembers which commands the director has run, newest first,
 * so the palette can float familiar actions to the top and show a "Recent"
 * section. State is persisted to `localStorage` and survives reloads; it is
 * bounded so it can never grow without limit.
 */

const STORAGE_KEY = 'nova.command-center.history';
const MAX_ENTRIES = 24;

function read(): ReadonlyArray<string> {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function write(ids: ReadonlyArray<string>): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode / quota). History is best-effort.
  }
}

export interface CommandHistory {
  /** Recent command ids, newest first. */
  readonly recent: ReadonlyArray<string>;
  /** Record a command run, moving it to the front and de-duplicating. */
  readonly record: (id: string) => void;
  /** Forget a single command id. */
  readonly forget: (id: string) => void;
  /** Clear all history. */
  readonly clear: () => void;
}

export function useCommandHistory(): CommandHistory {
  const [recent, setRecent] = useState<ReadonlyArray<string>>(read);

  useEffect(() => {
    write(recent);
  }, [recent]);

  const record = useCallback((id: string) => {
    setRecent((prev) => [id, ...prev.filter((existing) => existing !== id)].slice(0, MAX_ENTRIES));
  }, []);

  const forget = useCallback((id: string) => {
    setRecent((prev) => prev.filter((existing) => existing !== id));
  }, []);

  const clear = useCallback(() => setRecent([]), []);

  return { recent, record, forget, clear };
}
