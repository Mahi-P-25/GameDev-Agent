import { NavLink } from 'react-router-dom';
import { NovaMark } from '../brand';
import { Icon, type IconName } from '../icons';

/**
 * Nova navigation — a calm, premium rail. Not an admin menu.
 *
 * The rail is a quiet landmark: the studio mark at the top, a short set of
 * primary destinations, and the live studio-status at the bottom. It recedes
 * until needed; primary navigation is the Command Center (⌘K). The active
 * destination is marked by a thin gold accent, never a filled block — so the
 * rail stays calm and the content stays the hero.
 *
 * The project switcher lives in the Home hero (it is a context change, not a
 * nav item), so it is intentionally absent here.
 */

export interface NavEntry {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
  readonly badge?: string;
}

/** Primary destinations — six, not ten. Scoped views live inside a Project. */
export const NAV_PRIMARY: ReadonlyArray<NavEntry> = [
  { to: '/', label: 'Studio', icon: 'home' },
  { to: '/mission-control', label: 'Mission Control', icon: 'mission' },
  { to: '/projects', label: 'Projects', icon: 'projects' },
  { to: '/workflows', label: 'Workflows', icon: 'workflow' },
  { to: '/studio', label: 'Team', icon: 'studio' },
  { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: '3' },
];

export function Sidebar(): React.ReactNode {
  return (
    <aside className="nova-rail" aria-label="Primary">
      <div className="nova-rail__brand">
        <NavLink to="/" className="nova-rail__mark" aria-label="Nova Studio home">
          <NovaMark size="md" />
        </NavLink>
        <span className="nova-rail__word">Nova</span>
      </div>

      <nav className="nova-rail__nav">
        {NAV_PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `nova-rail__item${isActive ? ' nova-rail__item--active' : ''}`
            }
          >
            <Icon name={item.icon} size={18} />
            <span className="nova-rail__label">{item.label}</span>
            {item.badge !== undefined && <span className="nova-rail__badge">{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="nova-rail__footer">
        <NavLink
          to="/settings"
          className="nova-rail__item nova-rail__item--quiet"
          aria-label="Settings"
        >
          <Icon name="settings" size={18} />
          <span className="nova-rail__label">Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
