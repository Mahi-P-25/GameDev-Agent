# Plugins

Plugins are the **device drivers** of the studio operating system. Each plugin exposes an
external capability (VCS, build system, asset pipeline, storefront, analytics, CI) through a
uniform, sandboxed contract defined by the Plugin SDK.

## Conventions (enforced in later sprints)

- A plugin is a workspace package under `plugins/*` named `@gamedev-agent/plugin-<name>`.
- Plugins declare auth, quota, idempotency, and schema via the plugin contract.
- Secrets are injected by the Secret Manager; plugins never persist credentials in memory.
- Plugins run isolated and are security/license vetted by the Plugin Engineer role.

This directory currently holds the plugin boundary documentation. Plugin implementations
land in subsequent sprints.
