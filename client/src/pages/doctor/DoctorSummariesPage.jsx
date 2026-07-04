/**
 * pages/doctor/DoctorSummariesPage.jsx
 *
 * AI Pre-Consultation Summaries for doctors.
 * Fetches all appointments that have an AI consultation brief and renders
 * them as premium clinical case cards — sorted by urgency.
 *
 * A doctor should understand each patient case within 10 seconds.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Brain, AlertTriangle, Activity,
  Clock, Stethoscope, Target, FileText, ChevronDown, ChevronUp,
  User, Calendar, Filter, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { appointmentsApi } from '@api/appointments.api';
import { AIConsultationBrief } from '@components/appointments/AIConsultationBrief';
import { CardSkeleton } from '@components/ui/LoadingSkeleton';
import toast from 'react-hot-toast';

/* ── Urgency sort order ── */
const URGENCY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, undefined: 4 };

const URGENCY_CONFIG = {
  CRITICAL: { label: 'Critical',    cls: 'bg-red-500/20 text-red-400 border-red-500/40',         dot: 'bg-red-500',     pulse: true  },
  HIGH:     { label: 'High Risk',   cls: 'bg-danger-500/20 text-danger-400 border-danger-500/40', dot: 'bg-danger-500',  pulse: true  },
  MEDIUM:   { label: 'Medium Risk', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40',   dot: 'bg-amber-400',   pulse: false },
  LOW:      { label: 'Low Risk',    cls: 'bg-success-500/20 text-success-400 border-success-500/40', dot: 'bg-success-400', pulse: false },
};

const FILTER_OPTIONS = ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/* ════════════════════════════════════════
   AI CASE CARD
   ════════════════════════════════════════ */
function AICaseCard({ appointment, index }) {
  const [expanded, setExpanded] = useState(index === 0); // first card open by default
  const brief   = appointment.aiConsultationBrief;
  const patient = appointment.patient;
  const urgency = URGENCY_CONFIG[brief?.urgencyLevel] || URGENCY_CONFIG.LOW;

  if (!brief?.summaryText) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`rounded-2xl border overflow-hidden transition-all ${
        ['CRITICAL','HIGH'].includes(brief.urgencyLevel)
          ? 'border-danger-500/30'
          : 'border-white/10'
      } bg-white/[0.03]`}
    >
      {/* Card header */}
      <button
        className="w-full text-left p-5 flex items-start gap-4"
        onClick={() => setExpanded((e) => !e)}
        id={`case-card-${appointment._id}`}
      >
        {/* Patient avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
          {patient?.name?.[0]?.toUpperCase() ?? 'P'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: name + urgency badge */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <p className="font-semibold text-white text-base">{patient?.name ?? 'Patient'}</p>

            {/* Urgency chip */}
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${urgency.cls}`}>
              <motion.span
                animate={urgency.pulse ? { scale: [1, 1.4, 1] } : {}}
                transition={{ repeat: urgency.pulse ? Infinity : 0, duration: 1.2 }}
                className={`w-1.5 h-1.5 rounded-full ${urgency.dot}`}
              />
              {urgency.label}
            </span>

            {/* AI Copilot tag */}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-500/15 border border-primary-500/30 text-primary-400">
              <Brain className="w-3 h-3" />
              AI Brief
            </span>
          </div>

          {/* Meta: date + specialty */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(appointment.date), 'MMM d, yyyy')} · {appointment.time}
            </span>
            {brief.recommendedSpecialty && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Stethoscope className="w-3.5 h-3.5" />
                {brief.recommendedSpecialty}
              </span>
            )}
            {brief.aiConfidence > 0 && (
              <span className="text-xs text-slate-600">
                {brief.aiConfidence}% AI confidence
              </span>
            )}
          </div>

          {/* Summary preview (collapsed) */}
          {!expanded && brief.summaryText && (
            <p className="text-sm text-slate-400 mt-2 line-clamp-2 leading-relaxed">
              {brief.summaryText}
            </p>
          )}
        </div>

        {/* Expand icon */}
        <div className="flex-shrink-0 mt-1">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-500" />
          }
        </div>
      </button>

      {/* Expanded: full AI brief */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="p-5">
              <AIConsultationBrief brief={brief} compact={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════ */
function DoctorSummariesPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [urgencyFilter, setFilter]      = useState('All');
  const [refreshing,   setRefreshing]   = useState(false);

  const load = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const { data } = await appointmentsApi.getAll();
      const all = data.data?.appointments ?? data.appointments ?? [];
      setAppointments(all);
    } catch {
      toast.error('Failed to load AI summaries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* Filter to only appointments with a meaningful AI brief */
  const withBriefs = useMemo(() =>
    appointments
      .filter((a) => !!a.aiConsultationBrief?.summaryText)
      .sort((a, b) =>
        (URGENCY_ORDER[a.aiConsultationBrief?.urgencyLevel] ?? 4) -
        (URGENCY_ORDER[b.aiConsultationBrief?.urgencyLevel] ?? 4)
      ),
    [appointments]
  );

  const filtered = useMemo(() =>
    urgencyFilter === 'All'
      ? withBriefs
      : withBriefs.filter((a) => a.aiConsultationBrief?.urgencyLevel === urgencyFilter),
    [withBriefs, urgencyFilter]
  );

  /* Stats */
  const critical = withBriefs.filter((a) => a.aiConsultationBrief?.urgencyLevel === 'CRITICAL').length;
  const high     = withBriefs.filter((a) => a.aiConsultationBrief?.urgencyLevel === 'HIGH').length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="section-heading flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary-400" />
            AI Clinical Summaries
          </h1>
          <p className="section-subheading mt-1">
            Gemini-generated pre-consultation briefs for every patient
            {withBriefs.length > 0 && ` · ${withBriefs.length} total`}
            {critical > 0 && <span className="text-red-400 ml-2">· {critical} critical</span>}
            {high > 0 && <span className="text-danger-400 ml-1">· {high} high risk</span>}
          </p>
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-sm text-slate-400 hover:text-white transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Urgency filter */}
      {withBriefs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500">Filter:</span>
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  urgencyFilter === f
                    ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                    : 'text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20'
                }`}
              >
                {f === 'All' ? `All (${withBriefs.length})` : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : withBriefs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-14 flex flex-col items-center text-center gap-5"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary-500/10 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">No AI Briefs Yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              AI summaries appear here when patients generate a Copilot brief
              before booking their appointment.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {[
              { icon: Brain,       text: 'Symptoms analyzed in any language' },
              { icon: FileText,    text: 'Lab reports cross-referenced' },
              { icon: Target,      text: 'Focus areas suggested for you' },
              { icon: AlertTriangle, text: 'Risk level assigned automatically' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-xs text-slate-400">
                <Icon className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </motion.div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-slate-400">No {urgencyFilter.toLowerCase()} risk cases right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt, i) => (
            <AICaseCard key={appt._id} appointment={appt} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export default DoctorSummariesPage;
