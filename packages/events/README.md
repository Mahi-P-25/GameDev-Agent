# @gamedev-agent/events

The single in-process communication backbone for Nova. `EventBus` is the
typed, observable message bus that every major package (kernel, workflow, missions,
plugins, memory, knowledge, configuration) uses to talk to one another without
hard dependencies.

One contract backs all three logical buses in the architecture — the workflow **event**
bus, the live-ops **incident** bus, and the analytics **telemetry** bus. The distinction
is just which `EventDefinition`s you publish; the transport, ordering, and observability
guarantees are identical.

This package ships:

- the **v2 typed API** (`publish` / `subscribe` / `once` / `unsubscribe` / `replay` /
  `history` / `clearHistory` / `use` / `metrics`) built on `EventDefinition<T>`;
- a **deprecated `legacy` shim** (`emit` / `on` / `once`) for string-typed events so
  existing callers (e.g. the kernel lifecycle engine) keep working during migration;
- the in-kernel reference implementation `InMemoryEventBus`;
- a **typed event catalog** (`KERNEL_EVENTS`, mission/workflow/plugin/memory/config);
- a **middleware pipeline** (logging, filter, transform, block, trace, measure);
- a **bounded history ring-buffer** with replay;
- injectable `Clock` / `IdGenerator` (never calls `Date.now()` / `crypto` directly).

## Install

```ts
import { EventBus, InMemoryEventBus } from '@gamedev-agent/events';
```

The package depends on `@gamedev-agent/shared` and `@gamedev-agent/di`.

## Core concepts

### `EventDefinition<T>`

A statically-typed event descriptor. The `type` string is the routing key; `version`
is the schema version; an optional `validate` guards payloads at publish time.

```ts
import type { EventDefinition } from '@gamedev-agent/events';

interface MissionCreatedPayload {
  readonly missionId: string;
  readonly title: string;
}

export const MissionCreated = {
  type: 'mission.created',
  version: 1,
} as EventDefinition<MissionCreatedPayload>;
```

### `Envelope<T>`

Every published message is wrapped in an envelope carrying metadata produced by the
injected `Clock` / `IdGenerator`:

```ts
interface EventMetadata {
  eventId: UUID;
  source: string;
  timestamp: Timestamp;
  version: number;
  priority: EventPriority;     // 'low' | 'normal' | 'high' | 'critical'
  correlationId?: UUID;        // propagated across packages
  causationId?: UUID;          // links a reaction to its trigger
  trace?: TraceContext;        // set by tracing middleware
}
```

### `EventHandler<T>`

```ts
type EventHandler<T> = (envelope: Envelope<T>) => void | Promise<void>;
```

Handlers may be `async`. A publish `await`s all matching handlers; if any throws, the
bus surfaces an `AggregateError` and records the failures in `metrics().failedHandlers`
without dropping the others.

## Quick start

```ts
import { EventBus } from '@gamedev-agent/events';

const bus = new EventBus({ source: 'workflow' });

const sub = bus.subscribe(MissionCreated, (env) => {
  console.log(env.payload.missionId, env.metadata.eventId, env.metadata.source);
});

await bus.publish(MissionCreated, { missionId: 'm-1', title: 'Boss fight' });

sub.dispose(); // unsubscribe
```

### Options

```ts
interface EventBusOptions {
  source: string;                              // required: the producing namespace
  historySize?: number;                        // retained history (default 1024; 0 disables)
  middlewares?: ReadonlyArray<Middleware>;     // pre-installed middleware
  clock?: Clock;                               // injectable (default SystemClock)
  idGenerator?: IdGenerator;                   // injectable (default UuidGenerator)
}
```

## API

| Method | Description |
| --- | --- |
| `publish(def, payload, opts?)` | Emit an event. Returns a promise that resolves after all handlers run. `opts` carries `priority`, `correlationId`, `causationId`. |
| `subscribe(def, handler, opts?)` | Register a handler; returns a `Disposable` to unsubscribe. `opts.priority` controls ordering. |
| `once(def, handler)` | Fire exactly once, then auto-detach. |
| `unsubscribe(def, handler)` | Remove a previously registered handler. |
| `replay(def?, since?)` | Replay retained history, optionally filtered by definition or `since` timestamp. |
| `history()` | Snapshot of retained history (oldest → newest). |
| `clearHistory()` | Drop all retained history. |
| `use(middleware)` | Append a middleware to the pipeline. |
| `metrics()` | Live counters: `published`, `delivered`, `dropped`, `historySize`, `subscriberCount`, `failedHandlers`, `lastPublishMicros`. |

### Priority & ordering

