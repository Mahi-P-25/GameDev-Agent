# @gamedev-agent/shared

Cross-cutting types, nominal brands, and kernel constants shared by every package in the
GameDev Agent workspace.

This package has **no dependencies** and is the root of the dependency DAG. It must never
import from any other workspace package (that would create a cycle).

## Exports

- `NAMESPACE_SEPARATOR` — primitive used by the Memory Kernel for namespace isolation.
- `Brand`, `UUID`, `Timestamp` — nominal typing helpers.
- `Json`, `Option`, `Result`, `DeepReadonly` — common value types.
- `Disposable` — uniform lifecycle contract.

## Usage

```ts
import { NAMESPACE_SEPARATOR, type Result } from '@gamedev-agent/shared';
```
