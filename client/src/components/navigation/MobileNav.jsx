/**
 * components/navigation/MobileNav.jsx
 * Bottom navigation bar shown on mobile (<lg) for the patient dashboard.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Calendar,
  FileText, Bell, MoreHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationStore } from '@store/notificationStore';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Home',         to: '/dashboard' },
  { icon: MessageSquare,   label: 'AI Chat',      to: '/chat' },
  { icon: Calendar,        label: 'Appts',        to: '/appointments' },
  { icon: FileText,        label: 'Records',      to: '/records' },
  { icon: Bell,            label: 'Alerts',       to: '/notifications' },
];

function MobileNav() {
  const { unreadCount } = useNotificationStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <div
        className="flex items-center justify-around px-2 py-2 border-t border-white/10"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
        }}
      >
        {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[3rem]',
                isActive
                  ? 'text-primary-400'
                  : 'text-slate-500 hover:text-slate-300'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon className={clsx('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(6,148,162,0.8)]')} />
                  {label === 'Alerts' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-danger-500 text-white text-[8px] font-bold leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={clsx('text-[9px] font-medium', isActive ? 'text-primary-400' : 'text-slate-600')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default MobileNav;
