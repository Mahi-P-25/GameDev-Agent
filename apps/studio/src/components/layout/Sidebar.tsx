import { NavLink } from 'react-router-dom';
import { NovaMark } from '../brand';
import { Icon, type IconName } from '../icons';

export interface NavEntry {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
}

const NAV_ITEMS: ReadonlyArray<NavEntry> = [
  { to: '/', label: 'Studio', icon: 'home' },
  { to: '/projects', label: 'Projects', icon: 'projects' },
  { to: '/missions', label: 'Missions', icon: 'mission' },
  { to: '/workflows', label: 'Workflows', icon: 'workflow' },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export function Sidebar(): React.ReactNode {
  return (
    <aside className="flex h-full w-16 flex-col items-center gap-6 border-r border-[rgba(255,255,255,0.06)] bg-[#050505] py-5">
      <NavLink to="/" className="text-[#f5f5f5] transition-colors duration-200 hover:text-[#d4af37]" aria-label="Nova Studio home">
        <NovaMark size="md" />
      </NavLink>

      <nav className="flex flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-[#d4af37] bg-[rgba(212,175,55,0.1)]'
                  : 'text-[#5c5c5c] hover:text-[#f5f5f5] hover:bg-[rgba(255,255,255,0.04)]'
              }`
            }
            aria-label={item.label}
          >
            <Icon name={item.icon} size={20} />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
