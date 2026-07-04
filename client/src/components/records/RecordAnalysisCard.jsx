/**
 * components/records/RecordAnalysisCard.jsx
 *
 * Renders a saved confirmed health record in production-grade medical UI.
 *
 * Data source: the saved `record` from MongoDB — which now stores the
 * user-CONFIRMED structured data (not raw Gemini output).
 *
 * Layout:
 *  1. Patient Info Card             — name, age, doctor, lab, report date
 *  2. AI Summary hero card          — only shown when real (non-error) content
 *  3. Lab Values grid               — coloured LOW/NORMAL/HIGH metric cards
 *  4. Abnormal Findings             — severity cards with interpretation
 *  5. Conditions + Medicines chips  — pill tags
 *  6. Patient Corrections notice    — change log
 *  7. Doctor Summary                — AI clinical card (if available)
 *  8. Extracted Text accordion      — collapsed, cleaned text
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Activity, Pill,
  FlaskConical, Sparkles, Stethoscope, RotateCcw,
  Loader2, Brain, TrendingUp, TrendingDown, Minus,
  FileText, Edit3, User, Building2, Calendar, Heart,
  Droplets, ChevronDown, ChevronUp, ScanLine, Info,
} from 'lucide-react';
import DoctorSummaryCard from '@components/records/DoctorSummaryCard';

/* ════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════ */

/** Unwrap { value, confidence } or plain string safely */
const unwrap = (field) => {
  if (!field) return null;
  if (typeof field === 'string') return field.trim() || null;
  if (typeof field === 'object' && 'value' in field) {
    const v = field.value;
    return v && v !== 'null' && v !== 'undefined' ? String(v).trim() : null;
  }
  return null;
};

/** Is this an AI error/placeholder summary we should hide? */
const isHiddenSummary = (s) =>
  !s ||
  s.includes('encountered an error') ||
  s.includes('Insufficient text') ||
  s.includes('review the document manually') ||
  s.trim().length < 15;

/* ── Severity config ── */
const SEVERITY_CONFIG = {
  critical: { label: 'Critical',  bg: 'bg-red-500/15',     border: 'border-red-500/40',    text: 'text-red-400',    icon: AlertTriangle,  bar: 'bg-red-500',    barW: '100%' },
  high:     { label: 'High',      bg: 'bg-orange-500/15',  border: 'border-orange-500/40', text: 'text-orange-400', icon: AlertTriangle,  bar: 'bg-orange-500', barW: '80%'  },
  moderate: { label: 'Moderate',  bg: 'bg-yellow-500/15',  border: 'border-yellow-500/40', text: 'text-yellow-400', icon: Activity,       bar: 'bg-yellow-500', barW: '60%'  },
  low:      { label: 'Low',       bg: 'bg-blue-500/15',    border: 'border-blue-500/40',   text: 'text-blue-400',   icon: Activity,       bar: 'bg-blue-500',   barW: '40%'  },
  normal:   { label: 'Normal',    bg: 'bg-success-500/15', border: 'border-success-500/40',text: 'text-success-400',icon: CheckCircle2,   bar: 'bg-success-500',barW: '20%'  },
};

/* ── Lab value normal ranges ── */
const LAB_RANGES = {
  hemoglobin:    { label: 'Hemoglobin',    unit: 'g/dL',    min: 12.0, max: 17.5 },
  glucose:       { label: 'Blood Glucose', unit: 'mg/dL',   min: 70,   max: 99   },
  cholesterol:   { label: 'Cholesterol',   unit: 'mg/dL',   min: 0,    max: 200  },
  hba1c:         { label: 'HbA1c',         unit: '%',       min: 0,    max: 5.7  },
  creatinine:    { label: 'Creatinine',    unit: 'mg/dL',   min: 0.7,  max: 1.3  },
  sodium:        { label: 'Sodium',        unit: 'mEq/L',   min: 135,  max: 145  },
  potassium:     { label: 'Potassium',     unit: 'mEq/L',   min: 3.5,  max: 5.0  },
  wbc:           { label: 'WBC Count',     unit: '×10³/µL', min: 4.5,  max: 11.0 },
  platelets:     { label: 'Platelets',     unit: '×10³/µL', min: 150,  max: 400  },
  triglycerides: { label: 'Triglycerides', unit: 'mg/dL',   min: 0,    max: 150  },
};

