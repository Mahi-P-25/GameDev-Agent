import type { ReactNode } from 'react';
import { GlobalOverlays } from './GlobalOverlays';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export interface PageProps {
  readonly title?: string;
  readonly children: ReactNode;
  readonly rightRail?: ReactNode;
}

export function Page({ title, children, rightRail }: PageProps): ReactNode {
  return (
    <div className="nova-app">
      <Sidebar />
      <div className="nova-main">
        <TopBar title={title ?? ''} />
        <div className="nova-content">
          <main className="nova-content-area">
            {children}
          </main>
          {rightRail && (
            <aside className="nova-right-rail">
              {rightRail}
            </aside>
          )}
        </div>
      </div>
      <GlobalOverlays />
    </div>
  );
}
