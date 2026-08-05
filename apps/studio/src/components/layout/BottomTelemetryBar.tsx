import { Rocket, Bot, Wrench, Brain, Sparkles } from 'lucide-react';

interface BottomTelemetryBarProps {
  readonly missionName?: string;
  readonly agentName?: string;
  readonly activeToolsCount?: number;
  readonly contextSize?: string;
  readonly memoryCount?: number;
  readonly isConnected?: boolean;
}

export function BottomTelemetryBar({
  missionName = 'Build multiplayer system',
  agentName = 'Nova 3.6',
  activeToolsCount = 6,
  contextSize = '128K',
  memoryCount = 21,
  isConnected = true,
}: BottomTelemetryBarProps): React.ReactNode {
  return (
    <footer className="flex h-8 w-full items-center justify-between border-t border-border/80 bg-bg-sunken px-4 font-mono text-[11px] text-fg-subtle select-none">
      {/* Left: System Status */}
      <div className="flex items-center gap-2">
        <span className="flex size-2 rounded-full bg-success animate-pulse" />
        <span className="font-semibold text-fg-muted">Ready</span>
      </div>

      {/* Center: Live Telemetry Metrics */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-fg-muted">
          <Rocket className="size-3 text-accent" />
          <span>
            Mission: <strong className="text-fg">{missionName}</strong>
          </span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1.5 text-fg-muted">
          <Bot className="size-3 text-accent" />
          <span>
            Agent: <strong className="text-fg">{agentName}</strong>
          </span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1.5 text-fg-muted">
          <Wrench className="size-3 text-accent" />
          <span>
            Tools: <strong className="text-fg">{activeToolsCount} Active</strong>
          </span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1.5 text-fg-muted">
          <Brain className="size-3 text-accent" />
          <span>
            Context: <strong className="text-fg">{contextSize}</strong>
          </span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1.5 text-fg-muted">
          <Sparkles className="size-3 text-accent" />
          <span>
            Memory: <strong className="text-fg">{memoryCount} items</strong>
          </span>
        </div>
      </div>

      {/* Right: Connection State */}
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-success" />
        <span className="font-semibold text-success">{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </footer>
  );
}
