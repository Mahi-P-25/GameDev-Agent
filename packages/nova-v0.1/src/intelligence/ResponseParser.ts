import type { Change, TextEdit, RollbackStrategy } from '../change-types';
import type { LLMStructuredResponse, StructuredEdit, SelectedContext } from './types';

export class ResponseParserError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'ResponseParserError';
  }
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new ResponseParserError('No JSON object found in response', raw);
  }
  return trimmed.slice(start, end + 1);
}

function validateOperation(op: string): op is StructuredEdit['operation'] {
  return ['insert-before', 'insert-after', 'replace', 'delete', 'create'].includes(op);
}

export function parseResponse(raw: string): LLMStructuredResponse {
  let jsonStr: string;
  try {
    jsonStr = extractJson(raw);
  } catch (e) {
    throw new ResponseParserError('Cannot extract JSON from response', raw);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new ResponseParserError(`Invalid JSON: ${(e as Error).message}`, raw);
  }

  if (typeof parsed.summary !== 'string') {
    throw new ResponseParserError('Missing or invalid "summary" field', raw);
  }

  if (!Array.isArray(parsed.changes)) {
    throw new ResponseParserError('Missing or invalid "changes" array', raw);
  }

  const changes: StructuredEdit[] = [];
  for (let i = 0; i < parsed.changes.length; i++) {
    const c = parsed.changes[i] as Record<string, unknown>;

    if (typeof c.file !== 'string' || !c.file) {
      throw new ResponseParserError(`Change ${i}: missing or invalid "file"`, raw);
    }
    if (typeof c.operation !== 'string' || !validateOperation(c.operation)) {
      throw new ResponseParserError(`Change ${i}: invalid operation "${String(c.operation)}"`, raw);
    }
    if (typeof c.anchor !== 'string') {
      throw new ResponseParserError(`Change ${i}: missing or invalid "anchor"`, raw);
    }
    if (typeof c.text !== 'string') {
      throw new ResponseParserError(`Change ${i}: missing or invalid "text"`, raw);
    }
    if (typeof c.reason !== 'string') {
      throw new ResponseParserError(`Change ${i}: missing or invalid "reason"`, raw);
    }

    changes.push({
      file: c.file,
      operation: c.operation,
      anchor: c.anchor,
      text: c.text,
      reason: c.reason,
    });
  }

  return { summary: parsed.summary as string, changes };
}

export function convertToChanges(
  structured: LLMStructuredResponse,
  selected: SelectedContext,
  rollback: RollbackStrategy,
): Change[] {
  return structured.changes.map((edit) => {
    const existingFile = selected.files.find((f) => f.path === edit.file);
    const isCreate = edit.operation === 'create' || !existingFile;
    const isDelete = edit.operation === 'delete';

    if (isCreate) {
      return {
        file: edit.file,
        operation: 'create',
        edits: [],
        reason: edit.reason,
        rollback,
        newContent: edit.text,
      };
    }

    if (isDelete) {
      return {
        file: edit.file,
        operation: 'delete',
        edits: [],
        reason: edit.reason,
        rollback:
          rollback.type === 'none'
            ? { type: 'backup', backupPath: `.nova/backups/${edit.file.replace(/[\\/]/g, '_')}.bak` }
            : rollback,
      };
    }

    return {
      file: edit.file,
      operation: 'edit',
      edits: [
        {
          file: edit.file,
          operation: edit.operation as TextEdit['operation'],
          anchor: edit.anchor,
          text: edit.text,
          reason: edit.reason,
        } as TextEdit,
      ],
      reason: edit.reason,
      rollback,
    };
  });
}