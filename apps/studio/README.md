# @gamedev-agent/studio

Studio shell application — the user-facing surface of the GameDev Agent operating system.

It boots the `StudioKernel` and hosts the role/workflow scheduler described in the
architecture documents. This package currently defines the application contract only;
the bootstrapping logic lands in a later sprint on top of the kernel contracts in
`@gamedev-agent/kernel`.

## Dependencies

- `@gamedev-agent/kernel`
- `@gamedev-agent/shared`
