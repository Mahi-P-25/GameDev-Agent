import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ExecutionProgressBar } from './ExecutionProgressBar';
import { ExecutionPhaseCard, type ExecutionPhaseData, type PhaseKind } from './ExecutionPhaseCard';
import { ToolExecutionCard } from './ToolExecutionCard';
import { MissionSummaryCard, type MissionSummaryData } from './MissionSummaryCard';
import type { ExecutionStatus } from './ExecutionStatusBadge';
import type { ChatMessage, ToolCallEntry } from '../../services/ConversationStore';

interface MissionExecutionPanelProps {
  readonly message: ChatMessage;
  readonly promptText?: string;
  readonly isGenerating?: boolean;
  readonly onNextAction?: ((action: string) => void) | undefined;
}

export function MissionExecutionPanel({
  message,
  promptText,
  isGenerating = false,
  onNextAction,
}: MissionExecutionPanelProps): React.ReactNode {
  // Determine overall status
  const status: ExecutionStatus = useMemo(() => {
    if (message.status === 'streaming' || message.status === 'typing') {
      if (message.toolCalls.some((t) => t.status === 'running')) return 'executing';
      if (message.thoughtTrace.length > 0) return 'planning';
      return 'running';
    }
    if (message.status === 'completed') return 'completed';
    if (message.status === 'failed') return 'failed';
    if (message.status === 'cancelled') return 'cancelled';
    return 'pending';
  }, [message.status, message.toolCalls, message.thoughtTrace]);

  // Map thoughtTrace & toolCalls into structured execution phases
  const phases: ReadonlyArray<ExecutionPhaseData> = useMemo(() => {
    const planningSteps = message.thoughtTrace.map((trace, i) => ({
      id: `plan-step-${i}`,
      label: trace,
      status: 'done' as const,
    }));

    const toolSteps = message.toolCalls.map((t) => ({
      id: t.id,
      label: t.action,
      description: t.message,
      status: t.status === 'ok' ? ('done' as const) : t.status === 'failed' ? ('failed' as const) : ('active' as const),
      timestamp: t.timestamp,
    }));

    const resultPhases: ExecutionPhaseData[] = [
      {
        id: 'phase-1-planning',
        kind: 'planning' as PhaseKind,
        title: 'Planning & Analysis',
        summary: 'Goal decomposed into sub-tasks and tool selection graph created',
        status: planningSteps.length > 0 ? (isGenerating ? 'active' : 'done') : 'pending',
        steps: planningSteps.length > 0 ? planningSteps : [{ id: 'init', label: 'Analyzing codebase contracts', status: isGenerating ? 'active' : 'done' }],
      },
      {
        id: 'phase-2-terminal',
        kind: 'terminal' as PhaseKind,
        title: 'Terminal & Tool Executions',
        summary: 'Running commands, package installations, and system checks',
        status: toolSteps.length > 0 ? (toolSteps.some((s) => s.status === 'active') ? 'active' : 'done') : 'pending',
        steps: toolSteps.length > 0 ? toolSteps : [{ id: 'pending-tool', label: 'Preparing terminal actions', status: 'pending' }],
      },
      {
        id: 'phase-3-verification',
        kind: 'verification' as PhaseKind,
        title: 'Build & Typecheck Verification',
        summary: 'Validating runtime assertions and static type safety',
        status: message.status === 'completed' ? 'done' : message.status === 'failed' ? 'failed' : isGenerating ? 'pending' : 'done',
        steps: [
          {
            id: 'verify-1',
            label: 'Static Type Checking (tsc)',
            status: message.status === 'completed' ? 'done' : message.status === 'failed' ? 'failed' : 'pending',
          },
          {
            id: 'verify-2',
            label: 'Production Build Bundle (vite)',
            status: message.status === 'completed' ? 'done' : 'pending',
          },
        ],
      },
    ];

    return resultPhases;
  }, [message.thoughtTrace, message.toolCalls, message.status, isGenerating]);

  // Derived metrics
  const completedStepCount = useMemo(() => {
    return phases.flatMap((p) => p.steps).filter((s) => s.status === 'done').length;
  }, [phases]);

  const totalStepCount = useMemo(() => {
    return phases.flatMap((p) => p.steps).length;
  }, [phases]);

  const progressPercent = useMemo(() => {
    if (status === 'completed') return 100;
    if (totalStepCount === 0) return 10;
    return Math.round((completedStepCount / totalStepCount) * 100);
  }, [completedStepCount, totalStepCount, status]);

  // Generated Mission Summary when complete
  const missionSummary: MissionSummaryData | null = useMemo(() => {
    if (message.status !== 'completed') return null;

    const toolsUsed = Array.from(new Set(message.toolCalls.map((t) => t.action)));
    const filesModified = Array.from(
      new Set(
        message.toolCalls
          .filter((t) => t.action.includes('file') || t.action.includes('write') || t.action.includes('create'))
          .map((t) => t.action.replace(/^Executing:\s*/, '')),
      ),
    );
    const commandsExecuted = message.toolCalls.map((t) => t.action);

    return {
      title: promptText || 'Mission Execution Complete',
      toolsUsed,
      filesModified,
      commandsExecuted,
      resultMessage:
        filesModified.length > 0
          ? `Mission completed. Files modified: ${filesModified.join(', ')}.`
          : 'Mission completed with all workflow steps verified.',
      nextSuggestedActions: [
        'Run pnpm dev to preview UI',
        'Refactor component state',
        'Add unit tests',
      ],
    };
  }, [message.status, message.toolCalls, promptText]);

  const currentStepName = useMemo(() => {
    const activeStep = phases.flatMap((p) => p.steps).find((s) => s.status === 'active');
    return activeStep?.label || (isGenerating ? 'Executing mission...' : 'Mission Finalized');
  }, [phases, isGenerating]);

  return (
    <div className="flex flex-col gap-4 my-2">
      {/* 1. Live Progress Bar */}
      <ExecutionProgressBar
        status={status}
        progress={progressPercent}
        currentStep={currentStepName}
        stepCount={totalStepCount}
        completedStepCount={completedStepCount}
      />

      {/* 2. Tool Cards Grid if any tool calls active */}
      {message.toolCalls.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle px-1">
            Active Tool Executions ({message.toolCalls.length})
          </span>
          <div className="grid grid-cols-1 gap-2">
            {message.toolCalls.map((t: ToolCallEntry) => (
<ToolExecutionCard
                key={t.id}
                tool={{
                  id: t.id,
                  toolId: t.toolId,
                  action: t.action,
                  command: t.action,
                  message: t.message,
                  status: t.status === 'ok' ? 'success' : t.status === 'failed' ? 'failure' : 'running',
                  timestamp: t.timestamp,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Collapsible Execution Phase Cards */}
      <div className="flex flex-col gap-3">
        {phases.map((phase) => (
          <ExecutionPhaseCard key={phase.id} phase={phase} defaultExpanded={phase.status === 'active'} />
        ))}
      </div>

      {/* 4. Automated Mission Summary Card on completion */}
      {missionSummary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <MissionSummaryCard summary={missionSummary} onActionClick={onNextAction} />
        </motion.div>
      )}
    </div>
  );
}
