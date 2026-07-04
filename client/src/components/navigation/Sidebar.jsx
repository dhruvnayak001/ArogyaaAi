/**
 * components/navigation/Sidebar.jsx
 * Patient dashboard collapsible sidebar.
 * - Desktop (lg+): collapses to icon-only rail
 * - Mobile (<lg): slides in as a full drawer overlay
 */

import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  LayoutDashboard,
  MessageSquare,
  Calendar,
  FileText,
  AlertTriangle,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',     to: '/dashboard' },
  { icon: MessageSquare,   label: 'AI Chat',       to: '/chat' },
  { icon: Calendar,        label: 'Appointments',  to: '/appointments' },
  { icon: FileText,        label: 'Health Records', to: '/records' },
  { icon: AlertTriangle,   label: 'Emergency',     to: '/emergency' },
  { icon: Bell,            label: 'Notifications', to: '/notifications' },
];

const BOTTOM_ITEMS = [
  { icon: User,     label: 'Profile',  to: '/profile' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

function Sidebar({ isOpen, onToggle, isMobile = false }) {
  const { user, logout }       = useAuthStore();
  const { unreadCount }        = useNotificationStore();
  const navigate               = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to logout');
    }
  };

  // On mobile, sidebar is always full-width but translates off screen when closed
  const sidebarWidth = isMobile ? '16rem' : (isOpen ? '16rem' : '4.5rem');

  return (
    <motion.aside
      animate={{
        width: isMobile ? '16rem' : sidebarWidth,
        x: isMobile && !isOpen ? '-16rem' : 0,
      }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed top-0 left-0 h-full z-30 flex flex-col glass-card rounded-none border-r border-white/5"
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-white/5 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center flex-shrink-0 shadow-glow-primary">
          <Activity className="w-5 h-5 text-white" />
        </div>
        {(isOpen || isMobile) && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base font-display font-bold text-white truncate flex-1"
          >
            ArogyaAI
          </motion.span>
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

      {/* ── Main nav ── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-2 space-y-1">
        {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            className={({ isActive }) =>
              clsx(
                'sidebar-item',
                isActive && 'sidebar-item-active'
              )
            }
            title={(!isOpen && !isMobile) ? label : undefined}
          >
            <div className="relative flex-shrink-0">
              <Icon className="w-5 h-5" />
              {/* Unread badge on notification icon */}
              {label === 'Notifications' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-danger-500 text-white text-[8px] font-bold leading-none ring-1 ring-dark-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {(isOpen || isMobile) && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="truncate flex-1"
              >
                {label}
              </motion.span>
            )}
            {/* Inline unread count when sidebar is open */}
            {label === 'Notifications' && unreadCount > 0 && (isOpen || isMobile) && (
              <span className="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-danger-500 text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom section ── */}
      <div className="flex-shrink-0 border-t border-white/5 py-4 px-2 space-y-1">
        {BOTTOM_ITEMS.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx('sidebar-item', isActive && 'sidebar-item-active')
            }
            title={(!isOpen && !isMobile) ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {(isOpen || isMobile) && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        {/* Logout */}
        <button
          id="sidebar-logout"
          onClick={handleLogout}
          className="sidebar-item w-full text-left hover:text-danger-400"
          title={(!isOpen && !isMobile) ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(isOpen || isMobile) && <span className="truncate">Logout</span>}
        </button>

        {/* Toggle button — only show on desktop */}
        {!isMobile && (
          <button
            id="sidebar-toggle"
            onClick={onToggle}
            className="sidebar-item w-full text-left mt-2"
            title="Toggle sidebar"
          >
            {isOpen
              ? <ChevronLeft  className="w-5 h-5 flex-shrink-0" />
              : <ChevronRight className="w-5 h-5 flex-shrink-0" />}
            {isOpen && <span className="truncate text-xs text-slate-500">Collapse</span>}
          </button>
        )}
      </div>
    </motion.aside>
  );
}

export default Sidebar;
