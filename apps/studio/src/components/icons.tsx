import type { ReactNode } from 'react';

/**
 * Minimal inline SVG icon set for the Nova Studio shell.
 *
 * Kept dependency-free (no icon library) and monochrome so icons inherit
 * `currentColor`. Each icon is a 20×20 stroke icon with a 1.6 stroke width,
 * matching the dark-first, professional aesthetic.
 */
export type IconName =
  | 'home'
  | 'workspace'
  | 'projects'
  | 'goals'
  | 'missions'
  | 'studio'
  | 'inbox'
  | 'settings'
  | 'workflow'
  | 'home'
  | 'check'
  | 'clock'
  | 'alert'
  | 'spark'
  | 'mission';

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v9h14v-9" />
    </>
  ),
  workspace: (
    <>
      <path d="M3 8l9-5 9 5" />
      <path d="M5 9v8h14V9" />
      <path d="M9 17v-5h6v5" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  missions: (
    <>
      <path d="M4 5h16" />
      <path d="M4 12h10" />
      <path d="M4 19h7" />
      <circle cx="17" cy="12" r="2.4" />
      <circle cx="14" cy="19" r="2.4" />
    </>
  ),
  studio: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3 20c0-3 2.2-5 5-5s5 2 5 5" />
      <path d="M11 20c0-3 2.2-5 5-5s5 2 5 5" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13l3-8h12l3 8" />
      <path d="M3 13h5l1.5 3h5L16 13h5v6H3z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" />
    </>
  ),
  check: <path d="M4 12l5 5L20 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </>
  ),
  workflow: (
    <>
      <rect x="3" y="4" width="7" height="5" rx="1.2" />
      <rect x="14" y="15" width="7" height="5" rx="1.2" />
      <path d="M6.5 9v4a3 3 0 0 0 3 3H14" />
    </>
  ),
  mission: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
}: { readonly name: IconName; readonly size?: number }): ReactNode {
  return (
    <svg
      className="nova-nav__icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
