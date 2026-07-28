import type { GoalStatus } from '../adapters/types';
import { Page } from '../components/layout/Page';
import {
  Badge,
  intentColor,
} from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';

const GOAL_INTENT: Record<GoalStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  'on-track': 'success',
  'at-risk': 'warning',
  achieved: 'info',
  paused: 'neutral',
};

/** Goals — read-only view powered by the typed placeholder adapter. */
export function GoalsPage(): React.ReactNode {
  const { goals } = useStudioData();
  const items = goals.list();

  return (
    <Page title="Goals">
      <div className="glass-panel p-6">
        <h2 className="text-sm font-semibold text-[#f5f5f5]">Goals</h2>
        <p className="mt-0.5 text-xs text-[#8a8a8a]">Studio-level objectives for the current sprint</p>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-[#5c5c5c]">No goals defined.</p>
        ) : (
          <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
            {items.map((g) => (
              <div key={g.id} className="flex items-start gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#f5f5f5]">{g.title}</span>
                    <Badge intent={GOAL_INTENT[g.status]} dot>
                      {g.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-[#5c5c5c]">{g.description}</div>
                  <div className="mt-2 flex items-center gap-2.5" style={{ maxWidth: 360 }}>
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${g.progress}%`,
                            background: intentColor(GOAL_INTENT[g.status]),
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#8a8a8a]">{g.progress}%</span>
                  </div>
                </div>
                <div className="shrink-0 text-xs text-[#5c5c5c]">{g.dueLabel}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
