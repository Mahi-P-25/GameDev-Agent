import { describe, expect, it } from 'vitest';
import { ContextAssembler } from './ContextAssembler';

describe('ContextAssembler', () => {
  it('should build a complete structured context package with default fallback values', () => {
    const pkg = ContextAssembler.buildContext({});

    expect(pkg).toBeDefined();
    expect(pkg.activeProject).not.toBeNull();
    expect(pkg.activeProject?.name).toBe('GameDev-Agent Workspace');
    expect(pkg.openEditorTabs.length).toBeGreaterThan(0);
    expect(pkg.activeFile?.name).toBe('main.ts');
    expect(pkg.cursorPosition).toEqual({ line: 1, column: 1 });
    expect(pkg.projectIntelligence.symbolCount).toBe(142);
    expect(pkg.gitStatus.branch).toBe('main');
    expect(pkg.gitStatus.isClean).toBe(true);
    expect(pkg.timestamp).toBeGreaterThan(0);
  });

  it('should include previous conversation turns when activeThread is provided', () => {
    const mockThread = {
      id: 't-123',
      title: 'Fix Physics Bug',
      createdAt: '10:00 AM',
      updatedAt: 'Just now',
      messages: [
        {
          id: 'm1',
          role: 'user' as const,
          content: 'Add car suspension physics',
          timestamp: '10:00 AM',
          status: 'completed' as const,
          thoughtTrace: [],
          toolCalls: [],
          memoryHits: [],
        },
        {
          id: 'm2',
          role: 'assistant' as const,
          content: 'Implemented spring damper simulation in Suspension.ts',
          timestamp: '10:01 AM',
          status: 'completed' as const,
          thoughtTrace: [],
          toolCalls: [],
          memoryHits: [],
        },
      ],
    };

    const pkg = ContextAssembler.buildContext({ activeThread: mockThread });

    expect(pkg.previousConversation.length).toBe(2);
    expect(pkg.previousConversation[0]?.content).toBe('Add car suspension physics');
    expect(pkg.previousConversation[1]?.content).toBe('Implemented spring damper simulation in Suspension.ts');
  });
});