Per-subscription `priority` controls delivery order within a single publish: `critical`
→ `high` → `normal` → `low`. The hot path is a single forward sweep — handlers are held
in an insertion-sorted array, so no per-publish sort.

### Wildcards

Subscribe to `{ type: '*', version: 0 }` to observe every event regardless of type
(in addition to type-specific handlers).

## Middleware

Middleware are composable links applied to every published event, in registration
order, before it reaches subscribers. Skipping `next()` short-circuits delivery and
marks the event `dropped`.

```ts
import {
  createLoggingMiddleware,
  createFilterMiddleware,
  createTransformMiddleware,
  createBlockMiddleware,
  createMeasureMiddleware,
  matchDefinition,
} from '@gamedev-agent/events';

// Drop events that fail a predicate.
bus.use(createFilterMiddleware((env) => env.payload.priority === 'critical'));

// Block a specific event type.
bus.use(createBlockMiddleware((env) => matchDefinition(env, MissionCreated)));

// Enrich / redact the envelope.
bus.use(createTransformMiddleware((env) => ({ ...env, metadata: { ...env.metadata, correlationId: env.metadata.eventId } })));

// Observe every envelope.
bus.use(createLoggingMiddleware((env) => metrics.ingest(env.definition.type)));
```

A middleware cancels delivery by setting `context.cancelled = true` (and not calling
`next()`). Cancelled events increment `metrics().dropped` and are excluded from history.

## History & replay

```ts
await bus.publish(MissionCreated, { missionId: 'm-1', title: 'A' });
await bus.publish(MissionCompleted, { missionId: 'm-1', durationMs: 120 });

const all = bus.replay();                       // every retained event, in order
const missions = bus.replay(MissionCreated);    // filtered by type
const recent = bus.replay(undefined, Date.now() - 1000); // since timestamp
```

History is a bounded ring buffer: when full, the oldest entry is evicted (FIFO). Set
`historySize: 0` to disable retention entirely (useful for hot paths / benchmarks).

## Observability

```ts
const m = bus.metrics();
// { published, delivered, dropped, historySize, subscriberCount, failedHandlers, lastPublishMicros }
```

Wire `createMeasureMiddleware` or `createLoggingMiddleware` to export these to your
telemetry sink.

## Injectable time & ids

The bus never calls `Date.now()` or `crypto.randomUUID()` directly. Provide your own
implementations via `clock` / `idGenerator` in the options, or use the production
defaults `SystemClock` / `UuidGenerator`. For tests, inject a deterministic `Clock` /
`IdGenerator` (see `test_helpers` in the package sources).

```ts
import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { CLOCK_TOKEN, ID_GENERATOR_TOKEN } from '@gamedev-agent/events';
// Both tokens are `ServiceToken`s from @gamedev-agent/di and can be registered
// in the container so the kernel resolves a single shared bus instance.
```

## Migrating from the legacy shim

The deprecated `emit` / `on` / `once` methods accept a raw `string` `type` (or an
`EventDefinition`) and bridge to the typed API:

```ts
// deprecated — keeps working, but prefer the v2 API
const sub = bus.on('mission.created', (env) => env.payload); // env is a LegacyEnvelope
await bus.emit('mission.created', { missionId: 'm-1' });
```

New code should use `publish` / `subscribe` with typed `EventDefinition`s.

## Catalog

Typed definitions for cross-package events are exported from the catalog (each as an
individual `EventDefinition`):

```ts
import {
  KernelBootStarted, KernelBootCompleted,
  KernelShutdownStarted, KernelShutdownCompleted,
  MissionCreated, MissionStarted, MissionCompleted,
  WorkflowStarted, WorkflowCompleted,
  PluginLoaded, PluginUnloaded, PluginFailed,
  MemoryUpdated, KnowledgeUpdated,
  ConfigurationReloaded,
} from '@gamedev-agent/events';
```

> The kernel ships its own `KERNEL_EVENTS` / `LIFECYCLE_EVENTS` grouped object
> (re-exported from `@gamedev-agent/kernel`) that uses the same typed definitions.

## Implementation notes

- **Allocation-light**: middleware are composed once (and re-composed only when `use()`
  adds one). The composed chain ends in the delivery link, which reads the active
  context set per publish.
- **Isolation**: a throwing handler never prevents sibling handlers from running; all
  errors are collected into an `AggregateError`.
- **No globals**: time and ids come from injected `Clock` / `IdGenerator`.
- **No singletons**: construct a bus explicitly and pass it where needed; the kernel
  registers it in the DI container via `EVENT_BUS_TOKEN`.

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # biome check src
npm test            # vitest run
npm run build       # tsup (ESM + d.ts)
```
