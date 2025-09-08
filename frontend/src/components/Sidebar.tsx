import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  Video,
  Users,
  Activity,
  Languages,
  User as UserIcon,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const navItems = [
  { name: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { name: 'AI Chat', href: '/ai-chat', Icon: MessageSquare },
  { name: 'Appointments', href: '/appointments', Icon: CalendarDays },
  { name: 'Video Call', href: '/video-consultation', Icon: Video },
  { name: 'Family', href: '/family', Icon: Users },
  { name: 'AI Insights', href: '/predictive-insights', Icon: Activity },
  { name: 'Languages', href: '/multilingual', Icon: Languages },
  { name: 'Profile', href: '/profile', Icon: UserIcon },
] as const;

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const location = useLocation();

  return (
    <aside
      className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white/90 dark:bg-dark-surface/90 backdrop-blur-md border-r border-light-border dark:border-dark-border transition-all duration-300 z-30
        ${isOpen ? 'w-64' : 'w-16'}`}
      aria-label="Sidebar"
    >
      <nav className="h-full py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map(({ name, href, Icon }) => {
            const active = location.pathname === href || location.pathname.startsWith(href + '/');
            return (
              <li key={name}>
                <Link
                  to={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors
                    ${active
                      ? 'bg-matte-blue-100/70 dark:bg-matte-blue-800/70 text-sapphire-700 dark:text-sapphire-300'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-matte-blue-100/60 dark:hover:bg-matte-blue-800/60 hover:text-sapphire-700 dark:hover:text-sapphire-300'}`}
                  title={name}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {isOpen && <span className="whitespace-nowrap">{name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
