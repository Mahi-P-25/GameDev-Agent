import { useMemo } from 'react';
import type { Command, CommandContext, CommandProvider } from './types';

/**
 * CommandRegistry — the collection of {@link CommandProvider}s the Command
 * Center knows about.
 *
 * The registry is the single extension point. To add a new surface (AI, Git,
 * Extensions…) you append a `CommandProvider` to `providers` — the palette core
 * is untouched. `resolve()` asks every provider for its commands against the
 * live {@link CommandContext} and returns one flat, ordered list.
 */
export class CommandRegistry {
  private readonly providers: ReadonlyArray<CommandProvider>;

  constructor(providers: ReadonlyArray<CommandProvider>) {
    this.providers = providers;
  }

  /** Provider ids, in registration order. Useful for debugging/telemetry. */
  get providerIds(): ReadonlyArray<string> {
    return this.providers.map((provider) => provider.id);
  }

  /** Collect commands from every provider for the given context. */
  resolve(context: CommandContext): ReadonlyArray<Command> {
    const all: Command[] = [];
    for (const provider of this.providers) {
      try {
        const commands = provider.commands(context);
        for (const command of commands) {
          all.push(command);
        }
      } catch (error) {
        // A misbehaving provider must never take down the palette. Skip it.
        if (typeof console !== 'undefined') {
          console.error(`[command-center] provider "${provider.id}" failed:`, error);
        }
      }
    }
    return all;
  }
}

/**
 * React hook that builds a registry from a provider list (memoized by identity).
 * Pass `builtInProviders` for the default surface, or compose your own.
 */
export function useCommandRegistry(providers: ReadonlyArray<CommandProvider>): CommandRegistry {
  return useMemo(() => new CommandRegistry(providers), [providers]);
}
