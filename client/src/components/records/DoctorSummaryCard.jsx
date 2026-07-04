/**
 * components/records/DoctorSummaryCard.jsx
 * Displays the AI-generated clinical doctor summary for a health record.
 *
 * Shows:
 *  - Risk Level badge (Critical/High/Medium/Low)
 *  - Symptoms + Duration
 *  - Possible Conditions list
 *  - Suggested Tests chips
 *  - Urgent Flags (if any)
 *  - AI Confidence meter
 *  - Clinical Notes
 *  - AI disclaimer
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope, AlertTriangle, FlaskConical, Activity,
  Sparkles, Clock, ChevronDown, ChevronUp, Loader2,
  RotateCcw, ShieldAlert, CheckCircle2, Info,
  Zap,
} from 'lucide-react';
import { recordsApi } from '@api/records.api';
import toast from 'react-hot-toast';

/* ── Risk Level config ── */
const RISK_STYLES = {
  Critical: {
    bg:     'bg-red-500/15',
    border: 'border-red-500/35',
    text:   'text-red-400',
    bar:    'bg-red-500',
    icon:   ShieldAlert,
    width:  '100%',
  },
  High: {
    bg:     'bg-orange-500/15',
    border: 'border-orange-500/35',
    text:   'text-orange-400',
    bar:    'bg-orange-500',
    icon:   AlertTriangle,
    width:  '75%',
  },
  Medium: {
    bg:     'bg-yellow-500/15',
    border: 'border-yellow-500/35',
    text:   'text-yellow-400',
    bar:    'bg-yellow-500',
    icon:   Activity,
    width:  '50%',
  },
  Low: {
    bg:     'bg-success-500/15',
    border: 'border-success-500/35',
    text:   'text-success-400',
    bar:    'bg-success-500',
    icon:   CheckCircle2,
    width:  '25%',
  },
};

function ConfidenceMeter({ value }) {
  /* value: 0-100 */
  const clamped = Math.max(0, Math.min(100, value || 0));
  const color = clamped >= 80 ? 'bg-success-500' : clamped >= 60 ? 'bg-yellow-500' : 'bg-danger-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-accent-400" />
          AI Confidence
        </span>
        <span className="font-bold text-white">{clamped}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

export default function DoctorSummaryCard({ summary, recordId, onRefresh }) {
  const [expanded,     setExpanded]     = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  if (!summary) return null;

  const risk    = summary.riskLevel || 'Low';
  const styles  = RISK_STYLES[risk] || RISK_STYLES.Low;
  const RiskIcon = styles.icon;

  const hasUrgent     = summary.urgentFlags?.length > 0;
  const hasTests      = summary.suggestedTests?.length > 0;
  const hasConditions = summary.possibleConditions?.length > 0;
  const hasSymptoms   = summary.symptoms?.length > 0;

  const handleRegenerate = async () => {
    if (!recordId) return;
    setRegenerating(true);
    try {
      const { data } = await recordsApi.generateDoctorSummary(recordId);
      toast.success('Doctor summary regenerated');
      onRefresh?.(data.data?.doctorSummary);
    } catch {
      toast.error('Failed to regenerate summary');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-0"
    >
      {/* ── Header card ── */}
      <div className={`rounded-2xl rounded-b-none border-b-0 border p-5 ${styles.bg} ${styles.border}`}>
        {/* Row 1: Title + Risk badge + Regen */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">AI Consultation Summary</p>
              <p className="text-xs text-slate-500 mt-0.5">For doctor reference · AI-supported triage</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Risk badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${styles.bg} ${styles.border} ${styles.text}`}>
              <RiskIcon className="w-3.5 h-3.5" />
              {risk} Risk
            </span>
            {/* Regen button */}
            {onRefresh && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                title="Regenerate summary"
                className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-primary-400 hover:border-primary-500/30 transition-all"
              >
                {regenerating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RotateCcw className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Risk bar */}
        <div className="h-0.5 rounded-full bg-white/10 mb-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: styles.width }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className={`h-full rounded-full ${styles.bar} opacity-70`}
          />
        </div>

        {/* Urgent flags */}
        {hasUrgent && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 mb-4">
            <Zap className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-400 mb-1">Urgent Attention Required</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.urgentFlags.map((f, i) => (
                  <span key={i} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-lg">{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Symptoms + Duration row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hasSymptoms && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Symptoms</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.symptoms.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg bg-primary-500/15 border border-primary-500/20 text-primary-300 text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}
          {summary.duration && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Duration
              </p>
              <p className="text-white text-sm font-medium">{summary.duration}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Expandable lower section ── */}
      <div className={`rounded-2xl rounded-t-none border ${styles.border} overflow-hidden`}>
        {/* Toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors"
        >
          <span className="text-xs font-semibold text-slate-400">
            {expanded ? 'Hide details' : 'Show conditions, tests & clinical notes'}
          </span>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4 border-t border-white/5">
                {/* Possible Conditions */}
                {hasConditions && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-4 mb-2 flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Possible Conditions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {summary.possibleConditions.map((c, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-accent-500/15 border border-accent-500/20 text-accent-300 text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Tests */}
                {hasTests && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" /> Suggested Tests
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {summary.suggestedTests.map((t, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-success-500/10 border border-success-500/20 text-success-300 text-xs font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Confidence meter */}
                {summary.aiConfidence !== null && summary.aiConfidence !== undefined && (
                  <ConfidenceMeter value={summary.aiConfidence} />
                )}

                {/* Clinical Notes */}
                {summary.clinicalNotes && (
                  <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8">
                    <p className="text-xs font-semibold text-primary-400 mb-1">Clinical Notes (AI)</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{summary.clinicalNotes}</p>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {summary.disclaimer || 'AI-supported triage — final diagnosis requires clinical evaluation'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
