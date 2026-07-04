/**
 * components/notifications/NotificationBell.jsx
 * Bell icon button with animated unread badge + dropdown
 * Starts polling on mount; stops on unmount.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '@store/notificationStore';
import { useAuthStore } from '@store/authStore';
import NotificationDropdown from './NotificationDropdown';

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { unreadCount, startPolling, stopPolling } = useNotificationStore();

  /* Start polling when authenticated */
  useEffect(() => {
    if (isAuthenticated) {
      startPolling();
    }
    return () => stopPolling();
  }, [isAuthenticated]);

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative">
      <button
        id="topbar-notifications"
        onClick={() => setIsOpen((p) => !p)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        aria-label={`Notifications${unreadCount > 0 ? ` (${displayCount} unread)` : ''}`}
      >
        <Bell className={`w-5 h-5 transition-all ${isOpen ? 'text-primary-400' : ''}`} />

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{    scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className={`absolute flex items-center justify-center font-bold text-white bg-danger-500 ring-2 ring-dark-950 ${
                unreadCount > 9
                  ? 'top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px]'
                  : 'top-1 right-1 w-4 h-4 rounded-full text-[10px]'
              }`}
            >
              {displayCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Pulse ring when there are new notifications */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger-500/30 animate-ping" />
        )}
      </button>

      <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

export default NotificationBell;
