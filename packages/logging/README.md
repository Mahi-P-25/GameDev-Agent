# @gamedev-agent/logging

Structured, namespaced logging contracts for GameDev Agent.

Logging is namespaced so that every role, team, and project emits an isolated,
attributable stream. A `LogSink` is a destination; a `Logger` is the namespaced,
hierarchical facade used by the kernel.

This package also ships the in-kernel reference implementations used as defaults by the
kernel: `RootLogger` (namespaced, hierarchical logger) and `ConsoleLogSink` (writes to
the process console).

## Dependencies

- `@gamedev-agent/shared` (`NAMESPACE_SEPARATOR`)

## Exports

- `LogLevel` — severity union.
- `LogEntry` — structured record (includes `namespace`).
- `LogSink` — destination contract.
- `Logger` — namespaced, hierarchical logger contract.
- `RootLogger` — reference logger implementation.
- `ConsoleLogSink` — reference sink implementation.
