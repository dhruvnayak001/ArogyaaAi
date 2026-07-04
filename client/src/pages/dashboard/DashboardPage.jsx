/**
 * pages/dashboard/DashboardPage.jsx
 * Patient dashboard — real data from APIs, stats, recent activity, quick actions
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare, Calendar, FileText, AlertTriangle, Activity,
  TrendingUp, Clock, ArrowRight, Sparkles, Stethoscope,
} from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import { useChatStore } from '@store/chatStore';
import { appointmentsApi } from '@api/appointments.api';
import { recordsApi } from '@api/records.api';
import StatusBadge from '@components/ui/StatusBadge';
import { CardSkeleton } from '@components/ui/LoadingSkeleton';
import { format, isAfter, formatDistanceToNow } from 'date-fns';

const QUICK_ACTIONS = [
  { icon: MessageSquare, label: 'Chat with AI', to: '/chat', color: 'from-primary-500 to-primary-700' },
  { icon: Calendar, label: 'Book Appointment', to: '/appointments/book', color: 'from-accent-600  to-accent-800' },
  { icon: FileText, label: 'Health Records', to: '/records', color: 'from-success-500 to-success-700' },
  { icon: AlertTriangle, label: 'Emergency', to: '/emergency', color: 'from-danger-600  to-danger-800' },
];

const cardV = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { sessions = [], loadSessions, isLoadingSessions } = useChatStore();

  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(true);

  useEffect(() => {
    let isMounted = true;

    loadSessions();

    appointmentsApi.getAll()
      .then(({ data }) => {
        if (isMounted) setAppointments(data.data?.appointments ?? data.appointments ?? []);
      })
      .catch(() => { })
      .finally(() => { if (isMounted) setLoadingAppts(false); });

    recordsApi.getAll()
      .then(({ data }) => {
        if (isMounted) setRecords(data.data?.records ?? data.records ?? []);
      })
      .catch(() => { })
      .finally(() => { if (isMounted) setLoadingRecs(false); });

    return () => { isMounted = false; };
  // loadSessions is a stable Zustand action ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Derived values */
  const now = new Date();
  const upcomingAppts = appointments.filter(
    (a) => isAfter(new Date(a.date), now) && !['cancelled', 'completed'].includes(a.status)
  );
  const nextAppt = upcomingAppts[0];
  const recentSessions = sessions?.slice(0, 4) || [];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-3xl font-display font-bold text-white">
            {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-slate-400 mt-1">Here's your health overview for today.</p>
        </div>
        <div className="flex items-center gap-2 glass-card px-4 py-2.5">
          <Sparkles className="w-4 h-4 text-accent-400" />
          <span className="text-sm text-slate-300">
            ArogyaAI <span className="text-accent-400 font-semibold">Pro</span>
          </span>
        </div>
      </motion.div>

      {/* ── Quick actions ── */}
      <section>
        <h2 className="section-heading mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action, i) => (
            <motion.div
              key={action.to}
              variants={cardV}
              initial="initial"
              animate="animate"
              transition={{ delay: i * 0.07, duration: 0.3 }}
            >
              <Link
                id={`quick-action-${action.label.toLowerCase().replace(/\s/g, '-')}`}
                to={action.to}
                className="glass-card-hover p-5 flex flex-col gap-3 group"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white group-hover:text-primary-300 transition-colors flex items-center gap-1">
                  {action.label}
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Stats row ── */}
      <section>
        <h2 className="section-heading mb-4">Health Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Upcoming Appointments',
              value: loadingAppts ? '…' : upcomingAppts.length,
              sub: upcomingAppts.length === 0 ? 'None scheduled' : `Next: ${nextAppt ? format(new Date(nextAppt.date), 'MMM d') : '—'}`,
              icon: Calendar,
              color: 'text-primary-400',
            },
            {
              label: 'AI Chat Sessions',
              value: isLoadingSessions ? '…' : sessions.length,
              sub: 'All time conversations',
              icon: MessageSquare,
              color: 'text-accent-400',
            },
            {
              label: 'Health Records',
              value: loadingRecs ? '…' : records.length,
              sub: records.length === 0 ? 'No documents yet' : `${records.filter(r => r.type === 'lab_report').length} lab reports`,
              icon: FileText,
              color: 'text-success-400',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={cardV}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.25 + i * 0.08, duration: 0.3 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{stat.label}</p>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-3xl font-display font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Two column: next appointment + recent chat ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Next appointment */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-heading text-xl">Next Appointment</h2>
            <Link to="/appointments" className="text-primary-400 text-sm hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {loadingAppts ? (
            <CardSkeleton count={1} />
          ) : !nextAppt ? (
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
              <Calendar className="w-8 h-8 text-slate-600" />
              <p className="text-slate-400 text-sm">No upcoming appointments</p>
              <Link to="/appointments/book" className="btn-primary text-sm px-4 py-2">
                Book Now
              </Link>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex flex-col items-center justify-center text-center">
                  <p className="text-primary-400 font-bold text-xl leading-none">{format(new Date(nextAppt.date), 'd')}</p>
                  <p className="text-primary-400/60 text-xs uppercase">{format(new Date(nextAppt.date), 'MMM')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">Dr. {nextAppt.doctor?.name ?? '—'}</p>
                  <p className="text-sm text-slate-400">{nextAppt.doctor?.doctorProfile?.specialization ?? ''}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {nextAppt.time}
                    </span>
                    <StatusBadge status={nextAppt.status} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 bg-white/5 rounded-lg px-3 py-2">
                {formatDistanceToNow(new Date(nextAppt.date), { addSuffix: true })}
              </p>
            </motion.div>
          )}
        </section>

        {/* Recent AI sessions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-heading text-xl">Recent AI Chats</h2>
            <Link to="/chat" className="text-primary-400 text-sm hover:underline flex items-center gap-1">
              Open Chat <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {isLoadingSessions ? (
            <CardSkeleton count={3} />
          ) : recentSessions.length === 0 ? (
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
              <MessageSquare className="w-8 h-8 text-slate-600" />
              <p className="text-slate-400 text-sm">No conversations yet</p>
              <Link to="/chat" className="btn-primary text-sm px-4 py-2">
                Start Chatting
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <Link key={s._id} to={`/chat/${s._id}`}
                  className="glass-card-hover p-3.5 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.title || 'Conversation'}</p>
                    <p className="text-xs text-slate-500">
                      {s.updatedAt ? formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true }) : '—'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
