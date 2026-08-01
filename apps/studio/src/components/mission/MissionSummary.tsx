import {
  AlertTriangle,
  Check,
  Code2,
  Layers,
  ListTodo,
  Swords,
  Terminal,
  Wrench,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { MissionPlan } from '../../adapters/missionPlannerTypes';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface MissionSummaryProps {
  readonly plan: MissionPlan;
  readonly onExecute: () => void;
  readonly onCancel: () => void;
}

const GOAL_LABELS: Record<string, string> = {
  'create-project': 'Create Project',
  'bug-fix': 'Bug Fix',
  performance: 'Performance',
  refactor: 'Refactor',
  analysis: 'Analysis',
  feature: 'Feature',
  unknown: 'General',
};

const GOAL_INTENT = {
  'create-project': 'accent',
  'bug-fix': 'danger',
  performance: 'warning',
  refactor: 'info',
  analysis: 'neutral',
  feature: 'success',
  unknown: 'neutral',
} as const;

const SEVERITY_INTENT = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger',
} as const;

function SectionLabel({
  icon,
  children,
}: { readonly icon: ReactNode; readonly children: ReactNode }): ReactNode {
  return (
    <span className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
      <span className="text-fg-muted">{icon}</span>
      {children}
    </span>
  );
}

export function MissionSummary({ plan, onExecute, onCancel }: MissionSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.99 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card
        title="Mission Plan"
        subtitle={plan.summary}
        actions={<span className="font-mono text-[10px] text-fg-subtle">{plan.missionId}</span>}
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge intent={GOAL_INTENT[plan.goal]}>
              <Swords className="size-3" />
              {GOAL_LABELS[plan.goal]}
            </Badge>
            <Badge intent="neutral">
              <Layers className="size-3" />
              {plan.estimatedComplexity.charAt(0).toUpperCase() + plan.estimatedComplexity.slice(1)}{' '}
              complexity
            </Badge>
            <Badge intent="info">{plan.projectType}</Badge>
          </div>

          <p className="text-sm leading-relaxed text-fg-muted">{plan.summary}</p>

          {plan.detectedTechnologies.length > 0 && (
            <div>
              <SectionLabel icon={<Code2 className="size-3.5" />}>Technologies</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {plan.detectedTechnologies.map((tech) => (
                  <span
                    key={tech.name}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-inset px-2 py-0.5 text-[11px] text-fg-muted"
                  >
                    {tech.name}
                    {tech.inferred && <span className="text-[9px] text-fg-subtle">inferred</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionLabel icon={<Wrench className="size-3.5" />}>Required abilities</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {plan.requiredAbilities.map((ability) => (
                <span
                  key={ability}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-inset px-2 py-0.5 text-[11px] text-fg-muted"
                >
                  {ability.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel icon={<Terminal className="size-3.5" />}>Required tools</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {plan.requiredTools.map((tool) => (
                <span
                  key={tool.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-inset px-2 py-0.5 text-[11px] text-fg-muted"
                >
                  {tool.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel icon={<ListTodo className="size-3.5" />}>
              Execution plan ({plan.executionStages.length} stages)
            </SectionLabel>
            <ol className="flex flex-col gap-1.5">
              {plan.executionStages.map((stage, index) => (
                <li
                  key={stage.id}
                  className="flex items-center gap-3 rounded-lg border border-transparent bg-bg-inset/60 px-3 py-2"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-bg-hover font-mono text-[10px] font-medium text-fg-subtle">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-xs font-medium text-fg">{stage.label}</span>
                    <span className="text-[11px] text-fg-subtle">{stage.description}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {plan.risks.length > 0 && (
            <div>
              <SectionLabel icon={<AlertTriangle className="size-3.5" />}>Risks</SectionLabel>
              <ul className="flex flex-col gap-1.5">
                {plan.risks.map((risk) => (
                  <li
                    key={`${risk.severity}-${risk.description}`}
                    className="flex items-start gap-2.5 rounded-lg border border-transparent bg-bg-inset/60 px-3 py-2"
                  >
                    <Badge intent={SEVERITY_INTENT[risk.severity]} size="sm" dot>
                      {risk.severity}
                    </Badge>
                    <span className="text-[11px] leading-snug text-fg-muted">
                      {risk.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-hover px-4 py-2 text-xs font-medium text-fg-muted transition-colors duration-fast hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onExecute}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-xs font-semibold text-fg-on-accent transition-colors duration-fast hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <Check className="size-3.5" />
              Execute mission ({plan.executionStages.length} stages)
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
