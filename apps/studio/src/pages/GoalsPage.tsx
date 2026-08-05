import { Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GoalStatus } from '../adapters/types';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import type { Intent } from '../design/variants';
import { useStudioData } from '../studio/StudioDataProvider';

const GOAL_INTENT: Record<GoalStatus, Intent> = {
  'on-track': 'success',
  'at-risk': 'warning',
  achieved: 'info',
  paused: 'neutral',
};

const INTENT_VAR: Record<Intent, string> = {
  neutral: 'var(--color-fg-subtle)',
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
};

/** Goals — read-only view powered by the typed placeholder adapter. */
export function GoalsPage(): React.ReactNode {
  const { goals } = useStudioData();
  const navigate = useNavigate();
  const items = goals.list();

  return (
    <Page title="Goals">
      <div className="flex flex-col gap-5">
        <Card
          title="Goals"
          subtitle="Studio-level objectives for the current sprint"
          actions={<Target className="size-4 text-fg-subtle" />}
        >
          {items.length === 0 ? (
            <EmptyState
              icon={<Target className="size-6" />}
              title="No goals defined"
              hint="Describe a goal in chat and Nova will decompose it into a plan, then surface it here as it progresses."
              action={
                <Button variant="primary" onClick={() => navigate('/')}>
                  Set a goal in chat
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((g) => (
                <li key={g.id} className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg">{g.title}</span>
                      <Badge intent={GOAL_INTENT[g.status]} dot size="sm">
                        {g.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-fg-muted">{g.description}</div>
                    <div className="mt-2 flex items-center gap-2.5" style={{ maxWidth: 360 }}>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-inset">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${g.progress}%`,
                            background: INTENT_VAR[GOAL_INTENT[g.status]],
                          }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-fg-muted">{g.progress}%</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-fg-subtle">{g.dueLabel}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
