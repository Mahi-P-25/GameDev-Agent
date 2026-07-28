import { UnsupportedGoalError, type StructuredGoal, type Task } from './types';

export function createPlan(goal: StructuredGoal): Task[] {
  if (goal.framework !== 'three.js') {
    throw new UnsupportedGoalError(`Framework "${goal.framework}" is not supported in v0.1`);
  }

  const p = goal.projectName;

  return [
    {
      id: 'step-0',
      label: 'Create project directory',
      toolId: 'nova.tool.filesystem',
      action: 'files.create',
      input: { path: p, kind: 'directory' },
      timeoutMs: 5_000,
      dependsOn: [],
    },
    {
      id: 'step-1',
      label: 'Initialize Vite project',
      toolId: 'nova.tool.terminal',
      action: 'terminal.run',
      input: {
        command: 'npm',
        args: ['create', 'vite@latest', p, '--', '--template', 'vanilla-ts'],
      },
      timeoutMs: 30_000,
      dependsOn: ['step-0'],
    },
    {
      id: 'step-2',
      label: 'Install template dependencies',
      toolId: 'nova.tool.terminal',
      action: 'terminal.run',
      input: { command: 'npm', args: ['install'], cwd: p },
      timeoutMs: 60_000,
      dependsOn: ['step-1'],
    },
    {
      id: 'step-3',
      label: 'Install Three.js',
      toolId: 'nova.tool.terminal',
      action: 'terminal.run',
      input: { command: 'npm', args: ['install', 'three', '@types/three'], cwd: p },
      timeoutMs: 60_000,
      dependsOn: ['step-2'],
    },
    {
      id: 'step-4',
      label: 'Write Vite config',
      toolId: 'nova.tool.filesystem',
      action: 'files.write',
      input: { path: `${p}/vite.config.ts`, content: VITE_CONFIG },
      timeoutMs: 5_000,
      dependsOn: ['step-1'],
    },
    {
      id: 'step-5',
      label: 'Write entry file',
      toolId: 'nova.tool.filesystem',
      action: 'files.write',
      input: { path: `${p}/src/main.ts`, content: MAIN_TS },
      timeoutMs: 5_000,
      dependsOn: ['step-1'],
    },
    {
      id: 'step-6',
      label: 'Write HTML entry',
      toolId: 'nova.tool.filesystem',
      action: 'files.write',
      input: { path: `${p}/index.html`, content: htmlTemplate(p) },
      timeoutMs: 5_000,
      dependsOn: ['step-1'],
    },
    {
      id: 'step-7',
      label: 'Verify build',
      toolId: 'nova.tool.terminal',
      action: 'terminal.run',
      input: { command: 'npm', args: ['run', 'build'], cwd: p },
      timeoutMs: 30_000,
      dependsOn: ['step-3', 'step-4', 'step-5', 'step-6'],
    },
  ];
}

const VITE_CONFIG = [
  'import { defineConfig } from "vite";',
  '',
  'export default defineConfig({',
  '  root: ".",',
  '  build: {',
  '    outDir: "dist",',
  '  },',
  '});',
  '',
].join('\n');

const MAIN_TS = [
  'import * as THREE from "three";',
  '',
  'const scene = new THREE.Scene();',
  'const camera = new THREE.PerspectiveCamera(',
  '  75,',
  '  window.innerWidth / window.innerHeight,',
  '  0.1,',
  '  1000',
  ');',
  '',
  'const renderer = new THREE.WebGLRenderer();',
  'renderer.setSize(window.innerWidth, window.innerHeight);',
  'document.body.appendChild(renderer.domElement);',
  '',
  'const geometry = new THREE.BoxGeometry();',
  'const material = new THREE.MeshBasicMaterial({',
  '  color: 0x00ff00,',
  '});',
  'const cube = new THREE.Mesh(geometry, material);',
  'scene.add(cube);',
  '',
  'camera.position.z = 5;',
  '',
  'function animate() {',
  '  requestAnimationFrame(animate);',
  '  cube.rotation.x += 0.01;',
  '  cube.rotation.y += 0.01;',
  '  renderer.render(scene, camera);',
  '}',
  '',
  'animate();',
  '',
].join('\n');

function htmlTemplate(projectName: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `  <title>${projectName}</title>`,
    '</head>',
    '<body>',
    '  <script type="module" src="/src/main.ts"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
