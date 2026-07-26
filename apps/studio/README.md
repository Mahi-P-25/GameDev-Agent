# @gamedev-agent/studio

Nova Studio — the React application shell for the Nova game-development operating system.

It boots the `StudioKernel` and surfaces the studio's live presence. This package
implements the **Studio Presence System** (Sprint 12): a product experience that
makes Nova feel like a living game-development studio.

## Why Nova opens to the Studio, not a Dashboard

A **dashboard** answers "what are the numbers?" — it is a monitoring surface you
consult when something breaks. A **studio** answers "what is my team doing right
now, and what should I do next?" — it is a place you *live in*.

Nova is an operating system for building games, not an observability tool. The
director opens the app to re-enter the flow of work, not to read gauges. So the
default route is **Home**, a single, calm surface that:

- Greets the director and states, in one line, what the studio is doing now.
- Surfaces the **one** next action through a primary **Continue Working** CTA
  (a pending approval first, then the next in-flight mission) — the dashboard
  would have buried that behind a list.
- Shows the team's live status (Ready / Planning / Working / Waiting / Blocked /
  Offline) so blocked roles are visible at a glance, not after drilling in.
- Keeps approvals, the active project, today's goal, and recent activity one
  short scroll away.

The Dashboard still exists as a concept in the underlying data (workspace
counts, capability health, coordinator status all flow through the Studio API),
but it is no longer the entry point — Home *is* the dashboard, reframed around
people and momentum rather than metrics.

## Architecture & conventions

- The UI **never imports backend packages**. It reads everything through the
  `StudioApiClient` façade (`@gamedev-agent/studio-api`) and the typed
  `StudioDataProvider` context.
- Data the backend does not yet produce is supplied by **isolated placeholder
  adapters** under `src/adapters` (`studioRolesAdapter`, `goalsAdapter`,
  `notificationsAdapter`). Each carries a `source: 'placeholder'` marker and a
  `PlaceholderBadge` in the UI, so preview data is clearly labelled and trivial
  to swap for a live client without touching components.
- Design is **dark-first, minimal, professional**: semantic color tokens in
  `styles/theme.css`, structural rules in `styles/app.css`, no flashy animation
  (only subtle fade/transition motion).

## Home sections

`Greeting · Continue Working (primary CTA) · Current Workspace · Active Project ·
Today's Goal · Studio Team · Pending Approvals · Recent Activity`

## Scripts

```
pnpm --filter @gamedev-agent/studio dev        # vite dev server
pnpm --filter @gamedev-agent/studio build      # tsc --noEmit + vite build
pnpm --filter @gamedev-agent/studio typecheck  # tsc --noEmit
pnpm --filter @gamedev-agent/studio lint       # biome check src
pnpm --filter @gamedev-agent/studio test       # vitest run
```
