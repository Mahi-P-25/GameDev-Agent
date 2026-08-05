import { useState } from 'react';
import { ProjectHeader } from './ProjectHeader';
import { ExplorerTree } from './ExplorerTree';
import { EditorTabs } from './EditorTabs';
import { MonacoEditorPanel } from './MonacoEditorPanel';
import { InspectorPanel } from './InspectorPanel';
import { TerminalPanel } from './TerminalPanel';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';
import type { FileItem } from './ExplorerNode';

const MOCK_FILE_TREE: ReadonlyArray<FileItem> = [
  {
    id: 'dir-src',
    name: 'src',
    path: '/src',
    isDirectory: true,
    children: [
      {
        id: 'file-app-tsx',
        name: 'App.tsx',
        path: '/src/App.tsx',
        isDirectory: false,
        extension: 'tsx',
        size: '1.8 KB',
        content: `import React, { useState } from 'react';\nimport { Canvas } from '@react-three/fiber';\nimport { OrbitControls } from '@react-three/drei';\n\nexport default function App() {\n  const [score, setScore] = useState(0);\n\n  return (\n    <div className="flex h-screen w-screen flex-col bg-slate-950 text-white font-sans">\n      <header className="flex h-14 items-center justify-between border-b border-slate-800 px-6">\n        <h1 className="text-lg font-bold text-amber-400">Nova Game Engine</h1>\n        <div className="font-mono text-sm">Score: {score}</div>\n      </header>\n      <main className="flex-1 relative">\n        <Canvas camera={{ position: [0, 2, 5] }}>\n          <ambientLight intensity={0.5} />\n          <directionalLight position={[10, 10, 5]} />\n          <mesh onClick={() => setScore((s) => s + 10)} position={[0, 0, 0]}>\n            <boxGeometry args={[1.5, 1.5, 1.5]} />\n            <meshStandardMaterial color="#D6B358" roughness={0.3} metalness={0.8} />\n          </mesh>\n          <OrbitControls />\n        </Canvas>\n      </main>\n    </div>\n  );\n}`,
      },
      {
        id: 'file-main-ts',
        name: 'main.ts',
        path: '/src/main.ts',
        isDirectory: false,
        extension: 'ts',
        size: '420 B',
        content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './styles.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);`,
      },
      {
        id: 'dir-components',
        name: 'components',
        path: '/src/components',
        isDirectory: true,
        children: [
          {
            id: 'file-game-canvas-tsx',
            name: 'GameCanvas.tsx',
            path: '/src/components/GameCanvas.tsx',
            isDirectory: false,
            extension: 'tsx',
            size: '2.1 KB',
            content: `import React from 'react';\n\nexport function GameCanvas() {\n  return (\n    <div className="relative size-full bg-black">\n      <canvas id="render-target" className="size-full" />\n    </div>\n  );\n}`,
          },
        ],
      },
    ],
  },
  {
    id: 'file-package-json',
    name: 'package.json',
    path: '/package.json',
    isDirectory: false,
    extension: 'json',
    size: '1.2 KB',
    content: `{\n  "name": "@nova/game-project",\n  "version": "1.0.0",\n  "type": "module",\n  "dependencies": {\n    "react": "^18.3.1",\n    "three": "^0.168.0",\n    "@react-three/fiber": "^8.17.5"\n  }\n}`,
  },
  {
    id: 'file-readme-md',
    name: 'README.md',
    path: '/README.md',
    isDirectory: false,
    extension: 'md',
    size: '640 B',
    content: `# Nova AI-Native Game Project\n\nAutonomous game scaffold created with Nova AI Engine.\n\n## Quickstart\n\`\`\`bash\npnpm install\npnpm dev\n\`\`\``,
  },
];

const DEFAULT_INITIAL_FILE: FileItem = MOCK_FILE_TREE[0]?.children?.[0] || {
  id: 'file-app-tsx',
  name: 'App.tsx',
  path: '/src/App.tsx',
  isDirectory: false,
  extension: 'tsx',
  size: '1.8 KB',
  content: `// Default Nova App`,
};

interface WorkspaceLayoutProps {
  readonly projectName?: string;
  readonly rootPath?: string;
}

export function WorkspaceLayout({
  projectName = 'Nova Game Workspace',
  rootPath = '~/Documents/GameDev-Agent',
}: WorkspaceLayoutProps): React.ReactNode {
  const [fileTree] = useState<ReadonlyArray<FileItem>>(MOCK_FILE_TREE);
  const [openFiles, setOpenFiles] = useState<FileItem[]>([DEFAULT_INITIAL_FILE]);
  const [activeFileId, setActiveFileId] = useState<string | null>('file-app-tsx');
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(new Set());

  // Handle selecting a file from the explorer
  const handleSelectFile = (file: FileItem) => {
    if (file.isDirectory) return;
    if (!openFiles.some((f) => f.id === file.id)) {
      setOpenFiles((prev) => [...prev, file]);
    }
    setActiveFileId(file.id);
  };

  // Handle selecting a tab
  const handleSelectTab = (fileId: string) => {
    setActiveFileId(fileId);
  };

  // Handle closing a tab
  const handleCloseTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(filtered);
    if (activeFileId === fileId) {
      const lastFile = filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
      setActiveFileId(lastFile ? lastFile.id : null);
    }
  };

  // Handle editing content in Monaco Editor
  const handleContentChange = (fileId: string, newContent: string) => {
    setDirtyFileIds((prev) => new Set(prev).add(fileId));
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content: newContent } : f)),
    );
  };

  const activeFile = openFiles.find((f) => f.id === activeFileId) || null;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg-base text-fg">
      {/* Top Project Header */}
      <ProjectHeader
        projectName={projectName}
        rootPath={rootPath}
        language="TypeScript"
        engine="Three.js / React"
        gitBranch="main"
        buildStatus="passing"
        intelligenceScore={96}
      />

      {/* Main Workspace IDE Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* 1. Left VS Code Style Explorer */}
        <ExplorerTree
          items={fileTree}
          selectedId={activeFileId}
          onSelectFile={handleSelectFile}
        />

        {/* 2. Middle Editor Canvas + Bottom Terminal Panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {openFiles.length > 0 ? (
            <>
              <EditorTabs
                openFiles={openFiles}
                activeFileId={activeFileId}
                dirtyFileIds={dirtyFileIds}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
              />
              <MonacoEditorPanel file={activeFile} onContentChange={handleContentChange} />
              <TerminalPanel />
            </>
          ) : (
            <WorkspaceEmptyState
              onOpenFolder={() => handleSelectFile(DEFAULT_INITIAL_FILE)}
              onImportProject={() => handleSelectFile(DEFAULT_INITIAL_FILE)}
              onCreateProject={() => handleSelectFile(DEFAULT_INITIAL_FILE)}
            />
          )}
        </div>

        {/* 3. Right Inspector Panel */}
        <InspectorPanel activeFile={activeFile} />
      </div>
    </div>
  );
}
