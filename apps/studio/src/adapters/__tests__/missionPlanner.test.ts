import { describe, it, expect } from 'vitest';
import { MissionPlanner } from '../missionPlanner';

const planner = new MissionPlanner();

describe('MissionPlanner', () => {
  describe('classifyGoal', () => {
    it('classifies "Create a racing game" as create-project', () => {
      const plan = planner.plan('Create a racing game with Three.js');
      expect(plan.goal).toBe('create-project');
    });

    it('classifies "Fix camera jitter" as bug-fix', () => {
      const plan = planner.plan('Fix camera jitter');
      expect(plan.goal).toBe('bug-fix');
    });

    it('classifies "Optimize FPS" as performance', () => {
      const plan = planner.plan('Optimize FPS');
      expect(plan.goal).toBe('performance');
    });

    it('classifies "Refactor inventory system" as refactor', () => {
      const plan = planner.plan('Refactor inventory system');
      expect(plan.goal).toBe('refactor');
    });

    it('classifies "Explain architecture" as analysis', () => {
      const plan = planner.plan('Explain architecture');
      expect(plan.goal).toBe('analysis');
    });

    it('classifies "Add multiplayer support" as feature', () => {
      const plan = planner.plan('Add multiplayer support');
      expect(plan.goal).toBe('feature');
    });

    it('falls back to unknown for ambiguous requests', () => {
      const plan = planner.plan('Hello world');
      expect(plan.goal).toBe('unknown');
    });
  });

  describe('technology detection', () => {
    it('detects explicitly mentioned technologies', () => {
      const plan = planner.plan('Create a game with Three.js and TypeScript');
      const techs = plan.detectedTechnologies.map((t) => t.name);
      expect(techs).toContain('Three.js');
      expect(techs).toContain('TypeScript');
    });

    it('marks detected technologies as not inferred', () => {
      const plan = planner.plan('Build a game with Blender');
      const blender = plan.detectedTechnologies.find((t) => t.name === 'Blender');
      expect(blender?.inferred).toBe(false);
    });

    it('infers technologies from context', () => {
      const plan = planner.plan('Create a 3D game');
      const threeJs = plan.detectedTechnologies.find((t) => t.name === 'Three.js');
      expect(threeJs).toBeDefined();
      expect(threeJs?.inferred).toBe(true);
    });

    it('does not duplicate technologies', () => {
      const plan = planner.plan('Create a 3D game with Three.js');
      const threeJsOccurrences = plan.detectedTechnologies.filter((t) => t.name === 'Three.js');
      expect(threeJsOccurrences.length).toBe(1);
    });

    it('returns empty technologies for unrelated requests', () => {
      const plan = planner.plan('Fix the bug');
      expect(plan.detectedTechnologies.length).toBe(0);
    });
  });

  describe('project type detection', () => {
    it('detects Racing Game from "racing"', () => {
      const plan = planner.plan('Create a racing game');
      expect(plan.projectType).toBe('Racing Game');
    });

    it('detects FPS from "fps"', () => {
      const plan = planner.plan('Build an FPS game');
      expect(plan.projectType).toBe('FPS');
    });

    it('detects general Game Project for non-specific game requests', () => {
      const plan = planner.plan('Create a game');
      expect(plan.projectType).toBe('Game Project');
    });

    it('detects Web Application from "web app"', () => {
      const plan = planner.plan('Build a web application');
      expect(plan.projectType).toBe('Web Application');
    });

    it('detects Task for non-create goals', () => {
      const plan = planner.plan('Fix the issue');
      expect(plan.projectType).toBe('Task');
    });
  });

  describe('complexity estimation', () => {
    it('estimates high complexity for "large" requests', () => {
      const plan = planner.plan('Create a large RPG game');
      expect(plan.estimatedComplexity).toBe('high');
    });

    it('estimates low complexity for "simple" requests', () => {
      const plan = planner.plan('Simple bug fix');
      expect(plan.estimatedComplexity).toBe('low');
    });

    it('estimates high complexity with 3+ technologies', () => {
      const plan = planner.plan('Build a game with Three.js, React, TypeScript, and Blender');
      expect(plan.estimatedComplexity).toBe('high');
    });

    it('estimates medium complexity for create-project by default', () => {
      const plan = planner.plan('Create a platformer game');
      expect(plan.estimatedComplexity).toBe('medium');
    });

    it('estimates low complexity for bug-fix by default', () => {
      const plan = planner.plan('Fix a rendering issue');
      expect(plan.estimatedComplexity).toBe('low');
    });
  });

  describe('execution stage generation', () => {
    it('generates 7 stages for create-project', () => {
      const plan = planner.plan('Create a game');
      expect(plan.executionStages.length).toBe(7);
    });

    it('generates 5 stages for bug-fix', () => {
      const plan = planner.plan('Fix a bug');
      expect(plan.executionStages.length).toBe(5);
    });

    it('generates 4 stages for analysis', () => {
      const plan = planner.plan('Explain the codebase');
      expect(plan.executionStages.length).toBe(4);
    });

    it('generates 5 stages for feature', () => {
      const plan = planner.plan('Add a new feature');
      expect(plan.executionStages.length).toBe(5);
    });

    it('generates different stage labels per goal category', () => {
      const createPlan = planner.plan('Create a game');
      const fixPlan = planner.plan('Fix a bug');
      expect(createPlan.executionStages[0]?.label).not.toBe(fixPlan.executionStages[0]?.label);
    });

    it('each stage has id, label, and description', () => {
      const plan = planner.plan('Create a game');
      for (const stage of plan.executionStages) {
        expect(stage.id).toBeTruthy();
        expect(stage.label).toBeTruthy();
        expect(stage.description).toBeTruthy();
      }
    });
  });

  describe('risk detection', () => {
    it('includes project initialization risk for create-project', () => {
      const plan = planner.plan('Create a game');
      const hasInitRisk = plan.risks.some((r) =>
        r.description.toLowerCase().includes('dependenc') || r.description.toLowerCase().includes('initial')
      );
      expect(hasInitRisk).toBe(true);
    });

    it('includes high severity risk for refactoring', () => {
      const plan = planner.plan('Refactor the entire codebase');
      const hasRefactorRisk = plan.risks.some((r) =>
        r.severity === 'high' && r.description.toLowerCase().includes('refactor')
      );
      expect(hasRefactorRisk).toBe(true);
    });

    it('includes medium severity risk for scope issues', () => {
      const plan = planner.plan('Create a complex RPG game');
      const hasScopeRisk = plan.risks.some((r) =>
        r.description.toLowerCase().includes('scope')
      );
      expect(hasScopeRisk).toBe(true);
    });
  });

  describe('assumptions', () => {
    it('records assumptions for every plan', () => {
      const plan = planner.plan('Create a game');
      expect(plan.assumptions.length).toBeGreaterThan(0);
    });

    it('assumes permissions when no technology detected', () => {
      const plan = planner.plan('Hello');
      const hasPermission = plan.assumptions.some((a) =>
        a.toLowerCase().includes('permission')
      );
      expect(hasPermission).toBe(true);
    });
  });

  describe('success criteria', () => {
    it('defines criteria for every goal category', () => {
      const inputs = [
        'Create a game',
        'Fix a bug',
        'Optimize performance',
        'Refactor code',
        'Explain architecture',
        'Add a feature',
        'Hello world',
      ];
      for (const input of inputs) {
        const plan = planner.plan(input);
        expect(plan.successCriteria.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('includes build-related criteria for create-project', () => {
      const plan = planner.plan('Create a game');
      const hasBuild = plan.successCriteria.some((c) =>
        c.toLowerCase().includes('build')
      );
      expect(hasBuild).toBe(true);
    });
  });

  describe('ability-based planning', () => {
    it('always includes core file and command abilities', () => {
      const plan = planner.plan('Hello world');
      const abilities = plan.requiredAbilities;
      expect(abilities).toContain('read-files');
      expect(abilities).toContain('write-files');
      expect(abilities).toContain('run-commands');
      expect(abilities).toContain('version-control-status');
    });

    it('includes edit abilities for create-project', () => {
      const plan = planner.plan('Create a game');
      expect(plan.requiredAbilities).toContain('edit-code');
      expect(plan.requiredAbilities).toContain('open-editor');
    });

    it('includes search abilities for bug-fix', () => {
      const plan = planner.plan('Fix camera jitter');
      expect(plan.requiredAbilities).toContain('search-text');
      expect(plan.requiredAbilities).toContain('edit-code');
    });

    it('includes version-control-init for create-project', () => {
      const plan = planner.plan('Create a game');
      expect(plan.requiredAbilities).toContain('version-control-init');
    });

    it('includes preview for web/browser projects', () => {
      const plan = planner.plan('Create a web application');
      expect(plan.requiredAbilities).toContain('preview-project');
    });

    it('includes 3d abilities when Blender detected', () => {
      const plan = planner.plan('Create a 3D game with Blender');
      expect(plan.requiredAbilities).toContain('3d-model');
      expect(plan.requiredAbilities).toContain('render-scene');
    });
  });

  describe('tool selection (backward compat)', () => {
    it('always includes VS Code, Terminal, and Git', () => {
      const plan = planner.plan('Hello world');
      const toolIds = plan.requiredTools.map((t) => t.id);
      expect(toolIds).toContain('vscode');
      expect(toolIds).toContain('terminal');
      expect(toolIds).toContain('git');
    });

    it('includes Browser for create-project', () => {
      const plan = planner.plan('Create a game');
      const toolIds = plan.requiredTools.map((t) => t.id);
      expect(toolIds).toContain('browser');
    });

    it('includes Blender when detected', () => {
      const plan = planner.plan('Create a 3D game with Blender');
      const toolIds = plan.requiredTools.map((t) => t.id);
      expect(toolIds).toContain('blender');
    });
  });

  describe('plan structure', () => {
    it('generates a unique missionId', () => {
      const planA = planner.plan('Create a game');
      const planB = planner.plan('Create a game');
      expect(planA.missionId).not.toBe(planB.missionId);
    });

    it('generates a summary that captures the request', () => {
      const plan = planner.plan('Create a racing game with Three.js');
      expect(plan.summary).toContain('Racing Game');
    });
  });

  describe('edge cases', () => {
    it('handles empty text gracefully', () => {
      const plan = planner.plan('');
      expect(plan.goal).toBe('unknown');
      expect(plan.executionStages.length).toBe(5);
    });

    it('handles very short text', () => {
      const plan = planner.plan('x');
      expect(plan).toBeDefined();
      expect(plan.missionId).toBeTruthy();
    });

    it('handles text with only numbers', () => {
      const plan = planner.plan('42');
      expect(plan.goal).toBe('unknown');
    });
  });
});