function getLabStatus(key, rawVal) {
  const meta = LAB_RANGES[key];
  if (!meta) return 'unknown';
  const n = parseFloat(rawVal);
  if (isNaN(n)) return 'unknown';
  if (meta.min > 0 && n < meta.min) return 'low';
  if (n > meta.max) return 'high';
  return 'normal';
}

/* ════════════════════════════════════════
   SUB COMPONENTS
   ════════════════════════════════════════ */

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.normal;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

/** Single lab metric card — coloured by status */
function LabMetricCard({ labKey, value, index }) {
  const meta   = LAB_RANGES[labKey];
  const status = getLabStatus(labKey, value);

  const statusCfg = {
    low:     { bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300',    icon: TrendingDown, label: 'LOW'    },
    high:    { bg: 'bg-orange-500/10',  border: 'border-orange-500/25',  text: 'text-orange-400',  badge: 'bg-orange-500/20 text-orange-300', icon: TrendingUp,   label: 'HIGH'   },
    normal:  { bg: 'bg-success-500/10', border: 'border-success-500/25', text: 'text-success-400', badge: 'bg-success-500/20 text-success-300', icon: Minus,      label: 'NORMAL' },
    unknown: { bg: 'bg-white/5',        border: 'border-white/10',       text: 'text-slate-300',   badge: 'bg-white/10 text-slate-400',       icon: Minus,        label: ''       },
  }[status];

  const StatusIcon = statusCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-xl border p-4 ${statusCfg.bg} ${statusCfg.border}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-slate-300 leading-tight">
          {meta?.label || labKey.replace(/([A-Z])/g, ' $1').trim()}
        </p>
        {statusCfg.label && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold flex-shrink-0 ${statusCfg.badge}`}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </span>
        )}
      </div>
      <p className={`font-mono font-bold text-xl ${statusCfg.text}`}>
        {value}
        <span className="text-xs font-normal ml-1 opacity-70">{meta?.unit || ''}</span>
      </p>
      {meta && (
        <p className="text-xs text-slate-600 mt-1">
          Ref: {meta.min > 0 ? `${meta.min} – ` : `< `}{meta.max} {meta.unit}
        </p>
      )}
    </motion.div>
  );
}

function AbnormalRow({ finding }) {
  const severityColors = {
    critical: 'bg-red-500/10 border-red-500/25 text-red-400',
    high:     'bg-orange-500/10 border-orange-500/25 text-orange-400',
    moderate: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400',
    low:      'bg-blue-500/10 border-blue-500/25 text-blue-400',
  };
  const cls = severityColors[finding.severity] || 'bg-white/5 border-white/10 text-slate-400';

  const TrendIcon = finding.severity === 'critical' || finding.severity === 'high' ? TrendingUp
    : finding.severity === 'low' ? TrendingDown
    : Minus;

  return (
    <div className={`rounded-xl border p-3.5 ${cls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TrendIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <p className="font-semibold text-sm text-white">{finding.parameter}</p>
          </div>
          {finding.interpretation && (
            <p className="text-xs mt-1 opacity-80 leading-relaxed">{finding.interpretation}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono font-bold text-sm">{finding.value}</p>
          {finding.normalRange && (
            <p className="text-xs opacity-55 mt-0.5">Normal: {finding.normalRange}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Collapsible OCR text section */
function TextAccordion({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-300">Extracted Text</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {text.length.toLocaleString()} characters · {open ? 'Click to collapse' : 'Click to view'}
          </p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/5">
              <pre className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words mt-4 max-h-64 overflow-y-auto">
                {text}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════ */
export default function RecordAnalysisCard({ record, onReanalyze, reanalyzing }) {
  const analysis      = record?.analysis;
  const [doctorSum, setDoctorSum] = useState(record?.doctorSummary || null);
  const hasCorrections = record?.userCorrections?.length > 0;

  /* ── No analysis ─────────────────────────────────────────── */
  if (!analysis) {
    if (!record?.fileUrl) return null;
    return (
      <div className="glass-card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-slate-400">
          <FlaskConical className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">No AI analysis yet — this file was uploaded before analysis was enabled.</p>
        </div>
        {onReanalyze && (
          <button
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="btn-primary text-xs px-3 py-2 flex-shrink-0"
          >
            {reanalyzing
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
              : <><Sparkles className="w-3 h-3" /> Analyze</>}
          </button>
        )}
      </div>
    );
  }

  /* ── Parse confirmed data ─────────────────────────────────── */
  const profile   = analysis.patientProfile || {};
  const cfg       = SEVERITY_CONFIG[analysis.severity] || SEVERITY_CONFIG.normal;

  /* Patient scalar fields (supports both { value } and plain string) */
  const patientName   = unwrap(profile.patientName);
  const age           = unwrap(profile.age);
  const bloodPressure = unwrap(profile.bloodPressure);
  const diabetes      = unwrap(profile.diabetes);
  const symptoms      = (profile.symptoms  || []).map(unwrap).filter(Boolean);
  const allergies     = (profile.allergies || []).map(unwrap).filter(Boolean);
  const doctorName    = unwrap(profile.doctorName)  || unwrap(profile.labMetadata?.doctorName);
  const labName       = unwrap(profile.labName)     || unwrap(profile.labMetadata?.labName);
  const sampleType    = unwrap(profile.sampleType)  || unwrap(profile.labMetadata?.sampleType);
  const reportDate    = unwrap(profile.reportDate)  || unwrap(profile.labMetadata?.reportDate);

  /* Lab values — confirmed flat dict stored as { value, confidence: 1.0 } */
  const extractedValues  = analysis.extractedValues || {};
  const labKeys = Object.keys(extractedValues).filter((k) => {
    const v = unwrap(extractedValues[k]);
    return v && v !== 'null' && LAB_RANGES[k];
  });

  /* Conditions + medicines (stored as strings after confirmation) */
  const conditions = (analysis.detectedConditions || []).map((c) =>
    typeof c === 'string' ? c : unwrap(c)
  ).filter(Boolean);

  const medicines = (analysis.medicines || []).map((m) =>
    typeof m === 'string' ? m : unwrap(m)
  ).filter(Boolean);

  const abnormal       = analysis.abnormalFindings || [];
  const abnormalCount  = labKeys.filter((k) => {
    const v = unwrap(extractedValues[k]);
    return getLabStatus(k, v) !== 'normal' && getLabStatus(k, v) !== 'unknown';
  }).length;

  const showSummary = analysis.summary && !isHiddenSummary(analysis.summary);
  const hasPatientInfo = patientName || age || doctorName || labName || sampleType || bloodPressure;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >

      {/* ══ 1. PATIENT INFO CARD ══ */}
      {hasPatientInfo && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-accent-500/15 border border-accent-500/25 flex items-center justify-center">
              <User className="w-4 h-4 text-accent-400" />
            </div>
            <p className="font-semibold text-white text-sm">Patient Information</p>
            {record.confirmationStatus === 'confirmed' && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-success-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified by patient
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {patientName && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> Patient</p>
                <p className="text-sm font-semibold text-white mt-0.5">{patientName}</p>
              </div>
            )}
            {age && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Age</p>
                <p className="text-sm font-semibold text-white mt-0.5">{age}</p>
              </div>
            )}
            {doctorName && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Physician</p>
                <p className="text-sm font-semibold text-white mt-0.5">{doctorName}</p>
              </div>
            )}
            {labName && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> Lab / Hospital</p>
                <p className="text-sm font-semibold text-white mt-0.5 truncate">{labName}</p>
              </div>
            )}
            {sampleType && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><FlaskConical className="w-3 h-3" /> Sample</p>
                <p className="text-sm font-semibold text-white mt-0.5">{sampleType}</p>
              </div>
            )}
            {reportDate && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Report Date</p>
                <p className="text-sm font-semibold text-white mt-0.5">{reportDate}</p>
              </div>
            )}
            {bloodPressure && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Heart className="w-3 h-3" /> Blood Pressure</p>
                <p className="text-sm font-semibold text-white mt-0.5">{bloodPressure}</p>
              </div>
            )}
            {diabetes && (
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Droplets className="w-3 h-3" /> Diabetes</p>
                <p className="text-sm font-semibold text-white mt-0.5">{diabetes}</p>
              </div>
            )}
          </div>
          {(symptoms.length > 0 || allergies.length > 0) && (
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {symptoms.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Symptoms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {symptoms.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {allergies.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Allergies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allergies.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ 2. AI SUMMARY HERO CARD ══ */}
      {showSummary && (
        <div className={`rounded-2xl border p-5 ${cfg.bg} ${cfg.border}`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">AI Medical Analysis</p>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-accent-400" />
                  Gemini AI · AI-assisted extraction · Not a diagnosis
                  {record.ocrConfidence ? ` · ${record.ocrConfidence}% OCR confidence` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <SeverityBadge severity={analysis.severity} />
              {onReanalyze && (
                <button
                  id="reanalyze-btn"
                  onClick={onReanalyze}
                  disabled={reanalyzing}
                  title="Re-run AI analysis"
                  className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-primary-400 hover:border-primary-500/30 transition-all"
                >
                  {reanalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="h-0.5 rounded-full bg-white/10 mb-4 overflow-hidden">
            <div className={`h-full rounded-full ${cfg.bar} opacity-60`} style={{ width: cfg.barW }} />
          </div>

          <p className="text-slate-100 text-sm leading-relaxed">{analysis.summary}</p>

          {analysis.suggestedFollowUp && (
            <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-black/20 border border-white/10">
              <Stethoscope className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-primary-400 mb-1">Recommended Follow-Up</p>
                <p className="text-slate-300 text-xs leading-relaxed">{analysis.suggestedFollowUp}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reanalyze button (shown when there's no summary to display) */}
      {!showSummary && onReanalyze && (
        <div className="flex justify-end">
          <button
            id="reanalyze-btn"
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="btn-ghost text-xs px-3 py-2 border border-white/10"
          >
            {reanalyzing ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</> : <><RotateCcw className="w-3 h-3" /> Re-analyze</>}
          </button>
        </div>
      )}

      {/* ══ 3. LAB VALUES ══ */}
      {labKeys.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-4 h-4 text-primary-400" />
            <p className="font-semibold text-white text-sm">
              Lab Values
              <span className="ml-2 text-xs text-slate-500 font-normal">
                ({labKeys.length} extracted{abnormalCount > 0 ? ` · ${abnormalCount} abnormal` : ''})
              </span>
            </p>
          </div>
          {abnormalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                <strong>{abnormalCount}</strong> value{abnormalCount > 1 ? 's' : ''} outside normal range
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {labKeys.map((key, i) => (
              <LabMetricCard
                key={key}
                labKey={key}
                value={unwrap(extractedValues[key]) || ''}
                index={i}
              />
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-600 mt-3">
            <Info className="w-3 h-3 flex-shrink-0" />
            Patient-verified values. Corrections (if any) are shown below.
          </p>
        </div>
      )}

      {/* ══ 4. ABNORMAL FINDINGS ══ */}
      {abnormal.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-warning-400" />
            <p className="font-semibold text-white text-sm">
              Abnormal Findings
              <span className="ml-2 text-xs text-slate-500 font-normal">({abnormal.length} flagged)</span>
            </p>
          </div>
          <div className="space-y-2">
            {abnormal.map((f, i) => <AbnormalRow key={i} finding={f} />)}
          </div>
        </div>
      )}

      {/* ══ 5. CONDITIONS + MEDICINES ══ */}
      {(conditions.length > 0 || medicines.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {conditions.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-accent-400" />
                <p className="font-semibold text-white text-sm">Conditions</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {conditions.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-300 text-xs capitalize">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {medicines.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-4 h-4 text-success-400" />
                <p className="font-semibold text-white text-sm">Medicines</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {medicines.map((m, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-success-500/10 border border-success-500/20 text-success-300 text-xs font-medium">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ 6. PATIENT CORRECTIONS NOTICE ══ */}
      {hasCorrections && (
        <div className="glass-card p-4 border border-accent-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="w-3.5 h-3.5 text-accent-400" />
            <p className="text-xs font-semibold text-accent-400">
              {record.userCorrections.length} field{record.userCorrections.length > 1 ? 's' : ''} corrected by patient
            </p>
          </div>
          <div className="space-y-1.5">
            {record.userCorrections.slice(0, 4).map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-slate-500 capitalize min-w-[90px] flex-shrink-0 pt-0.5">
                  {c.field.replace(/([A-Z])/g, ' $1').replace('lab.', '').trim()}:
                </span>
                <span className="text-slate-600 line-through">{c.aiValue || '(empty)'}</span>
                <span className="text-white">→ {c.userValue}</span>
              </div>
            ))}
            {record.userCorrections.length > 4 && (
              <p className="text-xs text-slate-600">+{record.userCorrections.length - 4} more</p>
            )}
          </div>
        </div>
      )}

      {/* ══ 7. DOCTOR SUMMARY ══ */}
      {(doctorSum || record?.doctorSummary) && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" />
            AI Consultation Summary
          </p>
          <DoctorSummaryCard
            summary={doctorSum || record.doctorSummary}
            recordId={record._id}
            onRefresh={setDoctorSum}
          />
        </div>
      )}

      {/* ══ 8. EXTRACTED TEXT (collapsed accordion) ══ */}
      <TextAccordion text={record?.extractedText} />

    </motion.div>
  );
}
