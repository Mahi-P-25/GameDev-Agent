import { MemoryConfigSource } from '@gamedev-agent/config';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { Kernel } from '@gamedev-agent/kernel';
import { EVENT_BUS_TOKEN } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { describe, expect, it } from 'vitest';
import {
  ProjectClosed,
  ProjectCreated,
  ProjectDeleted,
  ProjectOpened,
  ProjectRenamed,
} from './ProjectEvents';
import type { ProjectCreatedPayload } from './ProjectEvents';
import { PROJECT_MANAGER_TOKEN, ProjectManager, projectModule } from './index';

describe('Project System — kernel integration', () => {
  it('installs via the kernel module and emits real bus events end-to-end', async () => {
    const bus = new InMemoryEventBus('test');
    const kernel = new Kernel({
      namespace: 'test',
      eventBus: bus,
      logger: new RootLogger('test', [new ConsoleLogSink()]),
      configSources: [new MemoryConfigSource()],
      modules: [projectModule],
    });
    await kernel.boot();

    const manager = await kernel.services.resolve(PROJECT_MANAGER_TOKEN);
    expect(manager).toBeInstanceOf(ProjectManager);

    const createdPayloads: Array<ProjectCreatedPayload> = [];
    bus.subscribe(ProjectCreated, (env) => {
      createdPayloads.push(env.payload);
    });

    const openedNames: Array<string> = [];
    bus.subscribe(ProjectOpened, (env) => {
      openedNames.push(env.payload.name);
    });

    const closedNames: Array<string> = [];
    bus.subscribe(ProjectClosed, (env) => {
      closedNames.push(env.payload.name);
    });

    const renamed: Array<string> = [];
    bus.subscribe(ProjectRenamed, (env) => {
      renamed.push(env.payload.name);
    });

    let deletedCount = 0;
    bus.subscribe(ProjectDeleted, () => {
      deletedCount += 1;
    });

    const project = await manager.create({ name: 'Kernel Game', rootPath: '/kg', engine: 'godot' });
    const opened = await manager.open(project.id);
    await manager.rename(opened.id, 'Renamed Game');
    await manager.close(opened.id);
    await manager.delete(opened.id);

    expect(createdPayloads).toHaveLength(1);
    expect(createdPayloads[0]?.name).toBe('Kernel Game');
    expect(createdPayloads[0]?.engine).toBe('godot');
    expect(openedNames).toEqual(['Kernel Game']); // renamed after open, so open carried original name
    expect(renamed).toEqual(['Renamed Game']);
    expect(closedNames).toEqual(['Renamed Game']);
    expect(deletedCount).toBe(1);

    // Token identity is stable across resolves (singleton).
    const again = await kernel.services.resolve(PROJECT_MANAGER_TOKEN);
    expect(again).toBe(manager);

    await kernel.shutdown();
  });

  it('resolves the manager through the EVENT_BUS_TOKEN-independent surface', async () => {
    const kernel = new Kernel({ namespace: 'test', modules: [projectModule] });
    await kernel.boot();
    const bus = await kernel.services.resolve(EVENT_BUS_TOKEN);
    const manager = await kernel.services.resolve(PROJECT_MANAGER_TOKEN);
    const project = await manager.create({ name: 'P', rootPath: '/x' });
    expect(bus.metrics().published).toBeGreaterThanOrEqual(1);
    expect(manager.find(project.id)?.id).toBe(project.id);
    await kernel.shutdown();
  });
});
