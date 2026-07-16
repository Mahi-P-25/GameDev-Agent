import { NAMESPACE_SEPARATOR } from '@gamedev-agent/shared';
import type { LogEntry, LogLevel, LogSink, Logger } from './index';

/**
 * The kernel's root logger. It is namespaced and hierarchical: `child()`
 * produces a derived logger whose namespace is `parent / child`, matching the
 * Memory Kernel's namespace model so every role, team, and project emits an
 * isolated, attributable stream.
 *
 * Like {@link ConsoleLogSink}, this is core infrastructure. Concrete logging
 * back-ends are supplied as `LogSink`s (typically registered by a module).
 */
export class RootLogger implements Logger {
  readonly namespace: string;
  private readonly sinks: ReadonlyArray<LogSink>;

  constructor(namespace: string, sinks: ReadonlyArray<LogSink>) {
    this.namespace = namespace;
    this.sinks = sinks;
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      namespace: this.namespace,
      ...(context === undefined ? {} : { context }),
    };
    for (const sink of this.sinks) {
      sink.write(entry);
    }
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.emit('trace', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.emit('error', message, context);
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    this.emit('fatal', message, context);
  }

  child(childNamespace: string): Logger {
    return new RootLogger(`${this.namespace}${NAMESPACE_SEPARATOR}${childNamespace}`, this.sinks);
  }
}
