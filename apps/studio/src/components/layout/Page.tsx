import type { ReactNode } from 'react';
import { GlobalOverlays } from './GlobalOverlays';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomTelemetryBar } from './BottomTelemetryBar';

export interface PageProps {
  readonly title?: string;
  readonly children: ReactNode;
  readonly rightRail?: ReactNode;
}

export function Page({ title, children, rightRail }: PageProps): ReactNode {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base text-fg font-sans antialiased">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar title={title ?? ''} />
        <div className="flex flex-1 overflow-hidden min-w-0">
          <main className="flex-1 overflow-y-auto min-w-0 p-4 md:p-6">
            {children}
          </main>
          {rightRail && (
            <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-bg-panel/50 p-4">
              {rightRail}
            </aside>
          )}
        </div>
        <BottomTelemetryBar />
      </div>
      <GlobalOverlays />
    </div>
  );
}
