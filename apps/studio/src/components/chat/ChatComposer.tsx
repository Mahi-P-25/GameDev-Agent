import { Paperclip, ArrowUp, Square, RefreshCw, X, FileCode, Sparkles, Command } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '../../design/cn';

interface ChatComposerProps {
  readonly onSend: (prompt: string) => void;
  readonly isGenerating?: boolean;
  readonly onStop?: () => void;
  readonly onRegenerate?: () => void;
}

const QUICK_PROMPTS = [
  '⚡ Fix build errors',
  '🧪 Write unit tests',
  '🔍 Analyze architecture',
  '🛠 Refactor component',
];

export function ChatComposer({ onSend, isGenerating = false, onStop, onRegenerate }: ChatComposerProps): React.ReactNode {
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && isGenerating && onStop) {
      onStop();
    }
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setText('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const names = Array.from(e.dataTransfer.files).map((f) => f.name);
      setAttachedFiles((prev) => [...prev, ...names]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const names = Array.from(e.target.files).map((f) => f.name);
      setAttachedFiles((prev) => [...prev, ...names]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const insertQuickPrompt = (prompt: string) => {
    setText((prev) => (prev ? `${prev}\n${prompt}` : prompt));
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative mx-auto w-full max-w-4xl px-4 pb-6"
    >
      {/* Quick Prompts Bar */}
      {!text && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] font-medium text-fg-subtle flex items-center gap-1 mr-1">
            <Sparkles className="size-3 text-accent" /> Quick:
          </span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => insertQuickPrompt(qp.replace(/^[^\s]+\s/, ''))}
              className="rounded-full border border-border/80 bg-bg-panel/80 px-2.5 py-1 text-[11px] font-medium text-fg-muted backdrop-blur-md transition-all duration-fast hover:border-accent/40 hover:bg-bg-hover hover:text-accent"
            >
              {qp}
            </button>
          ))}
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-x-4 inset-y-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent/15 backdrop-blur-md transition-all duration-fast">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <Paperclip className="size-5 animate-bounce" />
            <span>Drop files here to attach to prompt</span>
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="relative rounded-2xl border border-border bg-bg-panel/90 p-3 shadow-lg backdrop-blur-xl transition-all duration-fast focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
        {/* Attached Files List */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-2.5 py-1 text-xs font-medium text-fg-muted shadow-sm"
              >
                <FileCode className="size-3.5 text-accent" />
                <span className="max-w-[150px] truncate">{file}</span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="rounded hover:bg-bg-hover text-fg-subtle hover:text-fg"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Nova to build features, fix bugs, or optimize performance… (Enter to send, Shift+Enter for line break)"
          rows={1}
          className="w-full resize-none bg-transparent px-2 py-1 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
        />

        {/* Action Toolbar */}
        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-bg-surface/50 px-2.5 py-1 text-fg-muted transition-colors duration-fast hover:border-accent/40 hover:bg-bg-hover hover:text-fg"
              title="Attach context files"
            >
              <Paperclip className="size-3.5 text-accent" />
              <span>Attach</span>
            </button>

            {onStop && isGenerating && (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-accent transition-colors duration-fast hover:bg-accent/25"
                title="Stop generation"
              >
                <Square className="size-3 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            )}

            {onRegenerate && !isGenerating && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
                title="Regenerate previous response"
              >
                <RefreshCw className="size-3" />
                <span className="hidden sm:inline">Retry</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] text-fg-subtle font-mono sm:inline-flex items-center gap-1">
              <Command className="size-3" /> + Enter to send
            </span>
            <span className="text-[11px] text-fg-subtle font-mono">{text.length} chars</span>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || isGenerating}
              className={cn(
                'grid size-8 place-items-center rounded-xl transition-all duration-fast',
                text.trim() && !isGenerating
                  ? 'bg-accent text-accent-fg shadow-md hover:scale-105 active:scale-95'
                  : 'bg-bg-surface text-fg-subtle opacity-40 cursor-not-allowed'
              )}
            >
              <ArrowUp className="size-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
