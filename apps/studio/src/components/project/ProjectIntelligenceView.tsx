import { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, BarChart3, Code2, FolderGit2, Layers, RefreshCw, Swords, Zap } from 'lucide-react';
import type { ProjectContext, DetectedTechnology, ArchitecturePattern } from '../../adapters/projectIntelligence/types';

interface ProjectIntelligenceViewProps {
  readonly context: ProjectContext | null;
  readonly loading: boolean;
  readonly onRefresh?: () => void;
}

const TECH_CATEGORY_COLORS: Record<string, string> = {
  language: '#5bd88a',
  framework: '#5b9fd8',
  engine: '#d4af37',
  tool: '#e8a23a',
  asset: '#b05bd8',
  runtime: '#5bd8c4',
};

const SEVERITY_COLORS: Record<string, string> = {
  error: '#ff5050',
  warning: '#e8a23a',
  info: '#5b9fd8',
};

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.8 ? '#5bd88a' : value >= 0.5 ? '#e8a23a' : '#ff5050';
  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
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

function TechSection({ technologies }: { technologies: readonly DetectedTechnology[] }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
        <Code2 className="size-4 text-[#d4af37]" />
        Technologies
      </h3>
      {technologies.length === 0 ? (
        <p className="text-sm text-[#5c5c5c]">No technologies detected.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {technologies.map((tech) => (
            <div key={tech.name} className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `${TECH_CATEGORY_COLORS[tech.category] ?? '#8a8a8a'}15`,
                  color: TECH_CATEGORY_COLORS[tech.category] ?? '#8a8a8a',
                }}
              >
                {tech.category}
              </span>
              <span className="min-w-0 flex-1 text-sm text-[#d0d0d0]">{tech.name}</span>
              <ConfidenceBar value={tech.confidence} />
              <span className="w-9 text-right text-[11px] text-[#8a8a8a]">{formatConfidence(tech.confidence)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArchitectureSection({ patterns }: { patterns: readonly ArchitecturePattern[] }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
        <Layers className="size-4 text-[#d4af37]" />
        Architecture
      </h3>
      {patterns.length === 0 ? (
        <p className="text-sm text-[#5c5c5c]">No architecture patterns detected.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {patterns.map((pattern) => (
            <div key={pattern.name} className="rounded-lg bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-sm font-medium text-[#d0d0d0]">{pattern.name}</span>
                <span className="rounded bg-[rgba(212,175,55,0.1)] px-1.5 py-0.5 text-[10px] text-[#d4af37]">{formatConfidence(pattern.confidence)}</span>
              </div>
              <p className="mb-1 text-xs text-[#8a8a8a]">{pattern.description}</p>
              {pattern.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pattern.evidence.slice(0, 3).map((e, i) => (
                    <span key={i} className="rounded bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 text-[10px] text-[#6a6a6a]">{e}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StructureSection({ structure }: { structure: readonly any[] }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
        <FolderGit2 className="size-4 text-[#d4af37]" />
        Project Structure
      </h3>
      {structure.length === 0 ? (
        <p className="text-sm text-[#5c5c5c]">No structure data available.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {structure.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.type === 'directory' ? (
          <>
            <FolderGit2 className="size-3.5 shrink-0 text-[#d4af37]" />
            <span className="text-xs font-medium text-[#d0d0d0]">{node.name}</span>
            {node.fileCount !== undefined && (
              <span className="text-[10px] text-[#5c5c5c]">({node.fileCount} files)</span>
            )}
          </>
        ) : (
          <>
            <Code2 className="size-3 shrink-0 text-[#6a6a6a]" />
            <span className="text-xs text-[#8a8a8a]">{node.name}</span>
          </>
        )}
        {hasChildren && (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="ml-auto text-[10px] text-[#5c5c5c]"
          >
            ▶
          </motion.span>
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child: any) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetSection({ assets }: { assets: ProjectContext['assets'] }) {
  const total = assets.models + assets.textures + assets.shaders + assets.animations + assets.audio + assets.other;

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
        <BarChart3 className="size-4 text-[#d4af37]" />
        Assets
      </h3>
      {total === 0 ? (
        <p className="text-sm text-[#5c5c5c]">No assets found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Models', count: assets.models, color: '#5b9fd8' },
            { label: 'Textures', count: assets.textures, color: '#5bd88a' },
            { label: 'Shaders', count: assets.shaders, color: '#e8a23a' },
            { label: 'Animations', count: assets.animations, color: '#b05bd8' },
            { label: 'Audio', count: assets.audio, color: '#5bd8c4' },
            { label: 'Other', count: assets.other, color: '#8a8a8a' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 rounded-lg bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
              <span
                className="flex size-8 items-center justify-center rounded-lg text-xs font-bold"
                style={{ backgroundColor: `${item.color}15`, color: item.color }}
              >
                {item.count}
              </span>
              <span className="text-xs text-[#b0b0b0]">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthSection({ health }: { health: ProjectContext['health'] }) {
  const scoreColor = health.score >= 80 ? '#5bd88a' : health.score >= 50 ? '#e8a23a' : '#ff5050';

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
        <Activity className="size-4 text-[#d4af37]" />
        Project Health
      </h3>

      <div className="mb-4 flex items-center gap-4">
        <div
          className="flex size-16 items-center justify-center rounded-full text-lg font-bold"
          style={{ backgroundColor: `${scoreColor}15`, color: scoreColor }}
        >
          {health.score}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[#8a8a8a]">
            {health.totalFiles} files in {health.totalDirs} directories
          </span>
          {health.oversizedFiles.length > 0 && (
            <span className="text-xs text-[#e8a23a]">
              {health.oversizedFiles.length} file(s) exceed 500 lines
            </span>
          )}
        </div>
      </div>

      {health.issues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">
            Issues ({health.issues.length})
          </span>
          {health.issues.map((issue, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-[rgba(255,255,255,0.02)] px-3 py-1.5"
            >
              <span style={{ color: SEVERITY_COLORS[issue.severity] }} className="mt-px shrink-0">
                <AlertTriangle className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-[#b0b0b0]">{issue.message}</span>
                {issue.suggestion && (
                  <p className="text-[10px] text-[#6a6a6a]">{issue.suggestion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {health.warnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">Warnings</span>
          {health.warnings.slice(0, 5).map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1">
              <span className="size-1.5 rounded-full bg-[#e8a23a]" />
              <span className="text-[11px] text-[#8a8a8a]">{w}</span>
            </div>
          ))}
        </div>
      )}

      {health.recommendations.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8a8a]">Recommendations</span>
          {health.recommendations.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1">
              <Zap className="size-3 text-[#d4af37]" />
              <span className="text-[11px] text-[#8a8a8a]">{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectIntelligenceView({ context, loading, onRefresh }: ProjectIntelligenceViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[rgba(212,175,55,0.1)]">
            <Swords className="size-4 text-[#d4af37]" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[#f5f5f5]">Project Intelligence</h2>
            {context && (
              <p className="text-[11px] text-[#5c5c5c]">
                Scanned {context.health.totalFiles} files · {new Date(context.scanTimestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        {onRefresh && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.06)] px-3 py-1.5 text-[11px] text-[#d4af37] transition-colors hover:bg-[rgba(212,175,55,0.12)] disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Scanning...' : 'Refresh'}
          </motion.button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="size-6 text-[#d4af37]" />
            </motion.div>
            <span className="text-sm text-[#8a8a8a]">Scanning workspace...</span>
          </div>
        </div>
      ) : !context ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2">
            <FolderGit2 className="size-8 text-[#5c5c5c]" />
            <span className="text-sm text-[#5c5c5c]">No project data loaded.</span>
            <span className="text-xs text-[#5c5c5c]">Click Refresh to scan the workspace.</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <TechSection technologies={context.technologies} />
          <ArchitectureSection patterns={context.architecture} />
          <AssetSection assets={context.assets} />
          <HealthSection health={context.health} />
          <div className="md:col-span-2">
            <StructureSection structure={context.projectStructure} />
          </div>
        </div>
      )}
    </div>
  );
}
