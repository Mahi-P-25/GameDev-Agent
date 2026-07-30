import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

export interface Tab {
  readonly id: string;
  readonly label: string;
}

export interface TabBarProps {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTab: string;
  readonly onTabChange: (id: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): ReactNode {
  return (
    <div className="flex gap-0 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative px-4 py-2.5 text-sm font-medium transition-colors duration-fast',
            activeTab === tab.id
              ? 'text-fg'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
