import type { ReactNode } from 'react';
import { GlobalOverlays } from './GlobalOverlays';
import { Sidebar } from './Sidebar';
import { TopBar, type TopBarProps } from './TopBar';

export interface PageProps {
  readonly title: string;
  readonly status?: TopBarProps['status'];
  /** Optional grid modifier class (e.g. `nova-grid--home`). Defaults to the 12-col dashboard grid. */
  readonly gridClass?: string;
  readonly children: ReactNode;
}

/**
 * A standard page frame: the app chrome (sidebar) plus a top bar carrying the
 * page title and a live studio-status pill, followed by the scrollable content
 * region. Every page renders inside this so layout stays consistent.
 */
export function Page({ title, status, gridClass, children }: PageProps): ReactNode {
  return (
    <div className="nova-app">
      <Sidebar />
      <div className="nova-main">
        <TopBar title={title} status={status ?? 'ready'} />
        <main className="nova-content">
          <div className={`nova-page-grid${gridClass ? ` ${gridClass}` : ' nova-grid--dashboard'}`}>
            {children}
          </div>
        </main>
      </div>
      <GlobalOverlays />
    </div>
  );
}
