/**
 * components/navigation/DoctorSidebar.jsx
 * Doctor-specific sidebar with doctor nav items.
 * - Desktop (lg+): collapses to icon-only rail
 * - Mobile (<lg): slides in as a full drawer overlay
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, LayoutDashboard, Calendar,
  Users, FileBarChart2, Settings, LogOut,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@store/authStore';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',    to: '/doctor/dashboard'     },
  { icon: Calendar,        label: 'Appointments', to: '/doctor/appointments'  },
  { icon: Users,           label: 'My Patients',  to: '/doctor/patients'      },
  { icon: FileBarChart2,   label: 'AI Summaries', to: '/doctor/summaries'     },
  { icon: Settings,        label: 'Settings',     to: '/doctor/settings'      },
];

function DoctorSidebar({ isOpen, onToggle, isMobile = false }) {
  const { logout }   = useAuthStore();
  const navigate     = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <motion.aside
      animate={{
        width: isMobile ? '16rem' : (isOpen ? '16rem' : '4.5rem'),
        x: isMobile && !isOpen ? '-16rem' : 0,
      }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed top-0 left-0 h-full z-30 flex flex-col glass-card rounded-none border-r border-white/5"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-white/5 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-600 to-primary-500 flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        {(isOpen || isMobile) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex-1 min-w-0">
            <p className="text-sm font-display font-bold text-white">ArogyaAI</p>
            <p className="text-2xs text-accent-400 font-medium tracking-wide uppercase">Doctor Portal</p>
          </motion.div>
        )}
        {/* Close button on mobile */}
        {isMobile && isOpen && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-2 space-y-1">
        {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            id={`doctor-nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            className={({ isActive }) =>
              clsx('sidebar-item', isActive && 'sidebar-item-active')
            }
            title={(!isOpen && !isMobile) ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {(isOpen || isMobile) && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="truncate">
                {label}
              </motion.span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="flex-shrink-0 border-t border-white/5 py-4 px-2 space-y-1">
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-left hover:text-danger-400"
          title={(!isOpen && !isMobile) ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(isOpen || isMobile) && <span>Logout</span>}
        </button>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button onClick={onToggle} className="sidebar-item w-full text-left mt-2">
            {isOpen
              ? <ChevronLeft  className="w-5 h-5 flex-shrink-0" />
              : <ChevronRight className="w-5 h-5 flex-shrink-0" />}
            {isOpen && <span className="text-xs text-slate-500">Collapse</span>}
          </button>
        )}
      </div>
    </motion.aside>
  );
}

export default DoctorSidebar;
