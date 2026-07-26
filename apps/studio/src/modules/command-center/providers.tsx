import {
  BookOpen,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  Hammer,
  Home,
  Inbox,
  LayoutDashboard,
  PlayCircle,
  Plus,
  Rocket,
  Settings,
  Target,
  Terminal,
  Users,
  Workflow,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Command, CommandProvider } from './types';

/**
 * Built-in Command Providers for the Nova Command Center.
 *
 * Each provider is a self-contained source of commands. They are the reference
 * implementation for how a future feature (AI, Git, Extensions…) contributes
 * commands: export a `CommandProvider` and register it on the
 * `CommandCenterModule` — no edits to the palette core required.
 */

const icon = (node: ReactNode): ReactNode => node;

function navigationProvider(): CommandProvider {
  const entries: ReadonlyArray<{ id: string; to: string; label: string; icon: ReactNode }> = [
    { id: 'home', to: '/', label: 'Home', icon: icon(<Home className="size-4" />) },
    {
      id: 'workspace',
      to: '/workspace',
      label: 'Workspace',
      icon: icon(<LayoutDashboard className="size-4" />),
    },
    {
      id: 'projects',
      to: '/projects',
      label: 'Projects',
      icon: icon(<FolderKanban className="size-4" />),
    },
    { id: 'goals', to: '/goals', label: 'Goals', icon: icon(<Target className="size-4" />) },
    {
      id: 'missions',
      to: '/missions',
      label: 'Missions',
      icon: icon(<Rocket className="size-4" />),
    },
    {
      id: 'workflows',
      to: '/workflows',
      label: 'Workflows',
      icon: icon(<Workflow className="size-4" />),
    },
    { id: 'team', to: '/studio', label: 'Studio Team', icon: icon(<Users className="size-4" />) },
    { id: 'inbox', to: '/inbox', label: 'Inbox', icon: icon(<Inbox className="size-4" />) },
    {
      id: 'settings',
      to: '/settings',
      label: 'Settings',
      icon: icon(<Settings className="size-4" />),
    },
  ];
  return {
    id: 'navigation',
    label: 'Navigation',
    commands: ({ navigate }) =>
      entries.map((entry) => ({
        id: `nav-${entry.id}`,
        title: `Go to ${entry.label}`,
        group: 'Navigation',
        icon: entry.icon,
        keywords: [entry.label, 'open', 'navigate', 'go'],
        run: () => navigate(entry.to),
      })),
  };
}

function projectsProvider(): CommandProvider {
  return {
    id: 'projects',
    label: 'Projects',
    commands: ({ api, navigate }) => {
      const projects = api.listProjects();
      return [
        {
          id: 'projects-open',
          title: 'Open Projects',
          group: 'Projects',
          icon: icon(<FolderOpen className="size-4" />),
          keywords: ['projects', 'list'],
          run: () => navigate('/projects'),
        },
        {
          id: 'projects-new',
          title: 'Create New Project',
          group: 'Projects',
          icon: icon(<Plus className="size-4" />),
          keywords: ['new', 'create', 'project'],
          run: () => navigate('/projects'),
        },
        ...projects.map((project) => ({
          id: `project-${project.id}`,
          title: project.name,
          subtitle: project.description,
          group: 'Projects',
          icon: icon(<FolderKanban className="size-4" />),
          keywords: [project.name, 'open', 'switch'],
          badge: project.status,
          run: () => {
            void api.setActiveProject(project.id);
            navigate('/projects');
          },
        })),
      ];
    },
  };
}

/** Recent projects are derived from the active context's last project switch. */
function recentProjectsProvider(): CommandProvider {
  return {
    id: 'recent-projects',
    label: 'Recent Projects',
    commands: ({ api }) => {
      const ctx = api.getContext();
      if (ctx.projectId === null) {
        return [];
      }
      const project = safeFindProject(api, ctx.projectId);
      if (project === undefined) {
        return [];
      }
      return [
        {
          id: `recent-project-${project.id}`,
          title: `Recent: ${project.name}`,
          subtitle: 'Last active project',
          group: 'Recent Projects',
          icon: icon(<FolderKanban className="size-4" />),
          keywords: [project.name, 'recent', 'switch'],
          run: () => {
            void api.setActiveProject(project.id);
          },
        },
      ];
    },
  };
}

