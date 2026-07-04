/**
 * pages/doctor/PatientView360Page.jsx
 *
 * Doctor 360 Patient View — AI Command Center
 *
 * Sections:
 *  1. AI Patient Snapshot (hero — risk, why here, conditions, symptoms)
 *  2. AI Patient History Summary (narrative)
 *  3. Consultation Prep Panel (focus areas, what changed)
 *  4. Patient Info Card
 *  5. Health Overview (conditions, allergies, medicines)
 *  6. Uploaded Reports + Document Viewer (PDF/image inline)
 *  7. Health Timeline (chronological)
 *  8. Health Trends (biomarker charts)
 *  9. Shared Records
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Brain, AlertTriangle, Activity, User, Phone, Mail,
  Droplets, Heart, Pill, FileText, Calendar, Clock, ChevronDown,
  ChevronUp, CheckCircle, XCircle, Stethoscope, TrendingUp,
  TrendingDown, Minus, Eye, X, Download, FileImage, File,
  AlertCircle, Target, Zap, Shield, Info, MapPin, Video, Paperclip,
  BarChart2, RefreshCw,
} from 'lucide-react';
import { format, isValid, formatDistanceToNow } from 'date-fns';
import { doctorsApi } from '@api/doctors.api';
import { CardSkeleton } from '@components/ui/LoadingSkeleton';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────
   Constants & Helpers
───────────────────────────────────── */

const RISK_CONFIG = {
  CRITICAL: { label: 'Critical Risk', color: 'text-red-400',     bg: 'bg-red-500/20',     border: 'border-red-500/40',     glow: 'shadow-red-500/20',   dot: 'bg-red-500'    },
  HIGH:     { label: 'High Risk',     color: 'text-danger-400',  bg: 'bg-danger-500/20',  border: 'border-danger-500/40',  glow: 'shadow-danger-500/20',dot: 'bg-danger-500' },
  MEDIUM:   { label: 'Medium Risk',   color: 'text-amber-400',   bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   glow: 'shadow-amber-500/20', dot: 'bg-amber-500'  },
  LOW:      { label: 'Low Risk',      color: 'text-success-400', bg: 'bg-success-500/20', border: 'border-success-500/40', glow: 'shadow-success-500/20',dot: 'bg-success-500'},
  UNKNOWN:  { label: 'Risk Unknown',  color: 'text-slate-400',   bg: 'bg-white/10',       border: 'border-white/20',       glow: '',                    dot: 'bg-slate-500'  },
};

const SEVERITY_COLOR = {
  critical: 'text-red-400 bg-red-500/15 border-red-500/30',
  high:     'text-danger-400 bg-danger-500/15 border-danger-500/30',
  moderate: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  low:      'text-success-400 bg-success-500/15 border-success-500/30',
  normal:   'text-success-400 bg-success-500/10 border-success-500/20',
};

const STATUS_CONFIG = {
  confirmed:  { color: 'text-primary-400',  bg: 'bg-primary-500/15',  label: 'Confirmed'  },
  pending:    { color: 'text-amber-400',    bg: 'bg-amber-500/15',    label: 'Pending'    },
  completed:  { color: 'text-success-400',  bg: 'bg-success-500/15',  label: 'Completed'  },
  cancelled:  { color: 'text-slate-400',    bg: 'bg-white/5',         label: 'Cancelled'  },
  'no-show':  { color: 'text-danger-400',   bg: 'bg-danger-500/15',   label: 'No Show'    },
};

const TYPE_ICON = { video: Video, phone: Phone, 'in-person': MapPin };

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isValid(dt) ? format(dt, 'MMM d, yyyy') : '—';
};

const fmtAgo = (d) => {
  if (!d) return '';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }); } catch { return ''; }
};

const BIOMARKER_META = {
  hemoglobin:    { label: 'Hemoglobin',    unit: 'g/dL',  normal: '12–17',  color: '#ef4444' },
  bloodSugar:    { label: 'Blood Sugar',   unit: 'mg/dL', normal: '70–100', color: '#f59e0b' },
  hba1c:         { label: 'HbA1c',         unit: '%',     normal: '<5.7',   color: '#8b5cf6' },
  cholesterol:   { label: 'Cholesterol',   unit: 'mg/dL', normal: '<200',   color: '#06b6d4' },
  bloodPressure: { label: 'Blood Pressure',unit: 'mmHg',  normal: '<120',   color: '#f97316' },
  creatinine:    { label: 'Creatinine',    unit: 'mg/dL', normal: '0.6–1.2',color: '#10b981' },
  vitaminD:      { label: 'Vitamin D',     unit: 'ng/mL', normal: '30–100', color: '#eab308' },
  uricAcid:      { label: 'Uric Acid',     unit: 'mg/dL', normal: '2.4–6.1',color: '#a78bfa' },
  tsh:           { label: 'TSH',           unit: 'mIU/L', normal: '0.4–4.0',color: '#34d399' },
};

