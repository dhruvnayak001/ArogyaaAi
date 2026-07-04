/**
 * components/notifications/ReminderBanner.jsx
 * Floating dismissible banner for appointments happening within 1 hour.
 * Dismissed state persists in sessionStorage so it doesn't re-appear on
 * the same browser session after dismissal.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, ArrowRight } from 'lucide-react';
import { useNotificationStore } from '@store/notificationStore';
import { useAuthStore } from '@store/authStore';

const DISMISSED_KEY = 'arogyaai_reminder_banner_dismissed';

function ReminderBanner() {
  const [visible, setVisible]       = useState(false);
  const [reminder, setReminder]     = useState(null);
  const { isAuthenticated }         = useAuthStore();
  const { notifications }           = useNotificationStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    /* Find the most recent 1h appointment_reminder notification */
    const reminderNotif = notifications.find(
      (n) => n.type === 'appointment_reminder' && !n.isRead && n.data?.hoursAway === 1
    );

    if (!reminderNotif) { setVisible(false); return; }

    /* Check if this specific reminder was dismissed in this session */
    const dismissed = sessionStorage.getItem(`${DISMISSED_KEY}_${reminderNotif._id}`);
    if (dismissed) { setVisible(false); return; }

    setReminder(reminderNotif);
    setVisible(true);
  }, [notifications, isAuthenticated]);

  const dismiss = () => {
    if (reminder) {
      sessionStorage.setItem(`${DISMISSED_KEY}_${reminder._id}`, '1');
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && reminder && (
        <motion.div
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -60 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl shadow-2xl">
            {/* Icon */}
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-200 leading-tight">
                {reminder.title}
              </p>
              <p className="text-xs text-amber-400/80 truncate mt-0.5">
                {reminder.message}
              </p>
            </div>

            {/* CTA */}
            <Link
              to="/appointments"
              onClick={dismiss}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors"
            >
              View
              <ArrowRight className="w-3 h-3" />
            </Link>

            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="flex-shrink-0 p-1.5 rounded-lg text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
              aria-label="Dismiss reminder"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ReminderBanner;
