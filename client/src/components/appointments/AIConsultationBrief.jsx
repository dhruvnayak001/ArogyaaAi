/**
 * components/appointments/AIConsultationBrief.jsx
 *
 * The AI Copilot Summary card displayed in the booking wizard
 * AND in the doctor dashboard.
 *
 * Displays:
 *  - Urgency badge with color coding
 *  - Clinical summary text
 *  - Symptom chips
 *  - AI findings + abnormal values
 *  - Suggested focus areas for doctor
 *  - Recommended specialty
 *  - AI confidence meter
 *  - Disclaimer banner
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Activity, Target, Stethoscope, ChevronDown,
  ChevronUp, Brain, FileText, Clock,
} from 'lucide-react';

/* ── Urgency config ── */
const URGENCY_CONFIG = {
  LOW: {
    label:    'LOW RISK',
    icon:     Activity,
    bg:       'bg-success-500/15',
    border:   'border-success-500/40',
    text:     'text-success-400',
    dot:      'bg-success-400',
    badgeBg:  'bg-success-500/20',
  },
  MEDIUM: {
    label:    'MEDIUM RISK',
    icon:     AlertTriangle,
    bg:       'bg-amber-500/15',
    border:   'border-amber-500/40',
    text:     'text-amber-400',
    dot:      'bg-amber-400',
    badgeBg:  'bg-amber-500/20',
  },
  HIGH: {
    label:    'HIGH RISK',
    icon:     AlertTriangle,
    bg:       'bg-danger-500/15',
    border:   'border-danger-500/40',
    text:     'text-danger-400',
    dot:      'bg-danger-500',
    badgeBg:  'bg-danger-500/20',
  },
  CRITICAL: {
    label:    'CRITICAL',
    icon:     AlertTriangle,
    bg:       'bg-red-900/30',
    border:   'border-red-500/60',
    text:     'text-red-400',
    dot:      'bg-red-500',
    badgeBg:  'bg-red-500/25',
  },
};

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-500/15 border-red-500/30',
  high:     'text-danger-400 bg-danger-500/15 border-danger-500/30',
  moderate: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  low:      'text-slate-400 bg-white/5 border-white/10',
};

/**
 * @param {{
 *   brief: object,
 *   compact?: boolean,
 * }} props
 */
export function AIConsultationBrief({ brief, compact = false }) {
  const [expanded, setExpanded] = useState(!compact);

  if (!brief) return null;

  const urgency  = URGENCY_CONFIG[brief.urgencyLevel] || URGENCY_CONFIG.LOW;
  const UrgIcon  = urgency.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border overflow-hidden ${urgency.bg} ${urgency.border}`}
    >
      {/* Header row */}
      <div
        className={`flex items-center justify-between px-5 py-4 ${compact ? 'cursor-pointer' : ''}`}
        onClick={compact ? () => setExpanded((e) => !e) : undefined}
      >
        <div className="flex items-center gap-3">
          {/* Urgency badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${urgency.badgeBg}`}>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: brief.urgencyLevel === 'CRITICAL' ? Infinity : 0, duration: 1.2 }}
              className={`w-2 h-2 rounded-full ${urgency.dot}`}
            />
            <UrgIcon className={`w-3.5 h-3.5 ${urgency.text}`} />
            <span className={`text-xs font-bold tracking-widest ${urgency.text}`}>
              {urgency.label}
            </span>
          </div>

          {/* AI tag */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500/15 border border-primary-500/30">
            <Brain className="w-3 h-3 text-primary-400" />
            <span className="text-xs text-primary-400 font-medium">AI Copilot</span>
          </div>
        </div>

        {/* Confidence + expand */}
        <div className="flex items-center gap-3">
          {brief.aiConfidence > 0 && (
            <span className="text-xs text-slate-500">
              {brief.aiConfidence}% confidence
            </span>
          )}
          {compact && (
            expanded
              ? <ChevronUp className={`w-4 h-4 ${urgency.text}`} />
              : <ChevronDown className={`w-4 h-4 ${urgency.text}`} />
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">

              {/* AI Summary text */}
              {brief.summaryText && (
                <div className="flex gap-3">
                  <FileText className={`w-4 h-4 ${urgency.text} flex-shrink-0 mt-0.5`} />
                  <p className="text-sm text-slate-200 leading-relaxed">{brief.summaryText}</p>
                </div>
              )}

              {/* Two-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Symptoms */}
                {brief.symptoms?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Symptoms
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {brief.symptoms.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-full text-xs bg-white/8 border border-white/15 text-slate-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {brief.symptomTimeline && brief.symptomTimeline !== 'Unknown' && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Duration
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-300">{brief.symptomTimeline}</span>
                    </div>
                  </div>
                )}

                {/* Findings */}
                {brief.findings?.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      AI Findings
                    </p>
                    <ul className="space-y-1">
                      {brief.findings.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgency.dot}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Abnormal values */}
                {brief.abnormalValues?.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Abnormal Lab Values
                    </p>
                    <div className="space-y-2">
                      {brief.abnormalValues.map((v) => (
                        <div
                          key={v.parameter}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${
                            SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.low
                          }`}
                        >
                          <span className="font-medium">{v.parameter}</span>
                          <div className="text-right">
                            <span className="font-bold">{v.value}</span>
                            {v.normalRange && (
                              <span className="text-slate-500 ml-1.5">
                                (ref: {v.normalRange})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested focus areas */}
                {brief.suggestedFocusAreas?.length > 0 && (
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-primary-400" />
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Suggested Focus Areas
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {brief.suggestedFocusAreas.map((area) => (
                        <span
                          key={area}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary-500/15 border border-primary-500/30 text-primary-300"
                        >
                          → {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended specialty */}
                {brief.recommendedSpecialty && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Recommended Specialty
                    </p>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary-400" />
                      <span className="text-sm text-primary-300 font-medium">
                        {brief.recommendedSpecialty}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Disclaimer */}
              <div className="pt-3 border-t border-white/8">
                <p className="text-xs text-slate-600 italic">
                  ⚕️ {brief.disclaimer || 'AI-assisted clinical preparation summary. Not a medical diagnosis.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AIConsultationBrief;
