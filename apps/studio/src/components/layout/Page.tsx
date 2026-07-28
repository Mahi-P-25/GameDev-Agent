import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { GlobalOverlays } from './GlobalOverlays';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export interface PageProps {
  readonly title?: string;
  readonly children: ReactNode;
}

export function Page({ title, children }: PageProps): ReactNode {
  return (
    <div className="nova-app">
      <Sidebar />
      <div className="nova-main">
        {title && <TopBar title={title} />}
        <main className="nova-content">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="nova-panel"
          >
            {children}
          </motion.div>
        </main>
      </div>
      <GlobalOverlays />
    </div>
  );
}
