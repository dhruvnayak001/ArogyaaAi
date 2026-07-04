/**
 * components/notifications/NotificationDropdown.jsx
 * Rich dropdown panel showing the last 10 notifications
 */

import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Calendar, CheckCircle2, XCircle, Clock, AlertTriangle,
  Sparkles, Bell, Check, Trash2, ExternalLink,
} from 'lucide-react';
import { useNotificationStore } from '@store/notificationStore';

/* ── Type → icon + colour mapping ── */
const TYPE_CONFIG = {
  appointment_booked:    { icon: Calendar,      color: 'text-primary-400',   bg: 'bg-primary-500/10' },
  appointment_confirmed: { icon: CheckCircle2,  color: 'text-emerald-400',   bg: 'bg-emerald-500/10' },
  appointment_cancelled: { icon: XCircle,       color: 'text-danger-400',    bg: 'bg-danger-500/10' },
  appointment_reminder:  { icon: Clock,         color: 'text-amber-400',     bg: 'bg-amber-500/10' },
  doctor_approval:       { icon: CheckCircle2,  color: 'text-cyan-400',      bg: 'bg-cyan-500/10' },
  emergency_alert:       { icon: AlertTriangle, color: 'text-red-400',       bg: 'bg-red-500/10' },
  ai_summary_ready:      { icon: Sparkles,      color: 'text-violet-400',    bg: 'bg-violet-500/10' },
};

function NotificationItem({ notif, onClose }) {
  const { markRead, deleteNotification } = useNotificationStore();
  const navigate = useNavigate();
  const config   = TYPE_CONFIG[notif.type] || { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-500/10' };
  const IconComp = config.icon;

  const handleClick = async () => {
    if (!notif.isRead) await markRead(notif._id);
    if (notif.link) { navigate(notif.link); onClose(); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`group flex gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 ${
        !notif.isRead ? 'bg-white/[0.03]' : ''
      }`}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${config.bg}`}>
        <IconComp className={`w-4 h-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-semibold leading-tight truncate ${!notif.isRead ? 'text-white' : 'text-slate-300'}`}>
            {notif.title}
          </p>
          {!notif.isRead && (
            <span className="flex-shrink-0 w-2 h-2 mt-0.5 rounded-full bg-primary-500" />
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
          {notif.message}
        </p>
        <p className="text-[10px] text-slate-600 mt-1">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Delete button (appears on hover) */}
      <button
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-danger-400 transition-all"
        onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
        title="Delete notification"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function NotificationDropdown({ isOpen, onClose }) {
  const { notifications, unreadCount, fetchNotifications, markAllRead, isLoading } =
    useNotificationStore();

  useEffect(() => {
    if (isOpen) fetchNotifications({ limit: 10 });
  }, [isOpen]);

  const displayedNotifs = notifications.slice(0, 10);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-12 w-96 z-50 glass-card overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary-400" />
                <p className="text-sm font-semibold text-white">Notifications</p>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300 transition-colors"
                    title="Mark all as read"
                  >
                    <Check className="w-3 h-3" />
                    All read
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-3 p-2 animate-pulse">
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5 pt-1">
                        <div className="h-2.5 bg-white/5 rounded-full w-3/4" />
                        <div className="h-2 bg-white/5 rounded-full w-full" />
                        <div className="h-2 bg-white/5 rounded-full w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedNotifs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-slate-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">You're all caught up!</p>
                  <p className="text-xs text-slate-600 mt-1">No notifications yet</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {displayedNotifs.map((notif) => (
                    <NotificationItem key={notif._id} notif={notif} onClose={onClose} />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {displayedNotifs.length > 0 && (
              <div className="border-t border-white/5 px-4 py-2.5">
                <Link
                  to="/notifications"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 w-full text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium py-0.5"
                >
                  View all notifications
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default NotificationDropdown;
