import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { SignatureRule } from '../brand';

interface MissionInputProps {
  readonly onExecute?: (mission: string) => void;
}

export function MissionInput({ onExecute }: MissionInputProps) {
  const [text, setText] = useState('');

  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <h1 className="nova-hero-text">
          What do you want to build today?
        </h1>
        <p className="nova-subtext">
          Describe your idea and Nova will plan, generate, execute and remember.
        </p>
        <SignatureRule />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl"
      >
        <div className="glass-input group relative flex items-start gap-3 rounded-2xl p-1">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe your mission... e.g., Build a REST API for a todo app with authentication"
            className="flex-1 resize-none bg-transparent px-4 pt-4 pb-3 text-base text-[#f5f5f5] placeholder:text-[#5c5c5c] focus:outline-none"
          />
          <div className="flex items-end gap-2 p-3">
            <button
              type="button"
              onClick={() => onExecute?.(text)}
              className="flex items-center gap-2 rounded-xl bg-[#d4af37] px-5 py-2.5 text-sm font-semibold text-[#050505] transition-all duration-200 hover:bg-[#e4c458] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] active:scale-[0.98]"
            >
              <Sparkles className="size-4" />
              Execute
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
