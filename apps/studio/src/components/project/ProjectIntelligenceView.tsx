import {
  Activity,
  AlertTriangle,
  BarChart3,
  Code2,
  FileCog,
  FolderGit2,
  Layers,
  Package,
  RefreshCw,
  Share2,
  Swords,
  Workflow,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type {
  ArchitecturePattern,
  DependencyGraph,
  DetectedTechnology,
  DirectoryNode,
  ProjectContext,
} from '../../adapters/projectIntelligence/types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ProjectIntelligenceViewProps {
  readonly context: ProjectContext | null;
  readonly loading: boolean;
  readonly onRefresh?: () => void;
}

const TECH_CATEGORY_COLORS: Record<string, string> = {
  language: '#7C9AA6',
  framework: '#7EA688',
  engine: '#D6B358',
  tool: '#BF9B55',
  asset: '#BE6A63',
  runtime: '#7C9AA6',
};

const SEVERITY_COLORS: Record<string, string> = {
  error: '#BE6A63',
  warning: '#BF9B55',
  info: '#7C9AA6',
};

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.8 ? '#7EA688' : value >= 0.5 ? '#BF9B55' : '#BE6A63';
  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-bg-inset">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function sectionTitle(icon: React.ReactNode, label: string): React.ReactNode {
  return (
    <span className="flex items-center gap-2">
      {icon}
      {label}
    </span>
  );
}

