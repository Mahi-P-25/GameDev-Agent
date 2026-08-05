import React from 'react';
import { CodeBlock } from './CodeBlock';
import { cn } from '../../design/cn';

interface MarkdownRendererProps {
  readonly content: string;
}

/**
 * Lightweight, robust Markdown renderer for chat responses.
 * Supports paragraphs, headings, fenced code blocks with copy buttons, inline
 * code, bold / italic / strikethrough, links, ordered + unordered lists,
 * blockquotes, horizontal rules, and GitHub-style tables.
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

        return <TextBlock key={i} text={part.text} />;
      })}
    </div>
  );
}

/** Render a chunk of plain (non-code) markdown, splitting out block elements. */
function TextBlock({ text }: { readonly text: string }): React.ReactNode {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Horizontal rule
    if (/^(\s*)(---|\*\*\*|___)(\s*)$/.test(line)) {
      blocks.push(<hr key={`hr-${i}`} className="my-2 border-border" />);
      i += 1;
      continue;
    }

    // Blockquote (consume consecutive quoted lines)
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        quoteLines.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-accent/50 bg-bg-surface/40 px-3 py-1 text-fg-muted"
        >
          {renderInline(quoteLines.join('\n'))}
        </blockquote>,
      );
      continue;
    }

    // Table block
    if (/^\s*\|/.test(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i] ?? '')) {
        tableLines.push(lines[i] ?? '');
        i += 1;
      }
      blocks.push(<TableBlock key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(Math.max((heading[1]?.length ?? 1), 1), 6);
      const content = renderInline(heading[2] ?? '');
      const cls =
        level === 1
          ? 'mt-3 text-lg font-semibold tracking-tight text-fg'
          : level === 2
            ? 'mt-2 text-base font-semibold tracking-tight text-fg'
            : level === 3
              ? 'mt-2 text-sm font-semibold tracking-tight text-fg'
              : 'mt-1.5 text-[13px] font-semibold text-fg';
      const Tag = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' }[level] ?? 'h4';
      blocks.push(
        React.createElement(Tag, { key: `h-${i}`, className: cls }, content),
      );
      i += 1;
      continue;
    }

    // Unordered list (consume consecutive items)
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="flex flex-col gap-1 pl-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-fg-muted">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list (consume consecutive items)
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="flex list-none flex-col gap-1 pl-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-fg-muted">
              <span className="mt-px w-4 shrink-0 text-right font-mono text-[11px] text-accent">
                {idx + 1}.
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Paragraph — consume until a blank line or a block-start marker
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]?.trim() &&
      !/^\s*\|/.test(lines[i] ?? '') &&
      !/^\s*[-*+]\s+/.test(lines[i] ?? '') &&
      !/^\s*\d+[.)]\s+/.test(lines[i] ?? '') &&
      !/^>\s?/.test(lines[i] ?? '') &&
      !/^(#{1,6})\s+/.test(lines[i] ?? '')
    ) {
      para.push(lines[i] ?? '');
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-fg-muted">
        {renderInline(para.join('\n'))}
      </p>,
    );
  }

  return (
    <React.Fragment>
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>{block}</React.Fragment>
      ))}
    </React.Fragment>
  );
}

/** Render a GitHub-style pipe table. */
function TableBlock({ lines }: { readonly lines: ReadonlyArray<string> }): React.ReactNode {
  const rows = lines
    .map((line) => line.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').split(/\s*\|\s*/))
    .filter((cells) => cells.length > 0);

  if (rows.length === 0) return null;

  const header = rows[0] ?? [];
  const isSeparator = (row: ReadonlyArray<string>): boolean =>
    row.every((cell) => /^:?-{1,}:?$/.test(cell.trim()));

  const body = rows.slice(1).filter((row) => !isSeparator(row));

  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-border bg-bg-surface/40">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {header.map((cell, idx) => (
              <th key={idx} className="px-3 py-1.5 font-semibold text-fg">
                {renderInline(cell.trim())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIdx) => (
            <tr key={rowIdx} className={cn('border-b border-border/50 last:border-b-0', rowIdx % 2 === 1 && 'bg-bg-inset/40')}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-1.5 text-fg-muted">
                  {renderInline(cell.trim())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render inline markdown: code, links, bold, italic, strikethrough, emphasis. */
function renderInline(text: string): React.ReactNode {
  return renderInlineChunks(text);
}

type InlineToken =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'code'; readonly value: string }
  | { readonly type: 'link'; readonly label: string; readonly href: string }
  | { readonly type: 'bold'; readonly value: string }
  | { readonly type: 'italic'; readonly value: string }
  | { readonly type: 'strike'; readonly value: string };

const INLINE_PATTERNS: ReadonlyArray<{ readonly re: RegExp; readonly type: InlineToken['type'] }> = [
  { re: /`([^`]+)`/, type: 'code' },
  { re: /\[([^\]]+)\]\(([^)\s]+)\)/, type: 'link' },
  { re: /\*\*([^*]+)\*\*/, type: 'bold' },
  { re: /__([^_]+)__/, type: 'bold' },
  { re: /~~([^~]+)~~/, type: 'strike' },
  { re: /\*([^*]+)\*/, type: 'italic' },
  { re: /_([^_]+)_/, type: 'italic' },
];

function renderInlineChunks(input: string): React.ReactNode {
  const output: React.ReactNode[] = [];
  let remaining = input;
  let key = 0;
  let guard = 0;

  while (remaining.length > 0 && guard < 500) {
    guard += 1;
    let bestMatch: RegExpExecArray | null = null;
    let bestType: InlineToken['type'] | null = null;

    for (const pattern of INLINE_PATTERNS) {
      const m = pattern.re.exec(remaining);
      if (m && (bestMatch === null || m.index < bestMatch.index)) {
        bestMatch = m;
        bestType = pattern.type;
      }
    }

    if (bestMatch === null || bestType === null || bestMatch.index === -1) {
      output.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }

    if (bestMatch.index > 0) {
      output.push(<React.Fragment key={key++}>{remaining.slice(0, bestMatch.index)}</React.Fragment>);
    }

    const tokenText = bestMatch[0];
    const inner = bestMatch[1] ?? '';
    switch (bestType) {
      case 'code':
        output.push(
          <code
            key={key++}
            className="rounded bg-bg-surface px-1.5 py-0.5 font-mono text-[12px] font-medium text-accent border border-border"
          >
            {inner}
          </code>,
        );
        break;
      case 'link': {
        const href = bestMatch[2] ?? '#';
        output.push(
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 transition-colors duration-fast hover:text-accent-strong"
          >
            {inner}
          </a>,
        );
        break;
      }
      case 'bold':
        output.push(
          <strong key={key++} className="font-semibold text-fg">
            {renderInlineChunks(inner)}
          </strong>,
        );
        break;
      case 'italic':
        output.push(
          <em key={key++} className="italic text-fg">
            {renderInlineChunks(inner)}
          </em>,
        );
        break;
      case 'strike':
        output.push(
          <del key={key++} className="text-fg-subtle line-through decoration-fg-subtle/50">
            {renderInlineChunks(inner)}
          </del>,
        );
        break;
    }

    remaining = remaining.slice(bestMatch.index + tokenText.length);
  }

  return output;
}
