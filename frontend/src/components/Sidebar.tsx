import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  Video,
  Users,
  Activity,
  Languages,
  User as UserIcon,
  Stethoscope,
  AlertTriangle,
  Pill,
  FileText,
  Navigation
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const navItems = {
  common: [
    { labelKey: 'nav.dashboard', name: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
    { labelKey: 'nav.ai_chat', name: 'AI Chat', href: '/ai-chat', Icon: MessageSquare },
    { labelKey: 'nav.appointments', name: 'Appointments', href: '/appointments', Icon: CalendarDays },
    { labelKey: 'nav.video_call', name: 'Video Call', href: '/video-consultation', Icon: Video },
    { labelKey: 'nav.ai_insights', name: 'AI Insights', href: '/predictive-insights', Icon: Activity },
    { labelKey: 'nav.languages', name: 'Languages', href: '/multilingual', Icon: Languages },
    { labelKey: 'nav.profile', name: 'Profile', href: '/profile', Icon: UserIcon }
  ],
  patient: [
    { labelKey: 'nav.find_doctor', name: 'Find Doctor', href: '/ai-appointments', Icon: Stethoscope, badge: 'AI' },
    { labelKey: 'nav.medicine', name: 'Medicine', href: '/medicine', Icon: Pill, badge: '10m' },
    { labelKey: 'nav.prescriptions', name: 'Prescriptions', href: '/prescriptions', Icon: FileText },
    { labelKey: 'nav.freelance_patient', name: 'Freelance Doctor', href: '/freelance', Icon: Navigation, badge: 'LIVE' },
    { labelKey: 'nav.family', name: 'Family', href: '/family', Icon: Users },
    { labelKey: 'nav.emergency_sos', name: 'Emergency SOS', href: '/sos', Icon: AlertTriangle }
  ],
  doctor: [
    { labelKey: 'nav.freelance_doctor', name: 'Freelance Mode', href: '/doctor/freelance', Icon: Navigation, badge: 'LIVE' }
  ],
  ambulance: [
    { labelKey: 'nav.ambulance_dashboard', name: 'Ambulance Dashboard', href: '/ambulance-dashboard', Icon: AlertTriangle }
  ]
} as const;

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { t, dir } = useI18n();

  const role = user?.role;
  const items = [
    ...navItems.common,
    ...(role === 'PATIENT' ? navItems.patient : []),
    ...(role === 'DOCTOR' ? navItems.doctor : []),
    ...(role === 'AMBULANCE' ? navItems.ambulance : [])
  ];

  return (
    <aside
      className={`fixed top-16 ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} h-[calc(100vh-4rem)] bg-white/90 dark:bg-dark-surface/90 backdrop-blur-md ${dir === 'rtl' ? 'border-l border-light-border dark:border-dark-border' : 'border-r border-light-border dark:border-dark-border'} transition-all duration-300 z-30
        ${isOpen ? 'w-64' : 'w-16'}`}
      aria-label="Sidebar"
    >
      <nav className="h-full py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {items.map(({ name, labelKey, href, Icon }) => {
            const active = location.pathname === href || location.pathname.startsWith(href + '/');
            const label = labelKey ? t(labelKey) : name;
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
                  {isOpen && (
                    <span className="whitespace-nowrap flex items-center gap-2">
                      {label}
                      {'badge' in (items.find(n => n.href === href) || {}) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                          {(items.find(n => n.href === href) as any)?.badge || 'AI'}
                        </span>
                      )}
                    </span>
                  )}
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
