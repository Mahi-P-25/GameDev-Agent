import { describe, expect, it, vi } from 'vitest';
import { ConversationStore } from './ConversationStore';
import type { StudioApiClient } from './StudioApiClient';
import type { StudioActivity } from '@gamedev-agent/studio-api';

describe('ConversationStore — Phase 2 Conversation Engine', () => {
  it('submits goal to StudioApi and streams activity events into assistant message', async () => {
    let activityHandler: ((activity: StudioActivity) => void) | null = null;

    const mockApi: Partial<StudioApiClient> = {
      ready: true,
      getContext: () => ({ projectId: 'test-proj', rootPath: '.', activeMissionId: null } as any),
      submitGoal: vi.fn().mockResolvedValue({ goalId: 'g-123' }),
      onActivity: vi.fn().mockImplementation((handler) => {
        activityHandler = handler;
        return { dispose: () => undefined };
      }),
    };

    const store = new ConversationStore(mockApi as StudioApiClient);
    await store.sendMessage('Create a Three.js voxel terrain generator');

    expect(mockApi.submitGoal).toHaveBeenCalledWith({
      projectId: 'test-proj',
      title: 'Create a Three.js voxel terrain generator',
      description: 'Create a Three.js voxel terrain generator',
    });

    const activeThread = store.getActiveThread();
    expect(activeThread).not.toBeNull();
    expect(activeThread?.messages.length).toBe(2);

    const userMsg = activeThread?.messages[0];
    const assistantMsg = activeThread?.messages[1];

    expect(userMsg?.role).toBe('user');
    expect(userMsg?.content).toBe('Create a Three.js voxel terrain generator');
    expect(assistantMsg?.role).toBe('assistant');
    expect(assistantMsg?.status).toBe('streaming');

    // Simulate EventBus activity stream
    if (activityHandler) {
      (activityHandler as any)({
        seq: 1,
        kind: 'goal.created',
        message: 'Goal registered in Producer',
        timestamp: Date.now(),
      });

      (activityHandler as any)({
        seq: 2,
        kind: 'agent.action-started',
        message: 'Executing: npm install three',
        timestamp: Date.now(),
      });

      (activityHandler as any)({
        seq: 3,
        kind: 'agent.action-result',
        message: 'npm install three OK',
        timestamp: Date.now(),
      });

      (activityHandler as any)({
        seq: 4,
        kind: 'mission.completed',
        message: 'Mission completed successfully',
        timestamp: Date.now(),
      });
    }

    expect(assistantMsg?.thoughtTrace).toContain('Goal registered in Producer');
    expect(assistantMsg?.toolCalls.length).toBe(1);
    const toolCall = assistantMsg?.toolCalls[0];
    expect(toolCall?.action).toBe('npm install three');
    expect(toolCall?.status).toBe('ok');
    expect(assistantMsg?.status).toBe('completed');
  });

  it('cancels active generation when stopGeneration is invoked', async () => {
    const mockApi: Partial<StudioApiClient> = {
      ready: true,
      getContext: () => ({ projectId: 'p1', rootPath: '.', activeMissionId: null } as any),
      submitGoal: vi.fn().mockResolvedValue({ goalId: 'g-456' }),
      onActivity: vi.fn().mockReturnValue({ dispose: () => undefined }),
    };

    const store = new ConversationStore(mockApi as StudioApiClient);
    await store.sendMessage('Build a car physics controller');

    const thread = store.getActiveThread();
    expect(thread?.isGenerating).toBe(true);

    store.stopGeneration();

    expect(thread?.isGenerating).toBe(false);
    const assistantMsg = thread?.messages[1];
    expect(assistantMsg?.status).toBe('cancelled');
  });
});