function workflowsProvider(): CommandProvider {
  return {
    id: 'workflows',
    label: 'Workflows',
    commands: ({ api, navigate }) => {
      const templates = api.listWorkflowTemplates();
      const projects = api.listProjects();
      const target = projects[0];
      return [
        {
          id: 'workflows-open',
          title: 'Open Workflows',
          group: 'Workflows',
          icon: icon(<Workflow className="size-4" />),
          keywords: ['workflows', 'list', 'runs'],
          run: () => navigate('/workflows'),
        },
        ...templates.map((template) => ({
          id: `workflow-${template.id}`,
          title: `Run ${template.name}`,
          subtitle: template.description,
          group: 'Workflows',
          icon: icon(<Hammer className="size-4" />),
          keywords: [template.name, 'run', 'execute', 'workflow', template.kind],
          shortcut: ['⌘', 'K'],
          disabled: target === undefined,
          run: () => {
            if (target !== undefined) {
              void api.startWorkflow({ kind: template.kind, projectId: target.id });
            }
            navigate('/workflows');
          },
        })),
      ];
    },
  };
}

function missionsProvider(): CommandProvider {
  return {
    id: 'missions',
    label: 'Missions',
    commands: ({ api, navigate }) => {
      const missions = api.listMissions();
      return [
        {
          id: 'missions-open',
          title: 'Open Missions',
          group: 'Missions',
          icon: icon(<Rocket className="size-4" />),
          keywords: ['missions', 'list'],
          run: () => navigate('/missions'),
        },
        ...missions.map((mission) => ({
          id: `mission-${mission.id}`,
          title: mission.title,
          subtitle: mission.brief,
          group: 'Missions',
          icon: icon(<Rocket className="size-4" />),
          keywords: [mission.title, 'mission', 'open'],
          badge: mission.status,
          run: () => navigate('/missions'),
        })),
      ];
    },
  };
}

function recentFilesProvider(): CommandProvider {
  return {
    id: 'recent-files',
    label: 'Recent Files',
    commands: ({ api, notify }) => {
      const files = api.getContext().recentFiles;
      return files.map((file, index) => ({
        id: `recent-file-${index}-${file}`,
        title: basename(file),
        subtitle: file,
        group: 'Recent Files',
        icon: icon(<FileText className="size-4" />),
        keywords: [file, 'file', 'recent', 'open'],
        run: () => {
          void api.setActiveFile(file);
          notify({ title: 'File focused', description: file, intent: 'info' });
        },
      }));
    },
  };
}

function settingsProvider(): CommandProvider {
  return {
    id: 'settings',
    label: 'Settings',
    commands: ({ navigate }) => [
      {
        id: 'settings-open',
        title: 'Open Settings',
        group: 'Settings',
        icon: icon(<Settings className="size-4" />),
        keywords: ['settings', 'preferences', 'config'],
        run: () => navigate('/settings'),
      },
      {
        id: 'settings-appearance',
        title: 'Settings: Appearance',
        group: 'Settings',
        icon: icon(<Settings className="size-4" />),
        keywords: ['theme', 'dark', 'appearance', 'settings'],
        run: () => navigate('/settings'),
      },
    ],
  };
}

function documentationProvider(): CommandProvider {
  const links: ReadonlyArray<{ id: string; title: string; url: string; keywords: string }> = [
    {
      id: 'docs-command-center',
      title: 'Docs: Command Center',
      url: '#/docs/command-center',
      keywords: 'palette shortcuts ctrl k',
    },
    {
      id: 'docs-home',
      title: 'Docs: Getting Started',
      url: '#/docs',
      keywords: 'help guide start',
    },
  ];
  return {
    id: 'documentation',
    label: 'Documentation',
    commands: () => [
      ...links.map((link) => ({
        id: link.id,
        title: link.title,
        group: 'Documentation',
        icon: <BookOpen className="size-4" />,
        keywords: ['docs', 'documentation', 'help', link.keywords],
        run: () => {
          if (typeof window !== 'undefined') {
            window.open(link.url, '_blank', 'noopener,noreferrer');
          }
        },
      })),
    ],
  };
}