/* Simple inline line chart using SVG */
function MiniLineChart({ data, color = '#06b6d4', unit = '' }) {
  if (!data || data.length < 2) return null;

  const W = 240, H = 80;
  const PAD = 12;

  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + ((1 - (d.value - minV) / range) * (H - PAD * 2));
    return { x, y, value: d.value, label: d.label };
  });

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const trend = last.value > prev.value ? 'up' : last.value < prev.value ? 'down' : 'flat';

  return (
    <div className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity={i === pts.length - 1 ? 1 : 0.5} />
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-slate-500">{data[0]?.label ?? ''}</span>
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-danger-400" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-success-400" />}
          {trend === 'flat' && <Minus className="w-3 h-3 text-slate-400" />}
          <span className="text-xs font-semibold" style={{ color }}>{data[data.length - 1]?.value} {unit}</span>
        </div>
      </div>
    </div>
  );
}

/* Inline document viewer modal */
function DocumentViewerModal({ doc, onClose }) {
  const url  = doc?.fileUrl || doc?.files?.[0]?.url;
  const mime = doc?.mimeType || doc?.files?.[0]?.mimeType || '';
  const name = doc?.title || doc?.originalName || 'Document';

  /* Detect file type from mime or URL extension */
  const ext  = (url ?? '').split('?')[0].split('.').pop().toLowerCase();
  const isPdf = mime.includes('pdf') || ext === 'pdf';
  const isImg = mime.startsWith('image') || ['jpg','jpeg','png','webp','gif','bmp','svg'].includes(ext);

  /**
   * For PDFs: use Google Docs Viewer as proxy.
   * This bypasses Cloudinary's X-Frame-Options / Content-Disposition headers
   * that prevent direct iframe embedding.
   */
  const pdfViewerUrl = url
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : null;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.93, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.93, opacity: 0 }}
          className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              {isPdf ? <FileText className="w-5 h-5 text-primary-400" /> : <FileImage className="w-5 h-5 text-violet-400" />}
              <div>
                <p className="text-white font-semibold text-sm">{name}</p>
                <p className="text-slate-500 text-xs">{fmtDate(doc?.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-400 text-xs hover:bg-primary-500/25 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Open Original
                </a>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-dark-900/50 min-h-0">
            {!url ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
                <File className="w-10 h-10" />
                <p>No file available for preview</p>
              </div>
            ) : isPdf ? (
              /* Google Docs Viewer — bypasses Cloudinary iframe restrictions */
              <div className="flex flex-col min-h-[70vh]">
                <iframe
                  key={pdfViewerUrl}
                  src={pdfViewerUrl}
                  className="w-full flex-1 min-h-[70vh]"
                  title={name}
                  style={{ border: 'none' }}
                  allow="autoplay"
                />
                <p className="text-xs text-slate-600 text-center py-2">
                  Powered by Google Docs Viewer ·{' '}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                    Open direct link
                  </a>
                </p>
              </div>
            ) : isImg ? (
              <div className="flex items-center justify-center p-4 min-h-[60vh]">
                <img src={url} alt={name} className="max-w-full max-h-[75vh] object-contain rounded-xl" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <File className="w-10 h-10 text-slate-500" />
                <p className="text-slate-400 text-sm">Preview not available for this file type</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm px-4 py-2"
                >
                  Open File
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* Chip component */
function Chip({ children, color = 'slate' }) {
  const cls = {
    slate:   'bg-white/5 border-white/10 text-slate-400',
    primary: 'bg-primary-500/15 border-primary-500/30 text-primary-300',
    danger:  'bg-danger-500/15 border-danger-500/30 text-danger-400',
    amber:   'bg-amber-500/15 border-amber-500/30 text-amber-400',
    violet:  'bg-violet-500/15 border-violet-500/30 text-violet-300',
    success: 'bg-success-500/15 border-success-500/30 text-success-400',
  }[color] || 'bg-white/5 border-white/10 text-slate-400';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

/* Section card wrapper */
function Section({ title, icon: Icon, iconColor = 'text-primary-400', children, accent, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-5 ${className}`}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`p-1.5 rounded-lg ${accent || 'bg-primary-500/15'}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h3 className="font-semibold text-white text-sm tracking-wide uppercase">{title}</h3>
      </div>
      {children}
    </motion.section>
  );
}

/* ─────────────────────────────────────
   AI Patient Snapshot — Hero Section
───────────────────────────────────── */
function AISnapshotHero({ data }) {
  const { patient, focusAppointment, historySummary } = data;
  const brief   = focusAppointment?.aiConsultationBrief;
  const risk    = brief?.urgencyLevel || historySummary?.latestRisk || 'UNKNOWN';
  const riskCfg = RISK_CONFIG[risk] || RISK_CONFIG.UNKNOWN;
  const symptoms = brief?.symptoms || focusAppointment?.symptoms || [];
  const conditions = [
    ...(patient?.chronicConditions ?? []),
    ...(brief?.conditions ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border ${riskCfg.border} p-6 shadow-2xl ${riskCfg.glow}`}
      style={{
        background: risk === 'CRITICAL' || risk === 'HIGH'
          ? 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,15,15,0.95) 100%)'
          : 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(15,25,40,0.95) 100%)',
      }}
    >
      {/* Glow background */}
      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-3xl"
        style={{ background: risk === 'CRITICAL' ? '#ef4444' : risk === 'HIGH' ? '#f56565' : risk === 'MEDIUM' ? '#f59e0b' : '#06b6d4' }}
      />

      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white font-bold text-2xl shadow-xl flex-shrink-0">
                {patient?.name?.[0]?.toUpperCase() ?? 'P'}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-dark-900 ${riskCfg.dot} animate-pulse`} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white leading-tight">{patient?.name ?? 'Patient'}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {patient?.age && (
                  <span className="text-slate-400 text-sm">{patient.age} yrs</span>
                )}
                {patient?.gender && (
                  <span className="text-slate-500 text-xs capitalize">{patient.gender}</span>
                )}
                {patient?.bloodGroup && (
                  <span className="flex items-center gap-1 text-xs text-danger-400">
                    <Droplets className="w-3 h-3" />{patient.bloodGroup}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Risk Badge */}
          <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border ${riskCfg.bg} ${riskCfg.border} flex-shrink-0`}>
            <div className="flex items-center gap-1.5">
              {(risk === 'HIGH' || risk === 'CRITICAL') && <AlertTriangle className={`w-4 h-4 ${riskCfg.color}`} />}
              {(risk === 'MEDIUM') && <Activity className={`w-4 h-4 ${riskCfg.color}`} />}
              {(risk === 'LOW') && <Shield className={`w-4 h-4 ${riskCfg.color}`} />}
              <span className={`text-xs font-bold uppercase tracking-wider ${riskCfg.color}`}>AI Risk</span>
            </div>
            <span className={`text-xl font-display font-black ${riskCfg.color}`}>{risk}</span>
          </div>
        </div>

        {/* Why here today */}
        {focusAppointment?.reason && (
          <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/8">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
              <Target className="w-3 h-3" /> WHY HERE TODAY
            </p>
            <p className="text-white text-sm leading-relaxed">{focusAppointment.reason}</p>
          </div>
        )}

        {/* Three columns: conditions, symptoms, AI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Conditions */}
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <Heart className="w-3 h-3" /> Conditions
            </p>
            {conditions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((c) => <Chip key={c} color="danger">{c}</Chip>)}
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">None recorded</p>
            )}
          </div>

          {/* Symptoms */}
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <Activity className="w-3 h-3" /> Current Symptoms
            </p>
            {symptoms.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {symptoms.slice(0, 6).map((s) => <Chip key={s} color="amber">{s}</Chip>)}
                {symptoms.length > 6 && <Chip color="slate">+{symptoms.length - 6} more</Chip>}
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">None reported</p>
            )}
          </div>

          {/* Allergies */}
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <AlertCircle className="w-3 h-3" /> Allergies
            </p>
            {(patient?.allergies ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.slice(0, 5).map((a) => <Chip key={a} color="violet">{a}</Chip>)}
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">None recorded</p>
            )}
          </div>
        </div>

        {/* AI Brief summary */}
        {brief?.summaryText && (
          <div className="mt-4 p-4 rounded-xl bg-primary-500/8 border border-primary-500/20">
            <p className="text-xs text-primary-400 mb-2 flex items-center gap-1.5 font-semibold">
              <Brain className="w-3.5 h-3.5" /> AI PRE-CONSULTATION BRIEF
            </p>
            <p className="text-sm text-slate-200 leading-relaxed">{brief.summaryText}</p>
          </div>
        )}

        {/* Appointment meta */}
        {focusAppointment && (
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              {fmtDate(focusAppointment.date)} at {focusAppointment.time}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500 capitalize">
              {React.createElement(TYPE_ICON[focusAppointment.type] || MapPin, { className: 'w-3.5 h-3.5' })}
              {focusAppointment.type}
            </span>
            {(() => { const s = STATUS_CONFIG[focusAppointment.status]; return s ? (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>{s.label}</span>
            ) : null; })()}
            {focusAppointment.uploadedReportIds?.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Paperclip className="w-3 h-3" />
                {focusAppointment.uploadedReportIds.length} report{focusAppointment.uploadedReportIds.length > 1 ? 's' : ''} uploaded
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────
   AI History Summary Card
───────────────────────────────────── */
function AIHistorySummary({ historySummary, patientName }) {
  const {
    totalReports, monthsSpan, recurringConditions, recurringSymptoms,
    recurringAbnormal, latestRisk, totalAppointments,
  } = historySummary;

  if (totalReports === 0 && totalAppointments === 0) return null;

  const riskCfg = RISK_CONFIG[latestRisk] || RISK_CONFIG.UNKNOWN;

  return (
    <Section title="AI Patient History Summary" icon={Brain} iconColor="text-violet-400" accent="bg-violet-500/15">
      <div className="space-y-4">
        {/* Narrative */}
        <div className="p-4 rounded-xl bg-violet-500/8 border border-violet-500/15">
          <p className="text-slate-200 text-sm leading-relaxed">
            <span className="text-white font-semibold">{patientName}</span> has uploaded{' '}
            <span className="text-primary-300 font-semibold">{totalReports} report{totalReports !== 1 ? 's' : ''}</span>
            {monthsSpan > 0 && <> over the last <span className="text-primary-300 font-semibold">{monthsSpan} month{monthsSpan !== 1 ? 's' : ''}</span></>}
            {totalAppointments > 0 && <> and has had <span className="text-primary-300 font-semibold">{totalAppointments} consultation{totalAppointments !== 1 ? 's' : ''}</span> with you</>}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {recurringConditions.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 uppercase tracking-wide">
                <RefreshCw className="w-3 h-3" /> Repeated Findings
              </p>
              <div className="flex flex-col gap-1">
                {recurringConditions.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-danger-500 flex-shrink-0" />
                    <span className="text-xs text-slate-300">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recurringSymptoms.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 uppercase tracking-wide">
                <Activity className="w-3 h-3" /> Previous Complaints
              </p>
              <div className="flex flex-col gap-1">
                {recurringSymptoms.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="text-xs text-slate-300">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recurringAbnormal.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 uppercase tracking-wide">
                <AlertTriangle className="w-3 h-3" /> Recurring Abnormals
              </p>
              <div className="flex flex-col gap-1">
                {recurringAbnormal.map((a) => (
                  <div key={a} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                    <span className="text-xs text-slate-300">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500">Most Recent AI Risk:</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${riskCfg.bg} ${riskCfg.border} ${riskCfg.color}`}>
            {latestRisk}
          </span>
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────
   Consultation Prep Panel
───────────────────────────────────── */
function ConsultationPrepPanel({ consultationPrep }) {
  const { suggestedFocusAreas, newSymptoms, resolvedSymptoms, abnormalFindings } = consultationPrep;
  const hasContent = suggestedFocusAreas.length || newSymptoms.length || resolvedSymptoms.length || abnormalFindings.length;
  if (!hasContent) return null;

  return (
    <Section title="Consultation Prep" icon={Target} iconColor="text-amber-400" accent="bg-amber-500/15">
      <div className="space-y-4">
        {/* Suggested focus areas */}
        {suggestedFocusAreas.length > 0 && (
          <div>
            <p className="text-xs text-amber-400/80 mb-2 font-semibold uppercase tracking-wide">Suggested Focus Areas</p>
            <div className="space-y-2">
              {suggestedFocusAreas.map((area, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
                  <Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-200 leading-relaxed">{area}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What changed since last visit */}
        {(newSymptoms.length > 0 || resolvedSymptoms.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {newSymptoms.length > 0 && (
              <div className="p-3 rounded-xl bg-danger-500/8 border border-danger-500/20">
                <p className="text-xs text-danger-400 mb-2 font-semibold">New Since Last Visit</p>
                <div className="flex flex-wrap gap-1.5">
                  {newSymptoms.map((s) => <Chip key={s} color="danger">{s}</Chip>)}
                </div>
              </div>
            )}
            {resolvedSymptoms.length > 0 && (
              <div className="p-3 rounded-xl bg-success-500/8 border border-success-500/20">
                <p className="text-xs text-success-400 mb-2 font-semibold">Resolved Since Last Visit</p>
                <div className="flex flex-wrap gap-1.5">
                  {resolvedSymptoms.map((s) => <Chip key={s} color="success">{s}</Chip>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Abnormal findings */}
        {abnormalFindings.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Recent Abnormal Findings</p>
            <div className="space-y-1.5">
              {abnormalFindings.map((f, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${SEVERITY_COLOR[f.severity] || SEVERITY_COLOR.moderate}`}>
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span className="font-medium">{f.parameter}</span>
                  {f.value && <span className="opacity-80">{f.value}</span>}
                  {f.normalRange && <span className="opacity-60">(Normal: {f.normalRange})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────
   Uploaded Reports + Document Viewer
───────────────────────────────────── */
function UploadedReportsSection({ reports }) {
  const [viewingDoc, setViewingDoc] = useState(null);

  if (!reports || reports.length === 0) return null;

  return (
    <>
      <Section title="Uploaded Reports" icon={Paperclip} iconColor="text-primary-400" accent="bg-primary-500/15">
        <div className="space-y-2">
          {reports.map((report) => {
            const url = report?.fileUrl || report?.files?.[0]?.url;
            const mime = report?.files?.[0]?.mimeType || '';
            const isPdf = mime.includes('pdf') || url?.toLowerCase().includes('.pdf');
            const isImg = mime.startsWith('image') || /\.(jpe?g|png|webp)$/i.test(url ?? '');
            const sevColor = SEVERITY_COLOR[report?.analysis?.severity] || '';

            return (
              <motion.div
                key={report._id}
                whileHover={{ scale: 1.005 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.02] hover:border-primary-500/30 hover:bg-white/[0.04] transition-all cursor-pointer"
                onClick={() => url && setViewingDoc(report)}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPdf ? 'bg-primary-500/15' : 'bg-violet-500/15'}`}>
                  {isPdf ? <FileText className="w-4.5 h-4.5 text-primary-400" /> : isImg ? <FileImage className="w-4.5 h-4.5 text-violet-400" /> : <File className="w-4.5 h-4.5 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{report.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500 capitalize">{report.type?.replace(/_/g, ' ')}</span>
                    {report.date && <span className="text-xs text-slate-600">{fmtDate(report.date)}</span>}
                    {report.analysis?.severity && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${sevColor}`}>
                        {report.analysis.severity}
                      </span>
                    )}
                  </div>
                </div>
                {url ? (
                  <div className="flex items-center gap-1.5 text-xs text-primary-400 flex-shrink-0">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">View</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-600 flex-shrink-0">No file</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </Section>

      {viewingDoc && <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </>
  );
}

/* ─────────────────────────────────────
   Health Timeline
───────────────────────────────────── */
function HealthTimeline({ timeline }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? timeline : timeline.slice(0, 8);

  if (!timeline || timeline.length === 0) return null;

  return (
    <Section title="Patient Health Timeline" icon={Calendar} iconColor="text-primary-400" accent="bg-primary-500/15">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/8" />

        <div className="space-y-4">
          {displayed.map((item, idx) => {
            const isAppt   = item.type === 'appointment';
            const riskCfg  = item.urgency ? RISK_CONFIG[item.urgency] : null;
            const sevCls   = item.severity ? SEVERITY_COLOR[item.severity] : '';

            return (
              <motion.div
                key={`${item._id}-${idx}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-start gap-4 pl-2"
              >
                {/* Dot */}
                <div className={`relative z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isAppt
                    ? riskCfg
                      ? `${riskCfg.bg} ${riskCfg.border}`
                      : 'bg-primary-500/20 border-primary-500/50'
                    : item.severity && item.severity !== 'normal'
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-white/10 border-white/25'
                }`}>
                  {isAppt
                    ? <Stethoscope className="w-2.5 h-2.5 text-primary-400" />
                    : <FileText className="w-2.5 h-2.5 text-slate-400" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white leading-tight">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{item.subtitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 flex-shrink-0 whitespace-nowrap">{fmtDate(item.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {item.status && (() => { const s = STATUS_CONFIG[item.status]; return s ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${s.bg} ${s.color}`}>{s.label}</span>
                    ) : null; })()}
                    {riskCfg && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${riskCfg.bg} ${riskCfg.border} ${riskCfg.color}`}>
                        {riskCfg.label}
                      </span>
                    )}
                    {item.hasBrief && <span className="text-xs text-primary-400 flex items-center gap-1"><Brain className="w-2.5 h-2.5" />AI Brief</span>}
                    {item.reportCount > 0 && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Paperclip className="w-2.5 h-2.5" />{item.reportCount} report{item.reportCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {item.severity && item.severity !== 'normal' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${sevCls}`}>{item.severity}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {timeline.length > 8 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-4 ml-9 flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAll ? 'Show less' : `Show ${timeline.length - 8} more events`}
          </button>
        )}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────
   Health Trends (Biomarker Charts)
───────────────────────────────────── */
function HealthTrends({ trends }) {
  const keys = Object.keys(trends).filter((k) => trends[k]?.length >= 2);
  if (keys.length === 0) return null;

  return (
    <Section title="Health Trends" icon={BarChart2} iconColor="text-success-400" accent="bg-success-500/15">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {keys.map((key) => {
          const meta = BIOMARKER_META[key] || { label: key, unit: '', normal: '', color: '#06b6d4' };
          const data = trends[key];
          const latest = data[data.length - 1];
          const prev   = data[data.length - 2];
          const delta  = prev ? (latest.value - prev.value) : 0;

          return (
            <div key={key} className="p-4 rounded-xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-all">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-white">{meta.label}</p>
                <div className="flex items-center gap-1">
                  {delta > 0 && <TrendingUp className="w-3 h-3 text-danger-400" />}
                  {delta < 0 && <TrendingDown className="w-3 h-3 text-success-400" />}
                  {delta === 0 && <Minus className="w-3 h-3 text-slate-400" />}
                  <span className="text-xs text-slate-500">{meta.unit}</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-3">Normal: {meta.normal}</p>
              <MiniLineChart data={data} color={meta.color} unit={meta.unit} />
              <p className="text-xs text-slate-500 mt-2 text-center">{data.length} readings</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────
   Shared Health Records
───────────────────────────────────── */
function SharedRecords({ records }) {
  const [viewingDoc, setViewingDoc] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  if (!records || records.length === 0) return null;

  return (
    <>
      <Section title="Shared Health Records" icon={FileText} iconColor="text-violet-400" accent="bg-violet-500/15">
        <div className="space-y-3">
          {records.map((rec) => {
            const url      = rec.fileUrl || rec.files?.[0]?.url;
            const sev      = rec.analysis?.severity;
            const sevCls   = SEVERITY_COLOR[sev] || '';
            const isExpanded = expandedId === rec._id;
            const summary  = rec.doctorSummary || rec.analysis?.summary;

            return (
              <div key={rec._id} className="rounded-xl border border-white/8 overflow-hidden">
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer hover:bg-white/[0.03] transition-all"
                  onClick={() => setExpandedId(isExpanded ? null : rec._id)}
                >
                  <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{rec.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500 capitalize">{rec.type?.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-600">{fmtDate(rec.date)}</span>
                      {sev && <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${sevCls}`}>{sev}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {url && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewingDoc(rec); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-400 text-xs hover:bg-primary-500/25 transition-all"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/8"
                    >
                      <div className="p-4 space-y-3">
                        {rec.doctorSummary && (
                          <div className="p-3 rounded-xl bg-primary-500/8 border border-primary-500/15">
                            <p className="text-xs text-primary-400 mb-2 font-semibold uppercase tracking-wide flex items-center gap-1">
                              <Brain className="w-3 h-3" /> Doctor AI Summary
                            </p>
                            {rec.doctorSummary.clinicalNotes && (
                              <p className="text-xs text-slate-200 leading-relaxed">{rec.doctorSummary.clinicalNotes}</p>
                            )}
                            {rec.doctorSummary.symptoms?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {rec.doctorSummary.symptoms.map((s) => <Chip key={s} color="amber">{s}</Chip>)}
                              </div>
                            )}
                            {rec.doctorSummary.riskLevel && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-slate-500">Risk:</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${RISK_CONFIG[rec.doctorSummary.riskLevel.toUpperCase()]?.bg || ''} ${RISK_CONFIG[rec.doctorSummary.riskLevel.toUpperCase()]?.border || ''} ${RISK_CONFIG[rec.doctorSummary.riskLevel.toUpperCase()]?.color || ''}`}>
                                  {rec.doctorSummary.riskLevel}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {rec.analysis?.abnormalFindings?.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1.5 font-semibold uppercase">Abnormal Findings</p>
                            <div className="space-y-1">
                              {rec.analysis.abnormalFindings.slice(0, 5).map((f, i) => (
                                <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border ${SEVERITY_COLOR[f.severity] || SEVERITY_COLOR.moderate}`}>
                                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                  <span className="font-medium">{f.parameter}</span>
                                  {f.value && <span>{f.value}</span>}
                                  {f.normalRange && <span className="opacity-60">(Normal: {f.normalRange})</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {rec.notes && (
                          <div className="p-2.5 rounded-lg bg-white/5 border border-white/8">
                            <p className="text-xs text-slate-500 mb-1">Doctor Notes</p>
                            <p className="text-xs text-slate-300">{rec.notes}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Section>

      {viewingDoc && <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </>
  );
}

/* ─────────────────────────────────────
   Patient Info Card
───────────────────────────────────── */
function PatientInfoCard({ patient }) {
  return (
    <Section title="Patient Information" icon={User} iconColor="text-primary-400" accent="bg-primary-500/15">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Full Name', value: patient?.name, icon: User },
          { label: 'Email', value: patient?.email, icon: Mail },
          { label: 'Phone', value: patient?.phone, icon: Phone },
          { label: 'Blood Group', value: patient?.bloodGroup, icon: Droplets, color: 'text-danger-400' },
          { label: 'Date of Birth', value: patient?.dateOfBirth ? fmtDate(patient.dateOfBirth) : null, icon: Calendar },
          { label: 'Gender', value: patient?.gender, icon: User },
          { label: 'Address', value: patient?.address, icon: MapPin },
          { label: 'Member Since', value: patient?.createdAt ? fmtDate(patient.createdAt) : null, icon: Calendar },
        ].filter((f) => f.value).map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-start gap-2.5">
            <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color || 'text-slate-500'}`} />
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm text-white capitalize">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Emergency contact */}
      {patient?.emergencyContact?.name && (
        <div className="mt-4 p-3 rounded-xl bg-danger-500/8 border border-danger-500/20">
          <p className="text-xs text-danger-400 mb-2 font-semibold uppercase tracking-wide">Emergency Contact</p>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <span>{patient.emergencyContact.name}</span>
            {patient.emergencyContact.relationship && (
              <span className="text-slate-500">({patient.emergencyContact.relationship})</span>
            )}
            {patient.emergencyContact.phone && (
              <span className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" />{patient.emergencyContact.phone}</span>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─────────────────────────────────────
   Health Overview: conditions, allergies, medicines
───────────────────────────────────── */
function HealthOverview({ patient, medicines }) {
  const conditions = patient?.chronicConditions ?? [];
  const allergies  = patient?.allergies ?? [];

  return (
    <Section title="Health Overview" icon={Heart} iconColor="text-danger-400" accent="bg-danger-500/15">
      <div className="space-y-4">
        {conditions.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <Heart className="w-3 h-3" /> Chronic Conditions
            </p>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => <Chip key={c} color="danger">{c}</Chip>)}
            </div>
          </div>
        )}

        {allergies.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <AlertCircle className="w-3 h-3" /> Allergies
            </p>
            <div className="flex flex-wrap gap-2">
              {allergies.map((a) => <Chip key={a} color="violet">{a}</Chip>)}
            </div>
          </div>
        )}

        {medicines.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <Pill className="w-3 h-3" /> Current Medicines (from records)
            </p>
            <div className="flex flex-wrap gap-2">
              {medicines.map((m) => <Chip key={m} color="primary">{m}</Chip>)}
            </div>
          </div>
        )}

        {conditions.length === 0 && allergies.length === 0 && medicines.length === 0 && (
          <p className="text-sm text-slate-500 italic">No health overview data available</p>
        )}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────
   Previous Appointments Summary
───────────────────────────────────── */
function PreviousAppointments({ appointments, focusId }) {
  const prev = appointments.filter((a) => a._id?.toString() !== focusId).slice(0, 5);
  if (!prev.length) return null;

  return (
    <Section title="Previous Appointments" icon={Stethoscope} iconColor="text-slate-400" accent="bg-white/10">
      <div className="space-y-2">
        {prev.map((appt) => {
          const brief  = appt.aiConsultationBrief;
          const riskCfg= brief?.urgencyLevel ? RISK_CONFIG[brief.urgencyLevel] : null;
          const s      = STATUS_CONFIG[appt.status];
          const TypeIcon = TYPE_ICON[appt.type] || MapPin;

          return (
            <div key={appt._id} className="flex items-start gap-3 p-3 rounded-xl border border-white/8 hover:border-white/15 bg-white/[0.02] transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <TypeIcon className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{fmtDate(appt.date)} at {appt.time}</p>
                  {s && <span className={`text-xs px-1.5 py-0.5 rounded ${s.bg} ${s.color} flex-shrink-0`}>{s.label}</span>}
                </div>
                {appt.reason && <p className="text-xs text-slate-500 mt-0.5 truncate">{appt.reason}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {riskCfg && (
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${riskCfg.bg} ${riskCfg.border} ${riskCfg.color}`}>
                      {riskCfg.label}
                    </span>
                  )}
                  {brief?.summaryText && (
                    <span className="text-xs text-primary-400 flex items-center gap-1"><Brain className="w-2.5 h-2.5" />Has AI Brief</span>
                  )}
                  {appt.notes?.doctor && (
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Info className="w-2.5 h-2.5" />Has doctor notes</span>
                  )}
                </div>
                {appt.prescription && (
                  <p className="text-xs text-slate-600 mt-1 italic truncate">Rx: {appt.prescription}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────
   Loading Skeleton
───────────────────────────────────── */
function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-60 rounded-2xl bg-white/5" />
      <div className="h-40 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-48 rounded-2xl bg-white/5" />
        <div className="h-48 rounded-2xl bg-white/5" />
      </div>
      <div className="h-64 rounded-2xl bg-white/5" />
    </div>
  );
}

/* ─────────────────────────────────────
   Main Page
───────────────────────────────────── */
function PatientView360Page() {
  const { patientId }      = useParams();
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();
  const apptId             = searchParams.get('apptId');

  const [data, setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    doctorsApi.getPatient360(patientId, apptId)
      .then(({ data: res }) => setData(res.data))
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to load patient data';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [patientId, apptId]);

  useEffect(() => { load(); }, [load]);

  /* Uploaded reports from the focus appointment */
  const uploadedReports = data?.focusAppointment?.uploadedReportIds ?? [];

  return (
    <div className="space-y-5 pb-12">
      {/* Header bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
          <Brain className="w-4 h-4 text-primary-400" />
          <span className="text-xs text-primary-400 font-semibold">Doctor 360 — AI Command Center</span>
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <PageSkeleton />
      ) : error ? (
        <div className="glass-card p-12 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-12 h-12 text-danger-400" />
          <div>
            <p className="text-white font-semibold mb-1">Unable to load patient data</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
          <button onClick={load} className="btn-primary text-sm px-6 py-2.5">
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* 1. Hero — AI Snapshot */}
          <AISnapshotHero data={data} />

          {/* 2. AI History Summary */}
          <AIHistorySummary historySummary={data.historySummary} patientName={data.patient?.name} />

          {/* 3. Consultation Prep Panel */}
          <ConsultationPrepPanel consultationPrep={data.consultationPrep} />

          {/* 4. Uploaded Reports from this appointment */}
          {uploadedReports.length > 0 && (
            <UploadedReportsSection reports={uploadedReports} />
          )}

          {/* 5. Two-column: Patient Info + Health Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PatientInfoCard patient={data.patient} />
            <HealthOverview patient={data.patient} medicines={data.medicines ?? []} />
          </div>

          {/* 6. Health Trends */}
          <HealthTrends trends={data.trends ?? {}} />

          {/* 7. Health Timeline */}
          <HealthTimeline timeline={data.timeline ?? []} />

          {/* 8. Shared Records */}
          <SharedRecords records={data.sharedRecords ?? []} />

          {/* 9. Previous appointments */}
          <PreviousAppointments appointments={data.appointments ?? []} focusId={apptId} />
        </div>
      ) : null}
    </div>
  );
}

export default PatientView360Page;
