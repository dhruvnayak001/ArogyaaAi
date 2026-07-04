/**
 * components/navigation/TopBar.jsx
 * Dashboard top header with search, notifications, and user menu.
 * Fully responsive across all phone / tablet sizes.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Search, ChevronDown, User, Settings, LogOut,
} from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import { clsx } from 'clsx';
import NotificationBell from '@components/notifications/NotificationBell';
import toast from 'react-hot-toast';

function TopBar({ onToggleSidebar, isDoctor = false }) {
  const { user, logout }                = useAuthStore();
  const navigate                        = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const profilePath  = isDoctor ? '/doctor/profile'   : '/profile';
  const settingsPath = isDoctor ? '/doctor/settings'  : '/settings';

  const handleLogout = async () => {
    setUserMenuOpen(false);
    try {
      await logout();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <header className="sticky top-0 z-20 h-14 sm:h-16 flex items-center px-3 sm:px-6 border-b border-white/5 bg-dark-950/80 backdrop-blur-xl gap-2 sm:gap-4">
      {/* Sidebar toggle */}
      <button
        id="topbar-sidebar-toggle"
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search bar — hidden on xs, visible on sm+ */}
      <div className="hidden sm:flex flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
        />
      </div>

      {/* Mobile search icon */}
      <button
        className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        onClick={() => setSearchOpen((p) => !p)}
        aria-label="Search"
      >
        <Search className="w-4 h-4" />
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {/* Notifications */}
        <NotificationBell />

        {/* User menu */}
        <div className="relative">
          <button
            id="topbar-user-menu"
            onClick={() => setUserMenuOpen((p) => !p)}
            className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all"
          >
            <div className="avatar-sm text-xs">{initials}</div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-white leading-none truncate max-w-[100px]">{user?.name || 'User'}</p>
              <p className="text-2xs text-slate-500 leading-none mt-0.5 capitalize">{user?.role || 'patient'}</p>
            </div>
            <ChevronDown className={clsx('w-3 h-3 sm:w-4 sm:h-4 text-slate-500 transition-transform', userMenuOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <>
                {/* Backdrop to close menu on outside click */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{    opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-52 glass-card overflow-hidden z-50"
                >
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <Link
                      to={profilePath}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link
                      to={settingsPath}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    <hr className="border-white/5 my-1" />
                    <button
                      id="topbar-logout-btn"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-danger-400 hover:bg-danger-500/10 transition-all"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile search expandable row */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden absolute top-14 left-0 right-0 px-3 py-2 bg-dark-950/95 border-b border-white/5 backdrop-blur-xl z-30"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default TopBar;