function safeFindProject(
  api: import('../../services/StudioApiClient').StudioApiClient,
  id: string,
) {
  try {
    return api.getProject(id);
  } catch {
    return undefined;
  }
}

function basename(path: string): string {
  const cleaned = path.replace(/[/\\]+$/, '');
  const parts = cleaned.split(/[/\\]/);
  return parts[parts.length - 1] ?? cleaned;
}

/**
 * Runtime commands — driven entirely by the Nova Runtime. Every action executes
 * *through* the Runtime providers, so it becomes a real Studio Event (e.g.
 * "Run Tests" truly runs the test command and publishes `test.started`/
 * `test.passed`). Nothing is faked; when the browser Runtime is active these
 * delegate to the backend rather than inventing output.
 */
function runtimeProvider(): CommandProvider {
  return {
    id: 'runtime',
    label: 'Runtime',
    commands: ({ api, notify }) => {
      const runtime = api.runtime;
      const commands: Command[] = [
        {
          id: 'runtime-show-branch',
          title: 'Show Current Branch',
          subtitle: 'Reveal the real git branch the Runtime observed',
          group: 'Runtime',
          icon: icon(<GitBranch className="size-4" />),
          keywords: ['git', 'branch', 'runtime', 'vcs'],
          run: () => {
            void runtime.getAwareness().then((a) => {
              notify({
                title: a.branch === null ? 'No git branch' : `On branch ${a.branch}`,
                description: a.dirty ? 'Working tree has modifications' : 'Working tree clean',
                intent: a.dirty ? 'warning' : 'success',
              });
            });
          },
        },
        {
          id: 'runtime-run-tests',
          title: 'Run Tests',
          subtitle: 'Execute the project test command via the Runtime',
          group: 'Runtime',
          icon: icon(<PlayCircle className="size-4" />),
          keywords: ['test', 'runtime', 'verify', 'ci'],
          run: () => {
            void runtime.runTests();
          },
        },
        {
          id: 'runtime-restart-build',
          title: 'Restart Build',
          subtitle: 'Re-run the project build via the Runtime',
          group: 'Runtime',
          icon: icon(<Hammer className="size-4" />),
          keywords: ['build', 'runtime', 'compile'],
          run: () => {
            void runtime.restartBuild();
          },
        },
        {
          id: 'runtime-show-modified',
          title: 'Show Modified Files',
          subtitle: 'List files the Runtime observed as changed',
          group: 'Runtime',
          icon: icon(<FileText className="size-4" />),
          keywords: ['git', 'modified', 'changes', 'diff'],
          run: () => {
            void runtime.getModifiedFiles().then((files) => {
              notify({
                title:
                  files.length === 0 ? 'No modified files' : `${files.length} modified file(s)`,
                description: files.slice(0, 3).join(', ') || 'Working tree clean',
                intent: files.length === 0 ? 'success' : 'info',
              });
            });
          },
        },
        {
          id: 'runtime-open-terminal',
          title: 'Open Terminal',
          subtitle: 'Spawn a real terminal session via the Runtime',
          group: 'Runtime',
          icon: icon(<Terminal className="size-4" />),
          keywords: ['terminal', 'shell', 'runtime', 'console'],
          run: () => {
            void runtime.openTerminal('npm', ['run', 'dev']).catch(() => {
              notify({
                title: 'Terminal unavailable in browser',
                description: 'Terminal sessions run in the Nova Runtime backend.',
                intent: 'info',
              });
            });
          },
        },
      ];
      return commands;
    },
  };
}

/** The default set of providers shipped with the Command Center. */
export const builtInProviders: ReadonlyArray<CommandProvider> = [
  navigationProvider(),
  projectsProvider(),
  recentProjectsProvider(),
  workflowsProvider(),
  missionsProvider(),
  recentFilesProvider(),
  runtimeProvider(),
  settingsProvider(),
  documentationProvider(),
];
