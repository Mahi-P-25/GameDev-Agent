import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LogLine {
  readonly id: number;
  readonly timestamp: string;
  readonly message: string;
}

const SAMPLE_LOGS: ReadonlyArray<string> = [
  'Initializing profiler engine...',
  'Scanning WebGL render passes...',
  'Found 12 uniform update sites',
  'Benchmarking current frame times...',
  'Avg: 16.7ms — target: 8.3ms',
  'Optimization potential identified',
  'Starting uniform cache implementation...',
];

let logCounter = 0;

export function LiveLogCard(): ReactNode {
  const [logs, setLogs] = useState<ReadonlyArray<LogLine>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const msg = SAMPLE_LOGS[logCounter % SAMPLE_LOGS.length] ?? '';
      const now = new Date();
      const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLogs((prev) => [...prev, { id: logCounter++, timestamp: ts, message: msg }]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <div className="rounded-xl border border-border bg-bg-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Live Logs
        </h3>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-fg-subtle hover:text-fg transition-colors duration-fast"
          >
            Clear
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="h-48 overflow-y-auto p-3 font-mono text-[11px] leading-[1.6] space-y-0.5 scrollbar-thin"
      >
        {logs.length === 0 ? (
          <span className="text-fg-subtle">Waiting for log output...</span>
        ) : (
          logs.map((line) => (
            <div key={line.id} className="flex items-start gap-2">
              <span className="shrink-0 text-fg-subtle">[{line.timestamp}]</span>
              <span className="text-fg-muted">{line.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
