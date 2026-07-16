/**
 * Severity levels, ordered. Implementations decide which levels are emitted.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * A single structured log record. `namespace` is the Memory Kernel namespace
 * the record belongs to, enabling isolated, per-project log streams.
 */
export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly namespace: string;
  readonly context?: Record<string, unknown>;
}

/**
 * A sink receives structured entries. Implementations may write to stdout,
 * a file, a remote telemetry bus, or all of them.
 */
export interface LogSink {
  readonly name: string;
  write(entry: LogEntry): void | Promise<void>;
}

/**
 * The logger contract used throughout the kernel. Namespaced and hierarchical
 * via `child`, so every role/team gets an isolated, attributable stream.
 */
export interface Logger {
  readonly namespace: string;
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;
  child(namespace: string): Logger;
}

// Reference implementations (kernel defaults).
export { RootLogger } from './RootLogger';
export { ConsoleLogSink } from './ConsoleLogSink';
