import { describe, it, expect } from 'vitest';
import { createPlan } from './planner';
import { UnsupportedGoalError, type StructuredGoal } from './types';

const threeJsGoal: StructuredGoal = {
  projectName: 'my-threejs-project',
  framework: 'three.js',
  language: 'typescript',
  bundler: 'vite',
  raw: 'Create a Three.js project with TypeScript and Vite',
};

describe('createPlan', () => {
  it('returns 8 tasks for a Three.js goal', () => {
    const tasks = createPlan(threeJsGoal);
    expect(tasks).toHaveLength(8);
  });

  it('names tasks step-0 through step-7', () => {
    const tasks = createPlan(threeJsGoal);
    tasks.forEach((task, i) => {
      expect(task.id).toBe(`step-${i}`);
    });
  });

  it('has correct dependency order', () => {
    const tasks = createPlan(threeJsGoal);
    const dep = (id: string) => tasks.find((t) => t.id === id)!.dependsOn;

    // step-0 has no deps
    expect(dep('step-0')).toEqual([]);
    // step-1 depends on step-0
    expect(dep('step-1')).toEqual(['step-0']);
    // step-2 depends on step-1
    expect(dep('step-2')).toEqual(['step-1']);
    // step-3 depends on step-2
    expect(dep('step-3')).toEqual(['step-2']);
    // step-4 depends on step-1
    expect(dep('step-4')).toEqual(['step-1']);
    // step-5 depends on step-1
    expect(dep('step-5')).toEqual(['step-1']);
    // step-6 depends on step-1
    expect(dep('step-6')).toEqual(['step-1']);
    // step-7 depends on step-3, step-4, step-5, step-6
    expect([...dep('step-7')].sort()).toEqual(['step-3', 'step-4', 'step-5', 'step-6']);
  });

  it('uses the goal projectName in task inputs', () => {
    const tasks = createPlan(threeJsGoal);
    // step-0 should create a directory named after the project
    const step0 = tasks.find((t) => t.id === 'step-0')!;
    expect(step0.input.path).toBe('my-threejs-project');

    // step-1 should reference the project name
    const step1 = tasks.find((t) => t.id === 'step-1')!;
    expect(step1.input.args).toContain('my-threejs-project');
  });

  it('throws UnsupportedGoalError for unknown frameworks', () => {
    const badGoal: StructuredGoal = { ...threeJsGoal, framework: 'godot' };
    expect(() => createPlan(badGoal)).toThrow(UnsupportedGoalError);
  });

  it('assigns correct toolIds to each task', () => {
    const tasks = createPlan(threeJsGoal);
    // steps 0, 4, 5, 6 are filesystem tasks
    for (const id of ['step-0', 'step-4', 'step-5', 'step-6']) {
      expect(tasks.find((t) => t.id === id)!.toolId).toBe('nova.tool.filesystem');
    }
    // steps 1, 2, 3, 7 are terminal tasks
    for (const id of ['step-1', 'step-2', 'step-3', 'step-7']) {
      expect(tasks.find((t) => t.id === id)!.toolId).toBe('nova.tool.terminal');
    }
  });
});
