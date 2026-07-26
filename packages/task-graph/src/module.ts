import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { TaskScheduler } from './scheduler';
import { TaskGraphValidator } from './validator';

export const TASK_SCHEDULER_TOKEN = createServiceToken<TaskScheduler>('nova.task-scheduler');

export const TASK_GRAPH_VALIDATOR_TOKEN = createServiceToken<TaskGraphValidator>(
  'nova.task-graph-validator',
);

export const taskGraphModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.task-graph',
  register(kernel: StudioKernel): void {
    kernel.registerService({
      token: TASK_SCHEDULER_TOKEN,
      singleton: true,
      factory: () => new TaskScheduler(),
    });

    kernel.registerService({
      token: TASK_GRAPH_VALIDATOR_TOKEN,
      singleton: true,
      factory: () => new TaskGraphValidator(),
    });
  },
};
