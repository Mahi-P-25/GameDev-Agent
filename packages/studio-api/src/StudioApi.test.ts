import { CapabilityManager, NoopToolProbe } from '@gamedev-agent/capabilities';
import { CoordinatorManager } from '@gamedev-agent/coordinator';
import { MissionValidationError } from '@gamedev-agent/coordinator';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { PlannerManager } from '@gamedev-agent/planner';
import { ProducerManager } from '@gamedev-agent/producer';
import { ProjectManager } from '@gamedev-agent/project';
import { ProjectNotFoundError } from '@gamedev-agent/project';
import { WorkflowManager } from '@gamedev-agent/workflow';
import { describe, expect, it } from 'vitest';
import { STUDIO_API_TOKEN, StudioApi } from './StudioApi';
import { StudioApiError, StudioNotFoundError, StudioRejectionError } from './StudioApiErrors';
import { WorkflowRunner } from './workflows/WorkflowRunner';
import { registerDevWorkflowTemplates } from './workflows/WorkflowTemplates';

const noopLogger: Logger = {
  namespace: 'test',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

function makeApi(): { api: StudioApi; coordinator: CoordinatorManager } {
  const bus = new InMemoryEventBus('test');
  const logger = noopLogger;
  const coordinator = new CoordinatorManager({ eventBus: bus, logger });
  const projects = new ProjectManager({ eventBus: bus, logger });
  const capabilities = new CapabilityManager({
    eventBus: bus,
    logger,
    toolProbe: new NoopToolProbe(),
  });
  const producer = new ProducerManager({ eventBus: bus, logger });
  const planner = new PlannerManager({ eventBus: bus, logger });
  const workflow = new WorkflowManager({ eventBus: bus, logger });
  const workflowRunner = new WorkflowRunner(workflow);
  void registerDevWorkflowTemplates((definition) => workflow.register(definition));
  return {
    api: new StudioApi({
      coordinator,
      projects,
      capabilities,
      producer,
      planner,
      workflow,
      workflowRunner,
      bus,
    }),
    coordinator,
  };
}

describe('StudioApi — projects', () => {
  it('creates, reads, and lists projects through the façade', async () => {
    const { api } = makeApi();
    const created = await api.createProject({
      name: 'Demo',
      rootPath: '/tmp/demo',
      description: 'A demo project',
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Demo');
    expect(created.description).toBe('A demo project');

    const fetched = api.getProject(created.id);
    expect(fetched.id).toBe(created.id);

    const list = api.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);
  });

  it('throws StudioNotFoundError for an unknown project', () => {
    const { api } = makeApi();
    expect(() => api.getProject('does-not-exist')).toThrow(StudioNotFoundError);
  });
});

describe('StudioApi — missions', () => {
  it('submits, approves, and reads a mission', async () => {
    const { api, coordinator } = makeApi();
    const project = await api.createProject({ name: 'P', rootPath: '/tmp/p' });
    const mission = await api.createMission({
      projectId: project.id,
      title: 'Build a thing',
      brief: 'Make it good',
      priority: 'high',
    });
    expect(mission.id).toBeDefined();
    expect(mission.projectId).toBe(project.id);
    expect(mission.status).toBe('submitted');
    expect(mission.priority).toBe('high');

    await coordinator.accept(mission.id as never);
    await coordinator.analyse(mission.id as never);
    await coordinator.requestApproval(mission.id as never);
    const approved = await api.approveMission(mission.id);
    expect(approved.status).toBe('approved');
  });

  it('cancels a mission with a reason', async () => {
    const { api } = makeApi();
    const project = await api.createProject({ name: 'P', rootPath: '/tmp/p' });
    const mission = await api.createMission({ projectId: project.id, title: 'T', brief: 'B' });
    const cancelled = await api.cancelMission(mission.id, 'no longer needed');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('no longer needed');
  });

  it('reports coordinator status aggregated from missions', async () => {
    const { api } = makeApi();
    const project = await api.createProject({ name: 'P', rootPath: '/tmp/p' });
    await api.createMission({ projectId: project.id, title: 'A', brief: 'a' });
    const status = api.getCoordinatorStatus();
    expect(status.total).toBe(1);
    expect(status.active).toBe(1);
    expect(status.terminal).toBe(0);
  });
});

describe('StudioApi — capabilities', () => {
  it('lists capabilities with health and enabled state', () => {
    const { api } = makeApi();
    const caps = api.listCapabilities();
    expect(caps.length).toBeGreaterThan(0);
    for (const c of caps) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.enabled).toBe('boolean');
      expect(['unknown', 'healthy', 'degraded', 'unhealthy']).toContain(c.health);
    }
    const health = api.getHealth();
    expect(health.total).toBe(caps.length);
  });
});

describe('StudioApi — dependency boundary via translate()', () => {
  it('maps MissionValidationError to StudioRejectionError', () => {
    const { api } = makeApi();
    const inner = new MissionValidationError([{ field: 'title', reason: 'required' }]);
    const mapped = api.translate(inner);
    expect(mapped).toBeInstanceOf(StudioRejectionError);
    expect(mapped).toBeInstanceOf(StudioApiError);
  });

  it('maps ProjectNotFoundError to StudioNotFoundError', () => {
    const { api } = makeApi();
    const inner = new ProjectNotFoundError('proj-xyz' as never);
    const mapped = api.translate(inner);
    expect(mapped).toBeInstanceOf(StudioNotFoundError);
    expect((mapped as StudioNotFoundError).kind).toBe('project');
  });

  it('passes through an already-stable StudioApiError', () => {
    const { api } = makeApi();
    const stable = new StudioApiError('boom');
    expect(api.translate(stable)).toBe(stable);
  });
});

describe('StudioApi — activity feed', () => {
  it('normalizes coordinator, project, and capability events into one stream', async () => {
    const { api } = makeApi();
    const seen: string[] = [];
    api.onActivity((a) => seen.push(a.kind));

    const project = await api.createProject({ name: 'P', rootPath: '/tmp/p' });
    await api.createMission({ projectId: project.id, title: 'T', brief: 'B' });

    const feed = api.getActivity();
    const kinds = feed.map((a) => a.kind);
    expect(kinds).toContain('project.created');
    expect(kinds).toContain('mission.submitted');
    expect(seen).toContain('project.created');
  });

  it('stops delivering once the subscription is disposed', async () => {
    const { api } = makeApi();
    let count = 0;
    const sub = api.onActivity(() => {
      count += 1;
    });
    await api.createProject({ name: 'P', rootPath: '/tmp/p' });
    expect(count).toBe(1);
    sub.dispose();
    await api.createProject({ name: 'Q', rootPath: '/tmp/q' });
    expect(count).toBe(1);
  });
});

describe('StudioApi — DI token', () => {
  it('exposes a service token with a stable id', () => {
    expect(STUDIO_API_TOKEN.id).toBe('nova.studio-api');
  });
});
