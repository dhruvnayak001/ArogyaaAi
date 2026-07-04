/**
 * components/navigation/DoctorMobileNav.jsx
 * Bottom navigation bar shown on mobile (<lg) for the doctor dashboard.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, FileBarChart2, Settings,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Home',    to: '/doctor/dashboard' },
  { icon: Calendar,        label: 'Appts',   to: '/doctor/appointments' },
  { icon: Users,           label: 'Patients',to: '/doctor/patients' },
  { icon: FileBarChart2,   label: 'Reports', to: '/doctor/summaries' },
  { icon: Settings,        label: 'Settings',to: '/doctor/settings' },
];

function DoctorMobileNav() {
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
                  ? 'text-accent-400'
                  : 'text-slate-500 hover:text-slate-300'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={clsx('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(139,92,246,0.8)]')} />
                <span className={clsx('text-[9px] font-medium', isActive ? 'text-accent-400' : 'text-slate-600')}>
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

export default DoctorMobileNav;
