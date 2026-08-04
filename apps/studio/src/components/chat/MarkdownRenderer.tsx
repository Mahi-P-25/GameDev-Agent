import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  readonly content: string;
}

/**
 * Lightweight, robust Markdown renderer for chat responses.
 * Renders paragraphs, code blocks with language detection & copy buttons,
 * lists, inline code, and emphasis.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactNode {
  // Parse code blocks vs markdown text
  const parts: Array<{ type: 'code' | 'text'; language?: string; text: string }> = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'typescript',
      text: match[2] || '',
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-fg">
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return <CodeBlock key={i} language={part.language || 'typescript'} code={part.text.trim()} />;
        }

        // Process text paragraphs and bullet points
        const lines = part.text.split('\n');
        return (
          <React.Fragment key={i}>
            {lines.map((line, j) => {
              if (line.startsWith('# ')) {
                return <h1 key={j} className="mt-3 text-lg font-semibold tracking-tight text-fg">{line.slice(2)}</h1>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={j} className="mt-2 text-base font-semibold tracking-tight text-fg">{line.slice(3)}</h2>;
              }
              if (line.startsWith('### ')) {
                return <h3 key={j} className="mt-2 text-sm font-semibold tracking-tight text-fg">{line.slice(4)}</h3>;
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={j} className="flex items-start gap-2 pl-2 text-fg-muted">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{renderInline(line.slice(2))}</span>
                  </div>
                );
              }
              if (!line.trim()) {
                return <div key={j} className="h-1" />;
              }
              return <p key={j} className="text-fg-muted">{renderInline(line)}</p>;
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Inline code `foo`
  const codeRegex = /`([^`]+)`/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <code key={match.index} className="rounded bg-bg-surface px-1.5 py-0.5 font-mono text-[12px] font-medium text-accent border border-border">
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
