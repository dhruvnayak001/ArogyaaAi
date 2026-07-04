/**
 * pages/notifications/NotificationsPage.jsx
 * Full notifications center with filter tabs, infinite scroll, and empty states
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell, Calendar, CheckCircle2, XCircle, Clock,
  AlertTriangle, Sparkles, Check, Trash2, RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { useNotificationStore } from '@store/notificationStore';

/* ── Type config ── */
const TYPE_CONFIG = {
  appointment_booked:    { icon: Calendar,      color: 'text-primary-400',  bg: 'bg-primary-500/10',  label: 'Booked' },
  appointment_confirmed: { icon: CheckCircle2,  color: 'text-emerald-400',  bg: 'bg-emerald-500/10',  label: 'Confirmed' },
  appointment_cancelled: { icon: XCircle,       color: 'text-danger-400',   bg: 'bg-danger-500/10',   label: 'Cancelled' },
  appointment_reminder:  { icon: Clock,         color: 'text-amber-400',    bg: 'bg-amber-500/10',    label: 'Reminder' },
  doctor_approval:       { icon: CheckCircle2,  color: 'text-cyan-400',     bg: 'bg-cyan-500/10',     label: 'Approval' },
  emergency_alert:       { icon: AlertTriangle, color: 'text-red-400',      bg: 'bg-red-500/10',      label: 'Emergency' },
  ai_summary_ready:      { icon: Sparkles,      color: 'text-violet-400',   bg: 'bg-violet-500/10',   label: 'AI Summary' },
};

const FILTER_TABS = [
  { id: 'all',    label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'appointment_booked',    label: 'Bookings' },
  { id: 'appointment_confirmed', label: 'Confirmed' },
  { id: 'appointment_cancelled', label: 'Cancelled' },
  { id: 'appointment_reminder',  label: 'Reminders' },
  { id: 'ai_summary_ready',      label: 'AI' },
];

/* ── Single notification row ── */
function NotifRow({ notif }) {
  const { markRead, deleteNotification } = useNotificationStore();
  const navigate   = useNavigate();
  const config     = TYPE_CONFIG[notif.type] || { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'System' };
  const IconComp   = config.icon;

  const handleClick = async () => {
    if (!notif.isRead) await markRead(notif._id);
    if (notif.link) navigate(notif.link);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${
        !notif.isRead
          ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07]'
          : 'bg-transparent border-transparent hover:bg-white/[0.03]'
      }`}
      onClick={handleClick}
    >
      {/* Unread dot */}
      {!notif.isRead && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-primary-500" />
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${config.bg}`}>
        <IconComp className={`w-5 h-5 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${!notif.isRead ? 'text-white' : 'text-slate-300'}`}>
                {notif.title}
              </p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${config.bg} ${config.color}`}>
                {config.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              {notif.message}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1">
            {!notif.isRead && (
              <button
                onClick={(e) => { e.stopPropagation(); markRead(notif._id); }}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                title="Mark as read"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-slate-500 hover:text-danger-400 hover:bg-danger-500/10 transition-all"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Empty state ── */
function EmptyState({ filter }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-slate-800/50 border border-white/5 flex items-center justify-center mb-6">
        <Bell className="w-8 h-8 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-2">
        {filter === 'unread' ? 'You\'re all caught up!' : 'No notifications'}
      </h3>
      <p className="text-sm text-slate-500 max-w-xs">
        {filter === 'unread'
          ? 'No unread notifications. Everything looks good!'
          : 'Notifications will appear here when there\'s activity on your account.'}
      </p>
    </motion.div>
  );
}

/* ── Loading skeleton ── */
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] animate-pulse">
          <div className="w-11 h-11 rounded-xl bg-white/5 flex-shrink-0" />
          <div className="flex-1 space-y-2.5 pt-1">
            <div className="h-3 bg-white/5 rounded-full w-2/5" />
            <div className="h-2.5 bg-white/5 rounded-full w-full" />
            <div className="h-2.5 bg-white/5 rounded-full w-3/4" />
            <div className="h-2 bg-white/5 rounded-full w-1/4 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════ */
export default function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const {
    notifications, unreadCount, isLoading, pagination,
    fetchNotifications, fetchMore, markAllRead,
  } = useNotificationStore();

  /* Fetch when filter changes */
  useEffect(() => {
    const params = { page: 1, limit: 20 };
    if (activeFilter === 'unread') params.unreadOnly = true;
    fetchNotifications(params);
  }, [activeFilter]);

  /* Client-side type filter (applied after fetch) */
  const filtered = notifications.filter((n) => {
    if (activeFilter === 'all')    return true;
    if (activeFilter === 'unread') return !n.isRead;
    return n.type === activeFilter;
  });

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Notifications</h1>
            <p className="text-slate-400 mt-1 text-sm">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'You\'re up to date'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotifications({ page: 1, limit: 20 })}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-sm font-medium"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Filter tabs ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 flex-wrap mb-6"
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`notif-filter-${tab.id}`}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              activeFilter === tab.id
                ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/20'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
            {tab.id === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ── List ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-2"
      >
        {isLoading && notifications.length === 0 ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((notif) => (
              <NotifRow key={notif._id} notif={notif} />
            ))}
          </AnimatePresence>
        )}

        {/* Load more */}
        {pagination?.hasMore && !isLoading && (
          <div className="flex justify-center pt-4">
            <button
              onClick={fetchMore}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-sm"
            >
              <ChevronDown className="w-4 h-4" />
              Load more
            </button>
          </div>
        )}

        {isLoading && notifications.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </motion.div>
    </div>
  );
}
