/**
 * Shared kernel constants.
 *
 * The namespace separator is the primitive used by the Memory Kernel to enforce
 * isolation between studios, projects, teams, and runs (see Studio-OS-Design).
 */
export const NAMESPACE_SEPARATOR = '/' as const;

/**
 * Nominal brand helper. Brands make primitive aliases (UUID, Timestamp, …)
 * distinct at the type level while remaining plain runtime values.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UUID = Brand<string, 'UUID'>;
export type Timestamp = Brand<number, 'Timestamp'>;

/** Arbitrary JSON-serializable value. */
export type Json = null | boolean | number | string | Json[] | { readonly [key: string]: Json };

/** A value that may be absent without throwing. */
export type Option<T> = T | null;

/** Railway-style result used across the kernel for fallible operations. */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Recursively read-only view of a structure. */
export type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

/** Uniform dispose contract, mirroring `Disposable`. */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/**
 * Type guard used across packages to safely dispose values that may or may not
 * implement the `Disposable` contract. Centralized in shared so every package
 * uses one consistent check instead of ad-hoc `typeof` tests.
 */
export function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { dispose?: unknown }).dispose === 'function'
  );
}
