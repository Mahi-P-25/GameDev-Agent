import { ChevronDown, Lightbulb, ListRestart, Target } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { cn } from '../../design/cn';
import { Card } from '../ui/Card';

export interface ReasoningPanelProps {
  readonly hypothesis?: string;
  readonly confidence?: number;
  readonly nextAction?: string;
  readonly alternatives?: ReadonlyArray<string>;
  readonly className?: string;
}

const DEFAULT_HYPOTHESIS =
  'The rendering bottleneck is repeated uniform updates in WebGLRenderer.tsx. Batching them behind a dirty-flag cache should cut GPU state changes and recover the 8.3 ms frame budget.';

const DEFAULT_NEXT_ACTION =
  'Implement the uniform cache, then re-benchmark against the three reference scenes.';

const DEFAULT_ALTERNATIVES = [
  'Reduce overdraw by merging translucent draw calls in the opaque pass first.',
  'Move instance attribute updates to a persistent vertex buffer.',
  'Accept a 2 ms shadow-map quality trade-off to free frame time.',
];

/**
 * ReasoningPanel — a prose-first surface for the current hypothesis. The
 * hypothesis, confidence, and next action lead; alternatives are tucked behind
 * progressive disclosure so they never overwhelm the reading line.
 */
export function ReasoningPanel({
  hypothesis = DEFAULT_HYPOTHESIS,
  confidence = 0.87,
  nextAction = DEFAULT_NEXT_ACTION,
  alternatives = DEFAULT_ALTERNATIVES,
  className,
}: ReasoningPanelProps): ReactNode {
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <Card
      title="Reasoning"
      subtitle="The working hypothesis behind this step"
      actions={
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
          <span className="text-fg-subtle">confidence</span>
          <span className="font-medium text-accent tabular-nums">
            {Math.round(confidence * 100)}%
          </span>
        </span>
      }
      className={className}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
            <Lightbulb className="size-3.5" />
          </span>
          <p className="text-sm leading-relaxed text-fg">{hypothesis}</p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-inset p-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-bg-hover text-fg-muted">
            <Target className="size-3.5" />
          </span>
          <div className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Next action
            </span>
            <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{nextAction}</p>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowAlternatives((v) => !v)}
            className="flex w-full items-center gap-2 text-xs text-fg-subtle transition-colors duration-fast hover:text-fg"
            aria-expanded={showAlternatives}
          >
            <ListRestart className="size-3.5" />
            <span>Alternatives considered</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] text-fg-subtle">{alternatives.length}</span>
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform duration-fast',
                  showAlternatives && 'rotate-180',
                )}
              />
            </span>
          </button>
          <AnimatePresence initial={false}>
            {showAlternatives && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <ul className="mt-2 space-y-2">
                  {alternatives.map((alt) => (
                    <li
                      key={alt}
                      className="flex items-start gap-2 text-[13px] leading-relaxed text-fg-subtle"
                    >
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-subtle" />
                      <span>{alt}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}
