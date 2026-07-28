import { motion } from 'motion/react';
import { AlertTriangle, Check, Code2, Layers, ListTodo, Swords, Terminal, Wrench } from 'lucide-react';
import type { MissionPlan } from '../../adapters/missionPlannerTypes';

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

const GOAL_COLORS: Record<string, string> = {
  'create-project': '#5bd88a',
  'bug-fix': '#ff5050',
  performance: '#e8a23a',
  refactor: '#5b9fd8',
  analysis: '#b05bd8',
  feature: '#5bd8c4',
  unknown: '#8a8a8a',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  low: '#5bd88a',
  medium: '#e8a23a',
  high: '#ff5050',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: '#8a8a8a',
  medium: '#e8a23a',
  high: '#ff5050',
};

export function MissionSummary({ plan, onExecute, onCancel }: MissionSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel-premium px-7 py-6"
    >
      <div className="mb-5 flex items-center gap-2.5 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <span className="flex size-5 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)]">
          <span className="size-1.5 rounded-full bg-[#d4af37]" />
        </span>
        <span className="text-sm font-medium text-[#f5f5f5]">Mission Plan</span>
        <span className="ml-auto text-[10px] text-[#5c5c5c] font-mono">{plan.missionId}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: `${GOAL_COLORS[plan.goal]}15`,
            color: GOAL_COLORS[plan.goal],
          }}
        >
          <Swords className="size-3" />
          {GOAL_LABELS[plan.goal]}
        </span>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: `${COMPLEXITY_COLORS[plan.estimatedComplexity]}15`,
            color: COMPLEXITY_COLORS[plan.estimatedComplexity],
          }}
        >
          <Layers className="size-3" />
          {plan.estimatedComplexity.charAt(0).toUpperCase() + plan.estimatedComplexity.slice(1)} Complexity
        </span>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-[#c0c0c0]">{plan.summary}</p>

      {plan.detectedTechnologies.length > 0 && (
        <div className="mb-5">
          <span className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">
            <Code2 className="size-3.5" />
            Technologies
          </span>
          <div className="flex flex-wrap gap-1.5">
            {plan.detectedTechnologies.map((tech) => (
              <span
                key={tech.name}
                className="inline-flex items-center gap-1 rounded-full border border-[rgba(212,175,55,0.15)] bg-[rgba(212,175,55,0.06)] px-2.5 py-1 text-[11px] text-[#d4af37]"
              >
                {tech.name}
                {tech.inferred && <span className="text-[9px] text-[#8a8a8a]">(inferred)</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <span className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">
          <Wrench className="size-3.5" />
          Required Abilities
        </span>
        <div className="flex flex-wrap gap-1.5">
          {plan.requiredAbilities.map((ability) => (
            <span
              key={ability}
              className="inline-flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] text-[#b0b0b0]"
            >
              {ability}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <span className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">
          <Terminal className="size-3.5" />
          Required Tools
        </span>
        <div className="flex flex-wrap gap-1.5">
          {plan.requiredTools.map((tool) => (
            <span
              key={tool.id}
              className="inline-flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] text-[#b0b0b0]"
            >
              {tool.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <span className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">
          <ListTodo className="size-3.5" />
          Execution Plan ({plan.executionStages.length} stages)
        </span>
        <div className="flex flex-col gap-1.5">
          {plan.executionStages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-3 rounded-lg bg-[rgba(255,255,255,0.02)] px-3 py-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] text-[10px] font-medium text-[#5c5c5c]">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium text-[#d0d0d0]">{stage.label}</span>
                <span className="text-[10px] text-[#6a6a6a]">{stage.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {plan.risks.length > 0 && (
        <div className="mb-6">
          <span className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">
            <AlertTriangle className="size-3.5" />
            Risks
          </span>
          <div className="flex flex-col gap-1.5">
            {plan.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-[rgba(255,255,255,0.02)] px-3 py-1.5">
                <span
                  className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${SEVERITY_COLORS[risk.severity]}20` }}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[risk.severity] }} />
                </span>
                <span className="text-[11px] text-[#b0b0b0]">{risk.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-[rgba(255,255,255,0.06)] pt-5">
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-medium text-[#8a8a8a] transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-[#b0b0b0]"
        >
          Cancel
        </motion.button>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={onExecute}
          className="flex items-center gap-2 rounded-lg border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.1)] px-5 py-2 text-xs font-medium text-[#d4af37] transition-colors hover:bg-[rgba(212,175,55,0.18)]"
        >
          <Check className="size-3.5" />
          Execute Mission ({plan.executionStages.length} stages)
        </motion.button>
      </div>
    </motion.div>
  );
}