function SummarySection({ context }: { context: ProjectContext }) {
  const { summary } = context;
  const items: ReadonlyArray<{ readonly icon: React.ReactNode; readonly label: string; readonly value: string }> = [
    {
      icon: <FolderGit2 className="size-3.5" />,
      label: 'Workspace',
      value: context.workspacePath,
    },
    {
      icon: <Workflow className="size-3.5" />,
      label: 'Build Systems',
      value: summary.buildSystems.join(', ') || '—',
    },
    {
      icon: <Package className="size-3.5" />,
      label: 'Package Managers',
      value: summary.packageManagers.join(', ') || '—',
    },
    {
      icon: <FileCog className="size-3.5" />,
      label: 'Config Files',
      value: `${summary.configFiles.length}`,
    },
  ];
  return (
    <Card
      title={sectionTitle(<BarChart3 className="size-4 text-accent" />, 'Workspace Summary')}
      size="sm"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2 rounded-lg bg-bg-inset px-3 py-2.5">
            <span className="mt-0.5 shrink-0 text-accent">{item.icon}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                {item.label}
              </div>
              <div className="truncate text-xs text-fg">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DependencySection({ graph }: { graph: DependencyGraph }) {
  const { nodes, edges, circularDependencies, isolatedModules } = graph;

  const connectivity = useMemo(() => {
    const degree = new Map<string, number>();
    for (const edge of edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    return [...degree.entries()]
      .map(([id, count]) => ({ id, count, path: byId.get(id)?.path ?? id }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [nodes, edges]);

  const maxDegree = connectivity[0]?.count ?? 1;

  return (
    <Card
      title={sectionTitle(<Share2 className="size-4 text-accent" />, 'Dependency Graph')}
      size="md"
      subtitle={`${nodes.length} modules · ${edges.length} imports · ${circularDependencies.length} circular chain${circularDependencies.length === 1 ? '' : 's'} · ${isolatedModules.length} isolated`}
    >
      <div className="flex flex-col gap-4">
        {/* Connectivity leaders */}
        {connectivity.length > 0 && (
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
              Most connected modules
            </span>
            <div className="mt-2 flex flex-col gap-1.5">
              {connectivity.map((mod) => (
                <div key={mod.id} className="flex items-center gap-3">
                  <span className="w-40 truncate text-xs text-fg-muted" title={mod.path}>
                    {mod.path}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-inset">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(mod.count / maxDegree) * 100}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-[11px] text-fg-subtle">
                    {mod.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Circular dependencies */}
        {circularDependencies.length > 0 && (
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-warning">
              Circular dependencies
            </span>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {circularDependencies.map((chain, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-1 rounded-lg bg-bg-inset px-3 py-1.5 font-mono text-[11px] text-warning"
                >
                  {chain.map((part, partIdx) => (
                    <span key={part} className="flex items-center gap-1">
                      {partIdx > 0 && <span>→</span>}
                      <span className="max-w-[180px] truncate" title={part}>
                        {part}
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Isolated modules */}
        {isolatedModules.length > 0 && (
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
              Isolated modules ({isolatedModules.length})
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {isolatedModules.slice(0, 12).map((path) => (
                <span
                  key={path}
                  className="rounded bg-bg-hover px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle"
                  title={path}
                >
                  {path}
                </span>
              ))}
              {isolatedModules.length > 12 && (
                <span className="px-1 text-[10px] text-fg-subtle">
                  +{isolatedModules.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {connectivity.length === 0 && circularDependencies.length === 0 && isolatedModules.length === 0 && (
          <p className="text-sm text-fg-muted">No module relationships detected.</p>
        )}
      </div>
    </Card>
  );
}

function TechSection({ technologies }: { technologies: readonly DetectedTechnology[] }) {
  return (
    <Card title={sectionTitle(<Code2 className="size-4 text-accent" />, 'Technologies')} size="md">
      {technologies.length === 0 ? (
        <p className="text-sm text-fg-muted">No technologies detected.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {technologies.map((tech) => (
            <div key={tech.name} className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `${TECH_CATEGORY_COLORS[tech.category] ?? '#8a8a8a'}1a`,
                  color: TECH_CATEGORY_COLORS[tech.category] ?? '#8a8a8a',
                }}
              >
                {tech.category}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{tech.name}</span>
              <ConfidenceBar value={tech.confidence} />
              <span className="w-9 shrink-0 text-right text-[11px] text-fg-subtle">
                {formatConfidence(tech.confidence)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ArchitectureSection({ patterns }: { patterns: readonly ArchitecturePattern[] }) {
  return (
    <Card title={sectionTitle(<Layers className="size-4 text-accent" />, 'Architecture')} size="md">
      {patterns.length === 0 ? (
        <p className="text-sm text-fg-muted">No architecture patterns detected.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {patterns.map((pattern) => (
            <div key={pattern.name} className="rounded-lg bg-bg-inset px-3.5 py-2.5">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-sm font-medium text-fg">{pattern.name}</span>
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">
                  {formatConfidence(pattern.confidence)}
                </span>
              </div>
              <p className="mb-1 text-xs text-fg-muted">{pattern.description}</p>
              {pattern.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pattern.evidence.slice(0, 3).map((e) => (
                    <span
                      key={e}
                      className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-fg-subtle"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StructureSection({ structure }: { structure: readonly DirectoryNode[] }) {
  return (
    <Card
      title={sectionTitle(<FolderGit2 className="size-4 text-accent" />, 'Project Structure')}
      size="md"
    >
      {structure.length === 0 ? (
        <p className="text-sm text-fg-muted">No structure data available.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {structure.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TreeNode({ node, depth }: { node: DirectoryNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-bg-hover"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.type === 'directory' ? (
          <>
            <FolderGit2 className="size-3.5 shrink-0 text-accent" />
            <span className="text-xs font-medium text-fg">{node.name}</span>
            {node.fileCount !== undefined && (
              <span className="text-[10px] text-fg-subtle">({node.fileCount} files)</span>
            )}
          </>
        ) : (
          <>
            <Code2 className="size-3 shrink-0 text-fg-subtle" />
            <span className="text-xs text-fg-muted">{node.name}</span>
          </>
        )}
        {hasChildren && (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="ml-auto text-[10px] text-fg-subtle"
          >
            ▶
          </motion.span>
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetSection({ assets }: { assets: ProjectContext['assets'] }) {
  const total =
    assets.models +
    assets.textures +
    assets.shaders +
    assets.animations +
    assets.audio +
    assets.other;

  return (
    <Card title={sectionTitle(<BarChart3 className="size-4 text-accent" />, 'Assets')} size="md">
      {total === 0 ? (
        <p className="text-sm text-fg-muted">No assets found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Models', count: assets.models, color: '#7C9AA6' },
            { label: 'Textures', count: assets.textures, color: '#7EA688' },
            { label: 'Shaders', count: assets.shaders, color: '#BF9B55' },
            { label: 'Animations', count: assets.animations, color: '#BE6A63' },
            { label: 'Audio', count: assets.audio, color: '#7C9AA6' },
            { label: 'Other', count: assets.other, color: '#8a8a8a' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2.5 rounded-lg bg-bg-inset px-3 py-2.5"
            >
              <span
                className="flex size-8 items-center justify-center rounded-md text-xs font-bold"
                style={{ backgroundColor: `${item.color}1a`, color: item.color }}
              >
                {item.count}
              </span>
              <span className="text-xs text-fg-muted">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function HealthSection({ health }: { health: ProjectContext['health'] }) {
  const scoreColor = health.score >= 80 ? '#7EA688' : health.score >= 50 ? '#BF9B55' : '#BE6A63';

  return (
    <Card
      title={sectionTitle(<Activity className="size-4 text-accent" />, 'Project Health')}
      size="md"
    >
      <div className="mb-4 flex items-center gap-4">
        <div
          className="flex size-16 items-center justify-center rounded-full text-lg font-bold"
          style={{ backgroundColor: `${scoreColor}1a`, color: scoreColor }}
        >
          {health.score}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-fg-muted">
            {health.totalFiles} files in {health.totalDirs} directories
          </span>
          {health.oversizedFiles.length > 0 && (
            <span className="text-xs text-warning">
              {health.oversizedFiles.length} file(s) exceed 500 lines
            </span>
          )}
        </div>
      </div>

      {health.issues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
            Issues ({health.issues.length})
          </span>
          {health.issues.map((issue) => (
            <div
              key={`${issue.severity}-${issue.message}`}
              className="flex items-start gap-2 rounded-lg bg-bg-inset px-3 py-1.5"
            >
              <span style={{ color: SEVERITY_COLORS[issue.severity] }} className="mt-px shrink-0">
                <AlertTriangle className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-fg-muted">{issue.message}</span>
                {issue.suggestion && (
                  <p className="text-[10px] text-fg-subtle">{issue.suggestion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {health.warnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
            Warnings
          </span>
          {health.warnings.slice(0, 5).map((w) => (
            <div key={w} className="flex items-center gap-2 px-3 py-1">
              <span className="size-1.5 rounded-full bg-warning" />
              <span className="text-[11px] text-fg-muted">{w}</span>
            </div>
          ))}
        </div>
      )}

      {health.recommendations.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
            Recommendations
          </span>
          {health.recommendations.map((r) => (
            <div key={r} className="flex items-center gap-2 px-3 py-1">
              <Zap className="size-3 text-accent" />
              <span className="text-[11px] text-fg-muted">{r}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function ProjectIntelligenceView({
  context,
  loading,
  onRefresh,
}: ProjectIntelligenceViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft">
            <Swords className="size-4 text-accent" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-fg">Project Intelligence</h2>
            {context && (
              <p className="text-[11px] text-fg-subtle">
                Scanned {context.health.totalFiles} files ·{' '}
                {new Date(context.scanTimestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            leftIcon={<RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />}
          >
            {loading ? 'Scanning...' : 'Refresh'}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
            >
              <RefreshCw className="size-6 text-accent" />
            </motion.div>
            <span className="text-sm text-fg-muted">Scanning workspace...</span>
          </div>
        </div>
      ) : !context ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2">
            <FolderGit2 className="size-8 text-fg-subtle" />
            <span className="text-sm text-fg-muted">No project data loaded.</span>
            <span className="text-xs text-fg-subtle">Click Refresh to scan the workspace.</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <SummarySection context={context} />
          <div className="grid gap-5 md:grid-cols-2">
            <TechSection technologies={context.technologies} />
            <ArchitectureSection patterns={context.architecture} />
            <AssetSection assets={context.assets} />
            <HealthSection health={context.health} />
            <div className="md:col-span-2">
              <DependencySection graph={context.dependencyGraph} />
            </div>
            <div className="md:col-span-2">
              <StructureSection structure={context.projectStructure} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
