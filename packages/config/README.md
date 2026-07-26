# @gamedev-agent/config

Configuration source and schema contracts for Nova.

A `ConfigSource` is a named, loadable origin of settings. A `ConfigSchema<T>` is the
single, typed place where raw `Json` is validated into a value. `ResolvedConfig<T>`
pairs the value with provenance so the Memory Kernel can trace a setting to its source.

This package also ships the in-kernel reference implementations used as defaults by the
kernel: `ConfigurationService` (aggregates sources + schema resolution) and
`MemoryConfigSource` (in-memory map).

## Dependencies

- `@gamedev-agent/shared` (types only)
- `@gamedev-agent/logging` (`Logger`, type only — for optional debug logging)

## Exports

- `ConfigSource` — loadable configuration origin contract.
- `ConfigSchema<T>` — typed validation/parse contract.
- `ResolvedConfig<T>` — value + provenance.
- `ConfigurationService` — reference aggregator implementation.
- `MemoryConfigSource` — reference in-memory implementation.
- `ConfigNotFoundError` — config error type.
