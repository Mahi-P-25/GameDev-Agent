# Changesets

This directory contains [Changesets](https://github.com/changesets/changesets) used to
manage versioning and changelogs across the GameDev Agent workspace.

## Workflow

1. Make your change in a package.
2. Run `pnpm changeset` and describe the change (patch / minor / major).
3. Commit the generated changeset file alongside your change.
4. On release, `pnpm version` consumes changesets and bumps package versions;
   `pnpm release` builds and publishes.

All packages in this studio are versioned independently and consumed via `workspace:*`
links inside the monorepo.
