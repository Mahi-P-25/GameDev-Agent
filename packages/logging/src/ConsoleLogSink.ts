import type { LogEntry, LogSink } from './index';

/**
 * Minimal built-in log sink that writes structured entries to the process
 * console (stderr for warn/error/fatal, stdout otherwise).
 *
 * This is kernel *infrastructure*, not a plugin: it lets the kernel boot and
 * observe itself before any external logging driver (file, remote telemetry)
 * is registered as a module. It can be replaced by passing `logSinks` or a
 * full `logger` in {@link KernelOptions}.
 */
export class ConsoleLogSink implements LogSink {
  readonly name = 'console';

  write(entry: LogEntry): void {
    const context = entry.context === undefined ? '' : ` ${JSON.stringify(entry.context)}`;
    const line = `${new Date(entry.timestamp).toISOString()} ${entry.level.toUpperCase()} [${entry.namespace}] ${entry.message}${context}`;

    if (entry.level === 'warn' || entry.level === 'error' || entry.level === 'fatal') {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}
