import { describe, it, expect } from 'vitest';
import { detectTechnologies } from '../techDetector';
import type { FileIndex } from '../types';

const MOCK_FILES: FileIndex = {
  '/src/App.tsx': "import { createContext } from 'react';",
  '/src/main.tsx': "import React from 'react'; import ReactDOM from 'react-dom';",
  '/src/components/Button.tsx': "import { motion } from 'motion/react';",
  '/src/styles/tailwind.css': '@tailwind base; @apply text-center;',
  '/src/shaders/vertex.glsl': '#version 300 es\nuniform mat4 modelViewMatrix;',
  '/src/shaders/fragment.frag': '#version 300 es\nprecision highp float;',
  '/package.json': JSON.stringify({
    dependencies: { react: '^18.0.0', three: '^0.160.0' },
    devDependencies: { vite: '^5.0.0', tailwindcss: '^4.0.0' },
  }),
  '/tsconfig.json': '{}',
  '/vite.config.ts': 'export default {}',
};

describe('Technology Detector', () => {
  it('detects TypeScript from .ts files', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const ts = techs.find((t) => t.name === 'TypeScript');
    expect(ts).toBeDefined();
    expect(ts!.confidence).toBeGreaterThan(0);
  });

  it('detects React from package.json dependency', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const react = techs.find((t) => t.name === 'React');
    expect(react).toBeDefined();
    expect(react!.confidence).toBeGreaterThan(0.9);
    expect(react!.evidence.some((e) => e.includes('package.json'))).toBe(true);
  });

  it('detects Three.js from package.json', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const three = techs.find((t) => t.name === 'Three.js');
    expect(three).toBeDefined();
    expect(three!.confidence).toBeGreaterThan(0.9);
  });

  it('detects Vite from config file', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const vite = techs.find((t) => t.name === 'Vite');
    expect(vite).toBeDefined();
    expect(vite!.confidence).toBe(1);
  });

  it('detects Tailwind CSS from directives', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const tw = techs.find((t) => t.name === 'Tailwind CSS');
    expect(tw).toBeDefined();
    expect(tw!.confidence).toBeGreaterThan(0.8);
  });

  it('detects GLSL from shader files', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const glsl = techs.find((t) => t.name === 'GLSL');
    expect(glsl).toBeDefined();
    expect(glsl!.confidence).toBe(1);
  });

  it('detects Motion from imports', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const motion = techs.find((t) => t.name === 'Motion (Framer Motion)');
    expect(motion).toBeDefined();
    expect(motion!.confidence).toBeGreaterThan(0.8);
  });

  it('sorts results by confidence descending', () => {
    const techs = detectTechnologies(MOCK_FILES);
    for (let i = 1; i < techs.length; i++) {
      expect(techs[i - 1]!.confidence).toBeGreaterThanOrEqual(techs[i]!.confidence);
    }
  });

  it('returns empty array for empty file index', () => {
    const techs = detectTechnologies({});
    expect(techs.length).toBe(0);
  });

  it('detects Node.js from package.json', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const node = techs.find((t) => t.name === 'Node.js');
    expect(node).toBeDefined();
    expect(node!.confidence).toBeGreaterThan(0.8);
  });

  it('assigns correct categories', () => {
    const techs = detectTechnologies(MOCK_FILES);
    const react = techs.find((t) => t.name === 'React');
    expect(react?.category).toBe('framework');
    const vite = techs.find((t) => t.name === 'Vite');
    expect(vite?.category).toBe('tool');
    const ts = techs.find((t) => t.name === 'TypeScript');
    expect(ts?.category).toBe('language');
  });
});
