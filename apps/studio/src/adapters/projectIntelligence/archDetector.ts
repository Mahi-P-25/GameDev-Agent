import type { FileIndex, ArchitecturePattern } from './types';

interface ArchSignature {
  readonly name: string;
  readonly description: string;
  readonly detect: (files: FileIndex) => { detected: boolean; confidence: number; evidence: string[] };
}

const ARCH_SIGNATURES: ArchSignature[] = [
  {
    name: 'React Context',
    description: 'Uses React Context API for state management',
    detect: (files: FileIndex) => {
      const filesWithContext = Object.entries(files).filter(([, c]) =>
        /createContext\s*\(/.test(c)
      );
      const filesWithProvider = Object.entries(files).filter(([, c]) =>
        /\w+\.Provider/.test(c)
      );
      return {
        detected: filesWithContext.length > 0,
        confidence: filesWithContext.length > 0 ? 0.85 : 0,
        evidence: [
          ...filesWithContext.slice(0, 3).map(([f]) => `createContext in ${f.split('/').pop()}`),
          ...filesWithProvider.slice(0, 2).map(([f]) => `Provider in ${f.split('/').pop()}`),
        ],
      };
    },
  },
  {
    name: 'Component-Based Architecture',
    description: 'Organized as reusable UI components',
    detect: (files: FileIndex) => {
      const componentFiles = Object.keys(files).filter((f) =>
        (f.endsWith('.tsx') || f.endsWith('.jsx')) &&
        (f.includes('/components/') || f.includes('/ui/'))
      );
      return {
        detected: componentFiles.length > 0,
        confidence: componentFiles.length > 3 ? 0.9 : componentFiles.length > 0 ? 0.7 : 0,
        evidence: [`${componentFiles.length} component files found`],
      };
    },
  },
  {
    name: 'Provider Pattern',
    description: 'Uses provider components for dependency injection',
    detect: (files: FileIndex) => {
      const providerFiles = Object.entries(files).filter(([, c]) =>
        /Provider/.test(c) && /\w+\.Provider/.test(c)
      );
      return {
        detected: providerFiles.length > 0,
        confidence: providerFiles.length > 0 ? 0.75 : 0,
        evidence: providerFiles.slice(0, 3).map(([f]) => `Provider in ${f.split('/').pop()}`),
      };
    },
  },
  {
    name: 'Adapter Pattern',
    description: 'Uses adapter interfaces to abstract external dependencies',
    detect: (files: FileIndex) => {
      const adapterFiles = Object.keys(files).filter((f) =>
        f.includes('/adapters/') || f.endsWith('Adapter.ts') || f.endsWith('Adapter.tsx')
      );
      const hasAdapterInterfaces = Object.values(files).some((c) =>
        /\binterface\s+\w+Adapter\b/.test(c)
      );
      return {
        detected: adapterFiles.length > 0 || hasAdapterInterfaces,
        confidence: adapterFiles.length > 2 ? 0.9 : adapterFiles.length > 0 ? 0.7 : hasAdapterInterfaces ? 0.6 : 0,
        evidence: [
          ...adapterFiles.slice(0, 3).map((f) => `${f.split('/').pop()} adapter file`),
          ...(hasAdapterInterfaces ? ['Adapter interface found'] : []),
        ],
      };
    },
  },
  {
    name: 'Page-Based Routing',
    description: 'Organized as pages with a router',
    detect: (files: FileIndex) => {
      const pageFiles = Object.keys(files).filter((f) => f.includes('/pages/') && (f.endsWith('Page.tsx') || f.endsWith('Page.ts')));
      const hasRouter = Object.values(files).some((c) => /from\s+['"]react-router-dom['"]/.test(c));
      return {
        detected: pageFiles.length > 0 && hasRouter,
        confidence: pageFiles.length > 1 && hasRouter ? 0.95 : pageFiles.length > 0 ? 0.7 : 0,
        evidence: [
          `${pageFiles.length} page components found`,
          ...(hasRouter ? ['react-router-dom detected'] : []),
        ],
      };
    },
  },
  {
    name: 'Service Layer',
    description: 'Abstracts backend communication through service interfaces',
    detect: (files: FileIndex) => {
      const serviceFiles = Object.keys(files).filter((f) =>
        f.includes('/services/') && (f.endsWith('.ts') || f.endsWith('.tsx'))
      );
      const hasServiceInterface = Object.values(files).some((c) =>
        /\binterface\s+\w+Service\b/.test(c) || /\binterface\s+\w+ApiClient\b/.test(c)
      );
      return {
        detected: serviceFiles.length > 0 || hasServiceInterface,
        confidence: serviceFiles.length > 1 && hasServiceInterface ? 0.9 : serviceFiles.length > 0 ? 0.7 : hasServiceInterface ? 0.6 : 0,
        evidence: [
          ...serviceFiles.slice(0, 3).map((f) => `${f.split('/').pop()} service`),
          ...(hasServiceInterface ? ['Service interface found'] : []),
        ],
      };
    },
  },
];

export function detectArchitecture(files: FileIndex): ArchitecturePattern[] {
  const result: ArchitecturePattern[] = [];
  for (const sig of ARCH_SIGNATURES) {
    const { detected, confidence, evidence } = sig.detect(files);
    if (detected) {
      result.push({ name: sig.name, description: sig.description, confidence, evidence });
    }
  }
  return result.sort((a, b) => b.confidence - a.confidence);
}
