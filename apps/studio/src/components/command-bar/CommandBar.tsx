import { ArrowRight, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';
import { cn } from '../../design/cn';
import { QuickActionChip } from './QuickActionChip';

const ROTATING_PLACEHOLDERS: ReadonlyArray<string> = [
  'Build an F1 simulator',
  'Optimize the renderer',
  'Fix the build',
  'Generate procedural terrain assets',
  'Refactor the physics pipeline',
  'Profile frame times',
];

const QUICK_ACTIONS = [
  { label: 'Create a racing game', icon: null },
  { label: 'Optimize performance', icon: null },
  { label: 'Fix build errors', icon: null },
  { label: 'Generate 3D assets', icon: null },
];

export interface CommandBarProps {
  readonly onSubmit?: (text: string) => void;
}

/**
 * CommandBar — Nova's signature interaction. A large, generous input that reads
 * as the first surface of the studio: what Nova can do, in one line. The
 * placeholder rotates through real example commands so the intent is legible
 * before a single keystroke.
 */
export function CommandBar({ onSubmit }: CommandBarProps): ReactNode {
  const [text, setText] = useState('');
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onSubmit?.(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const ready = text.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl border bg-bg-elevated p-2 shadow-md',
          'border-border transition-all duration-base ease-standard',
          'hover:border-border-strong',
          'focus-within:border-border-accent focus-within:shadow-[0_0_0_1px_var(--color-border-accent),0_12px_32px_rgba(0,0,0,0.28)]',
        )}
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Sparkles className="size-[18px]" />
        </div>

        <div className="relative min-w-0 flex-1 py-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            spellCheck={false}
            className={cn(
              'relative z-10 w-full resize-none bg-transparent text-base leading-snug text-fg caret-accent',
              'placeholder:text-transparent focus:outline-none',
            )}
            style={{ minHeight: '30px', lineHeight: '1.5rem' }}
            aria-label="Ask Nova to build, fix, or optimize"
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 flex items-start text-base leading-snug text-fg-subtle',
              text.length > 0 && 'opacity-0',
            )}
            style={{ lineHeight: '1.5rem', paddingTop: '0.125rem' }}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={hintIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="truncate"
              >
                {ROTATING_PLACEHOLDERS[hintIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!ready}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg transition-all duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
            ready
              ? 'bg-accent text-fg-on-accent hover:bg-accent-strong'
              : 'bg-bg-inset text-fg-subtle',
            'disabled:opacity-40 disabled:pointer-events-none',
          )}
          aria-label="Run mission"
        >
          <ArrowRight className="size-4" />
        </button>
      </motion.div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="hidden text-[11px] text-fg-subtle sm:inline">Try</span>
        {QUICK_ACTIONS.map((action) => (
          <QuickActionChip
            key={action.label}
            label={action.label}
            onClick={() => setText(action.label)}
          />
        ))}
      </div>
    </div>
  );
}
