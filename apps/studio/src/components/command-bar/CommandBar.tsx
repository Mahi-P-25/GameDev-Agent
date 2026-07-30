import { ArrowRight, Sparkles } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../design/cn';
import { QuickActionChip } from './QuickActionChip';

const QUICK_ACTIONS = [
  { label: 'Create a racing game', icon: null },
  { label: 'Optimize performance', icon: null },
  { label: 'Fix build errors', icon: null },
  { label: 'Generate 3D assets', icon: null },
];

export interface CommandBarProps {
  readonly onSubmit?: (text: string) => void;
}

export function CommandBar({ onSubmit }: CommandBarProps): ReactNode {
  const [text, setText] = useState('');

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

  return (
    <div className="flex flex-col gap-4">
      <div className={cn(
        'relative flex items-start gap-3 rounded-xl border border-border bg-bg-elevated',
        'transition-all duration-200',
        'focus-within:border-border-accent focus-within:shadow-[0_0_0_1px_var(--color-border-accent)]',
        'p-3',
      )}>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Sparkles className="size-4" />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Nova to build, fix, optimize anything…"
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-base text-fg placeholder:text-fg-subtle',
            'py-1.5 leading-snug focus:outline-none',
          )}
          style={{ minHeight: '28px' }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim()}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg transition-all duration-fast',
            text.trim()
              ? 'bg-accent text-bg-base hover:bg-accent-strong'
              : 'bg-bg-inset text-fg-subtle',
            'disabled:opacity-40',
          )}
          aria-label="Submit mission"
        >
          <ArrowRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
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
