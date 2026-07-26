import type { GoalStatus } from '../adapters/types';
import { Page } from '../components/layout/Page';
import {
  Badge,
  Card,
  EmptyState,
  PlaceholderBadge,
  ProgressBar,
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
    <Page title="Goals" status="ready">
      <div className="nova-col--12">
        <Card
          title="Goals"
          subtitle="Studio-level objectives for the current sprint"
          actions={<PlaceholderBadge />}
        >
          {items.length === 0 ? (
            <EmptyState title="No goals defined" />
          ) : (
            <div className="nova-list">
              {items.map((g) => (
                <div key={g.id} className="nova-list__item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nova-row" style={{ gap: 8 }}>
                      <div style={{ fontWeight: 500 }}>{g.title}</div>
                      <Badge intent={GOAL_INTENT[g.status]} dot>
                        {g.status}
                      </Badge>
                    </div>
                    <div className="nova-subtle" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {g.description}
                    </div>
                    <div className="nova-row" style={{ marginTop: 8, gap: 10, maxWidth: 360 }}>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={g.progress} intent={GOAL_INTENT[g.status]} />
                      </div>
                      <span
                        className="nova-mono"
                        style={{ color: intentColor(GOAL_INTENT[g.status]) }}
                      >
                        {g.progress}%
                      </span>
                    </div>
                  </div>
                  <div className="nova-subtle" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    {g.dueLabel}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
