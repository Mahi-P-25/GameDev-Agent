# Nova Command Center

Nova's global command palette — a keyboard-first, ⌘K surface for jumping
anywhere and doing anything in the studio. This document explains the
architecture, how to extend it, and the keyboard model.

---

## What it is

The Command Center is a centered, blurred modal (Ctrl/Cmd + K) that lets the
director search and run **commands**: navigation, projects, recent projects,
workflows, recent files, missions, settings, and documentation. It is built on
Radix Dialog (focus trap, scroll lock, Esc-to-close) and `cmdk` (accessible
filtering), animated with Nova's Motion system.

Design goals:

- **Keyboard-first.** Arrow keys navigate, Enter runs, Esc closes, typing
  filters instantly. Mouse is fully supported too.
- **Extensible by design.** The core knows nothing about navigation, projects,
  or workflows. Each surface contributes a `CommandProvider`. Adding a feature
  (AI, Git, Extensions…) means adding a provider — never editing the palette.
- **Future-ready.** Providers are the single extension seam; the registry is the
  single source of truth.

---

## Architecture

```
modules/command-center/
├── types.ts                  # Command, CommandProvider, CommandContext, CommandQuery
├── CommandRegistry.ts        # collects providers → flat command list
├── CommandSearch.ts          # pure ranking/filtering engine (no React)
├── CommandHistory.ts         # recent-command memory (localStorage, bounded)
├── RecentCommands.ts         # recency-aware selector (floats recents up)
├── providers.tsx             # built-in providers (the default surface)
├── CommandPalette.tsx        # the visual modal (Radix + cmdk + Motion)
├── CommandCenterModule.tsx   # orchestrator hook + <CommandCenterModule/>
└── index.ts                  # public barrel
```

### Data flow

```
Ctrl/Cmd+K (global listener in GlobalOverlays)
        │
        ▼
useCommandCenter()                         ← CommandCenterModule.tsx
        │  builds CommandContext { api, navigate, notify }
        ▼
CommandRegistry.resolve(context)          ← asks every provider for commands
        │
        ▼
withRecents(all, history)                  ← RecentCommands.ts
        │
        ▼
searchCommands(browsed, { search, recentIds })   ← CommandSearch.ts
        │
        ▼
CommandPalette (groups + renders)         ← CommandPalette.tsx
        │  on select:
        ▼
history.record(id) → command.run() → close
```

### Key pieces

- **`Command`** — one addressable action: `id`, `title`, `subtitle`, `group`,
  `icon`, `keywords`, `shortcut`, `disabled`, `badge`, `intent`, and `run()`.
- **`CommandProvider`** — `{ id, label, commands(ctx) }`. The extensibility
  seam. Returns commands for the current `CommandContext`.
- **`CommandContext`** — `{ api, navigate, notify }`. What a provider may read
  or do. `api` is the `StudioApiClient` (never backend packages directly).
- **`CommandRegistry`** — holds providers, `resolve()`s them into one flat,
  ordered list. A misbehaving provider is caught and skipped so the palette
  never crashes.
- **`CommandSearch`** — pure function: ranks by title/keyword overlap + recency,
  returns ordered commands. No React, trivially testable.
- **`CommandHistory`** — remembers run command ids (newest first, bounded to
  24) in `localStorage`; survives reloads.
- **`CommandPalette`** — pure view. Receives the already-ranked list, groups it,
  and renders with fade + scale animation, soft-blur backdrop, and a footer
  with keyboard hints.
- **`CommandCenterModule`** — the public surface. Mount `<CommandCenterModule/>`
  once (the shared page chrome does this) and call `useCommandCenter()` to
  open/close from anywhere.

---

## Extensibility — adding a command surface

You never edit the palette core. To add a new source of commands (e.g. an AI
assistant, Git, or an Extension), create a `CommandProvider` and register it:

```tsx
import type { CommandProvider } from '../modules/command-center';

const gitProvider: CommandProvider = {
  id: 'git',
  label: 'Git',
  commands: ({ api, navigate }) => [
    {
      id: 'git-commit',
      title: 'Git: Commit',
      group: 'Git',
      keywords: ['git', 'commit', 'save'],
      run: () => {
        // talk to the backend through the Studio API only
        navigate('/projects');
      },
    },
  ],
};
```

Register it by appending to `builtInProviders` in `providers.tsx`:

```tsx
export const builtInProviders: ReadonlyArray<CommandProvider> = [
  ...,
  gitProvider,
];
```

That is the entire integration. The new commands appear in search, in the
"Git" group, and participate in recency — no core changes.

You can also mount a fully custom palette by passing a `providers` prop to
`<CommandCenterModule providers={myProviders} />`, or call `useCommandRegistry`
directly for tests.

---

## Keyboard flow

| Key            | Action                                    |
| -------------- | ----------------------------------------- |
| `Ctrl` / `Cmd` + `K` | Toggle the Command Center (global)  |
| Type           | Filter commands instantly                 |
| `↑` / `↓`      | Move selection (wraps around)             |
| `Enter`        | Run the selected command                   |
| `Esc`          | Close the palette                         |
| Mouse           | Hover + click also works                   |

When the query is empty, the palette shows a **browse** state: recently run
commands float to the top under a "Recent" group, followed by everything else
in provider order. As you type, results are ranked by label/keyword match with a
recency boost, so familiar commands stay easy to reach.

All animations honor `prefers-reduced-motion`: under that setting they collapse
to instant, never removing content.

---

## Visual design

- **Centered modal** with a softly blurred, dimmed backdrop (`backdrop-blur`,
  `bg-black/55`).
- **Fade + scale** entrance (surface scales up from 96% with a soft lift),
  through Nova's `useNovaMotion()` presets.
- **Rounded corners**, subtle double shadow, and the elevated Nova surface
  color (`bg-bg-elevated`) with a translucent, blurred fill.
- **Typography** uses the Nova type scale; group headings are small, uppercase,
  and tracked. Selected rows use the primary-soft tint.
- Built entirely from the existing design system (`cn`, `useNovaMotion`,
  Radix Dialog, `cmdk`, `lucide-react` icons).

---

## Where it lives in the app

- `components/layout/GlobalOverlays.tsx` mounts `<CommandCenterModule/>` once and
  owns the global `Ctrl/Cmd+K` listener.
- `components/layout/TopBar.tsx` shows a "Command ⌘K" button that opens it.
- The palette is the only global-UI entry point; individual pages never manage
  it.

## Constraints respected

- The UI only reads data through `StudioApiClient` / `useStudioData()`. It never
  imports backend subsystem packages.
- No `TODO`s, no placeholders — every provider is wired to real functionality.
- Strict TypeScript throughout; types are the contract.
