import { describe, it, expect } from 'vitest';
import { parseGoal } from './goal-parser';
import { ParseError, UnsupportedGoalError } from './types';

describe('parseGoal', () => {
  it('parses "Create a Three.js + TypeScript + Vite project"', () => {
    const goal = parseGoal('Create a Three.js + TypeScript + Vite project');
    expect(goal.framework).toBe('three.js');
    expect(goal.language).toBe('typescript');
    expect(goal.bundler).toBe('vite');
    expect(goal.projectName).toMatch(/^create-a-three/);
  });

  it('parses "Set up a new Vite project with Three.js and TS"', () => {
    const goal = parseGoal('Set up a new Vite project with Three.js and TS');
    expect(goal.framework).toBe('three.js');
    expect(goal.language).toBe('typescript');
    expect(goal.bundler).toBe('vite');
  });

  it('parses "Initialize a Three.js project" with defaults', () => {
    const goal = parseGoal('Initialize a Three.js project');
    expect(goal.framework).toBe('three.js');
    expect(goal.language).toBe('typescript');
    expect(goal.bundler).toBe('vite');
  });

  it('parses "threejs" shorthand', () => {
    const goal = parseGoal('threejs project');
    expect(goal.framework).toBe('three.js');
  });

  it('throws UnsupportedGoalError for unsupported frameworks', () => {
    expect(() => parseGoal('Make a game in Godot')).toThrow(UnsupportedGoalError);
  });

  it('throws ParseError for empty message', () => {
    expect(() => parseGoal('')).toThrow(ParseError);
    expect(() => parseGoal('   ')).toThrow(ParseError);
  });

  it('stores raw message', () => {
    const msg = 'Create a Three.js project';
    const goal = parseGoal(msg);
    expect(goal.raw).toBe(msg);
  });

  it('generates a slug from the message as projectName', () => {
    const goal = parseGoal('Create a Three.js Project!!!');
    expect(goal.projectName).toBe('create-a-three-js-project');
  });
});
