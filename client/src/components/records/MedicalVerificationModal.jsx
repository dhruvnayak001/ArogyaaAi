/**
 * components/records/MedicalVerificationModal.jsx
 *
 * Premium fullscreen AI Medical Verification Modal — v2
 *
 * Changes from v1:
 *  - Reads merged normalized data from extractionStore (AI + regex fallback)
 *  - ALL fields pre-filled; never empty when document has data
 *  - AI error messages NEVER shown to users
 *  - Abnormal findings enriched with regex-inferred ones when AI fails
 *  - Shows "Extracted from document" badge on regex-filled fields
 *
 * Sections:
 *  1. Header (sticky) — file info, confidence, actions
 *  2. Warning banner — low confidence / regex-only mode
 *  3. Record metadata — title, type, date
 *  4. Patient Information — pre-filled editable grid
 *  5. Lab Values — color-coded cards (LOW/NORMAL/HIGH)
 *  6. Abnormal Findings — highlighted warning cards
 *  7. Symptoms, Conditions, Medicines — pre-filled chip sets
 *  8. AI Summary — Gemini summary (hidden if error/null)
 *  9. Raw Extracted Text — collapsed accordion
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, AlertTriangle, Brain, Sparkles,
  Loader2, RotateCcw, User, Stethoscope, FlaskConical, Activity,
  Pill, FileText, Edit3, Syringe, Building2, Calendar, Droplets,
  ChevronRight, Plus, Info, TrendingUp, TrendingDown, Minus, Heart,
  BadgeCheck, ScanLine,
} from 'lucide-react';
import {
  useExtractionStore,
  extractValue, extractConfidence,
  CONFIDENCE_THRESHOLDS,
} from '@store/extractionStore';
import EditableMedicalField   from './EditableMedicalField';
import LabValueCard, { LAB_META, getLabStatus } from './LabValueCard';
import ExtractedTextAccordion  from './ExtractedTextAccordion';

/* ── Is this an error/placeholder summary we should hide? ── */
const isHiddenSummary = (s) =>
  !s ||
  s.includes('encountered an error') ||
  s.includes('Insufficient text') ||
  s.includes('review the document manually') ||
  s.trim().length < 15;

/* ════════════════════════════════════════
   Chip Tag Input
   ════════════════════════════════════════ */
function ChipSet({ fieldName, label, icon: Icon, placeholder, chipColor = 'primary', onBlank }) {
  const { editableForm, updateArrayField } = useExtractionStore();
  const chips = editableForm?.[fieldName] || [];
  const [input, setInput] = useState('');

  const chipStyles = {
    primary: 'bg-primary-500/15 border-primary-500/30 text-primary-300',
    warning: 'bg-amber-500/15  border-amber-500/30  text-amber-300',
    success: 'bg-success-500/15 border-success-500/30 text-success-300',
    accent:  'bg-accent-500/15  border-accent-500/30  text-accent-300',
  };
  const cls = chipStyles[chipColor] || chipStyles.primary;

  const add = useCallback(() => {
    const v = input.trim();
    if (!v || chips.includes(v)) { setInput(''); return; }
    updateArrayField(fieldName, [...chips, v]);
    setInput('');
  }, [input, chips, fieldName, updateArrayField]);

  const remove = useCallback((chip) => {
    updateArrayField(fieldName, chips.filter((c) => c !== chip));
  }, [chips, fieldName, updateArrayField]);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
        <span className="ml-1 text-slate-600 font-normal normal-case tracking-normal">
          ({chips.length})
        </span>
      </label>
      <div className="min-h-[46px] p-3 rounded-xl border border-white/8 bg-black/10 hover:border-white/15 transition-colors">
        <div className="flex flex-wrap gap-2 mb-1.5">
          <AnimatePresence>
            {chips.map((chip, i) => (
              <motion.span
                key={`${chip}-${i}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${cls}`}
              >
                {chip}
                <button
                  type="button"
                  onClick={() => remove(chip)}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${chip}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          {chips.length === 0 && (
            <span className="text-xs text-slate-600 italic self-center">{onBlank || 'None extracted'}</span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-700 outline-none"
          />
          {input.trim() && (
            <button
              type="button"
              onClick={add}
              className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 font-medium flex-shrink-0"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Section wrapper
   ════════════════════════════════════════ */
function Section({ title, icon: Icon, iconColor = 'text-primary-400', badge, children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-dark-800 border border-white/8 flex items-center justify-center flex-shrink-0">
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h3 className="font-bold text-white text-sm tracking-tight">{title}</h3>
        {badge && (
          <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-lg border border-white/8 ml-auto flex-shrink-0">
            {badge}
          </span>
        )}
        <div className="flex-1 h-px bg-white/5 ml-2" />
      </div>
      {children}
    </motion.section>
  );
}

/* ════════════════════════════════════════
   Abnormal Finding Card
   ════════════════════════════════════════ */
function AbnormalCard({ finding, index }) {
  const config = {
    critical: { bg: 'bg-red-500/10',    border: 'border-red-500/25',    text: 'text-red-400',    Icon: TrendingUp   },
    high:     { bg: 'bg-orange-500/10', border: 'border-orange-500/25', text: 'text-orange-400', Icon: TrendingUp   },
    moderate: { bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  text: 'text-amber-400',  Icon: Minus        },
    low:      { bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   text: 'text-blue-400',   Icon: TrendingDown },
  }[finding.severity] || { bg: 'bg-white/5', border: 'border-white/10', text: 'text-slate-400', Icon: Minus };

  const TIcon = config.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl border p-4 ${config.bg} ${config.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg} border ${config.border}`}>
            <TIcon className={`w-3.5 h-3.5 ${config.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${config.text}`}>{finding.parameter}</p>
            {finding.interpretation && (
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{finding.interpretation}</p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`font-mono font-bold text-base ${config.text}`}>{finding.value}</p>
          {finding.normalRange && (
            <p className="text-xs text-slate-500 mt-0.5">Ref: {finding.normalRange}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════
   Severity config
   ════════════════════════════════════════ */
const SEV_CONFIG = {
  critical: { label: 'Critical',  bg: 'bg-red-500/15',     border: 'border-red-500/35',    text: 'text-red-400',    bar: 'bg-red-500',    w: '100%' },
  high:     { label: 'High',      bg: 'bg-orange-500/15',  border: 'border-orange-500/35', text: 'text-orange-400', bar: 'bg-orange-500', w: '80%'  },
  moderate: { label: 'Moderate',  bg: 'bg-yellow-500/15',  border: 'border-yellow-500/35', text: 'text-yellow-400', bar: 'bg-yellow-500', w: '55%'  },
  low:      { label: 'Low',       bg: 'bg-blue-500/15',    border: 'border-blue-500/35',   text: 'text-blue-400',   bar: 'bg-blue-500',   w: '35%'  },
  normal:   { label: 'Normal',    bg: 'bg-success-500/15', border: 'border-success-500/35',text: 'text-success-400',bar: 'bg-success-500',w: '20%'  },
};

/* ════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════ */
export default function MedicalVerificationModal({
  isOpen,
  onClose,
  onConfirm,
  onRetry,
  confirming = false,
}) {
  const {
    extractedData,
    editableForm,
    recordMeta,
    fileInfo,
    userCorrections,
    updateRecordMeta,
    getLowConfidenceCount,
  } = useExtractionStore();

  const analysis     = extractedData?.analysis;

  /* Abnormal findings from AI + any regex-inferred ones (built by normalizer) */
  const abnormal = analysis?.abnormalFindings || [];

  /* Prefer cleaned text for accordion display; fall back to raw OCR */
  const displayText = editableForm?._cleanedText || extractedData?.extractedText;

  const severity     = analysis?.severity || 'normal';
  const sev          = SEV_CONFIG[severity] || SEV_CONFIG.normal;
  const lowConf      = getLowConfidenceCount();
  const corrCount    = userCorrections.length;
  const ocrConf      = extractedData?.ocrConfidence;
  const aiConf       = analysis?.overallConfidence;
  const confPct      = typeof ocrConf === 'number' ? ocrConf
    : typeof aiConf  === 'number' ? Math.round(aiConf * 100) : 0;

  /* Was Gemini used successfully? (has real content) */
  const geminiWorked = !!(analysis?.extractedValues && Object.keys(analysis.extractedValues).length > 0)
    || !!(analysis?.patientProfile && Object.keys(analysis.patientProfile).length > 0);

  /* Which lab keys have values in editableForm (merged AI + regex) */
  const labKeys = Object.keys(editableForm?.labValues || {}).filter((k) => {
    const v = editableForm.labValues[k];
    return v && v !== 'null' && LAB_META[k];
  });

  const abnormalLabCount = labKeys.filter((k) => {
    const val = editableForm?.labValues?.[k];
    return getLabStatus(k, val) !== 'normal' && getLabStatus(k, val) !== 'unknown';
  }).length;

  const recordDate = recordMeta?.date || new Date().toISOString().split('T')[0];
  const isValid    = recordMeta?.title?.trim() && recordMeta?.date;

  /* Summary to show (only if real content, not an error message) */
  const showSummary = analysis?.summary && !isHiddenSummary(analysis.summary)
    && analysis?.suggestedFollowUp;

  if (!isOpen || !extractedData) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={confirming ? undefined : onClose}
      />

      {/* Modal panel */}
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col w-full h-full sm:h-[97vh] sm:my-auto sm:max-w-4xl sm:mx-auto sm:rounded-2xl overflow-hidden bg-dark-950 border border-white/8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ════ STICKY HEADER ════ */}
        <header className="flex-shrink-0 border-b border-white/8 bg-dark-950/98 backdrop-blur-xl z-10">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-sm leading-tight">
                  Verify Extracted Medical Report
                </h2>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Sparkles className="w-3 h-3 text-accent-400 flex-shrink-0" />
                  {geminiWorked ? 'AI-assisted extraction' : 'Document text extraction'}
                  {' · '}Confirm before saving
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {confPct > 0 && (
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  confPct >= 80 ? 'bg-success-500/10 border-success-500/25 text-success-400'
                  : confPct >= 60 ? 'bg-amber-400/10 border-amber-400/25 text-amber-400'
                  : 'bg-slate-500/10 border-slate-500/25 text-slate-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${confPct >= 80 ? 'bg-success-400 animate-pulse' : confPct >= 60 ? 'bg-amber-400' : 'bg-slate-400'}`} />
                  {confPct}% OCR confidence
                </div>
              )}
              {!geminiWorked && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-500/10 border border-slate-500/25 text-xs text-slate-400">
                  <ScanLine className="w-3.5 h-3.5" />
                  OCR extracted
                </div>
              )}
              <button
                onClick={onClose}
                disabled={confirming}
                className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-all disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* File info strip */}
          <div className="flex items-center gap-4 px-5 py-2 bg-white/[0.02] border-t border-white/5 overflow-x-auto scrollbar-none">
            {fileInfo?.originalname && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                <FileText className="w-3 h-3" />
                <span className="font-medium text-slate-300 truncate max-w-[200px]">{fileInfo.originalname}</span>
              </div>
            )}
            <span className="text-xs text-slate-600 flex-shrink-0">•</span>
            <span className="text-xs text-slate-600 flex-shrink-0 capitalize">
              {(recordMeta?.type || 'lab_report').replace(/_/g, ' ')}
            </span>
            {extractedData?.pageCount > 0 && (
              <><span className="text-xs text-slate-600 flex-shrink-0">•</span>
              <span className="text-xs text-slate-600 flex-shrink-0">
                {extractedData.pageCount} {extractedData.pageCount === 1 ? 'page' : 'pages'}
              </span></>
            )}
            {labKeys.length > 0 && (
              <><span className="text-xs text-slate-600 flex-shrink-0">•</span>
              <span className="text-xs text-success-400 flex-shrink-0">
                {labKeys.length} lab values extracted
              </span></>
            )}
            {corrCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-accent-400 flex-shrink-0 ml-auto">
                <Edit3 className="w-3 h-3" />
                <span>{corrCount} correction{corrCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Warning strip — only for genuinely low-confidence AI data */}
          {lowConf > 0 && geminiWorked && (
            <div className="flex items-center gap-2.5 px-5 py-2 bg-amber-400/5 border-t border-amber-400/15">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                <strong>{lowConf} field{lowConf > 1 ? 's' : ''}</strong> have low AI confidence — highlighted below. Please verify.
              </p>
            </div>
          )}

          {/* OCR-only mode note */}
          {!geminiWorked && extractedData?.extractedText && (
            <div className="flex items-center gap-2.5 px-5 py-2 bg-primary-500/5 border-t border-primary-500/15">
              <ScanLine className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
              <p className="text-xs text-primary-300">
                Values extracted directly from document text — please review and confirm all fields below.
              </p>
            </div>
          )}
        </header>

        {/* ════ SCROLLABLE BODY ════ */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">

          {/* ── SECTION 0: Record Metadata ── */}
          <Section title="Record Details" icon={FileText} iconColor="text-slate-400">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <EditableMedicalField
                  id="verify-title"
                  label="Record Title"
                  value={recordMeta?.title || ''}
                  onChange={(v) => updateRecordMeta({ title: v })}
                  placeholder="e.g. Blood Test — Jan 2025"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                  Record Date <span className="text-danger-400">*</span>
                </label>
                <input
                  id="verify-date"
                  type="date"
                  value={recordDate}
                  onChange={(e) => updateRecordMeta({ date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="input-field text-sm w-full"
                />
              </div>
            </div>
          </Section>

          {/* ── SECTION 1: Patient Information ── */}
          <Section
            title="Patient Information"
            icon={User}
            iconColor="text-accent-400"
            badge="Click any field to edit"
          >
            <div className="glass-card p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <EditableMedicalField
                  id="verify-patient-name"
                  label="Patient Name"
                  icon={User}
                  value={editableForm?.patientName || ''}
                  aiValue={extractValue(analysis?.patientProfile?.patientName)}
                  confidence={extractConfidence(analysis?.patientProfile?.patientName)}
                  onChange={(v) => useExtractionStore.getState().updateField('patientName', v)}
                  placeholder="Enter patient name"
                />
                <EditableMedicalField
                  id="verify-age"
                  label="Age"
                  icon={Calendar}
                  value={editableForm?.age || ''}
                  aiValue={extractValue(analysis?.patientProfile?.age)}
                  confidence={extractConfidence(analysis?.patientProfile?.age)}
                  onChange={(v) => useExtractionStore.getState().updateField('age', v)}
                  placeholder="e.g. 28 years"
                />
                {editableForm?.gender && (
                  <EditableMedicalField
                    id="verify-gender"
                    label="Gender"
                    icon={User}
                    value={editableForm.gender}
                    onChange={(v) => useExtractionStore.getState().updateField('gender', v)}
                    placeholder="Male / Female / Other"
                  />
                )}
                {editableForm?.patientId && (
                  <EditableMedicalField
                    id="verify-patient-id"
                    label="Patient ID"
                    icon={FileText}
                    value={editableForm.patientId}
                    onChange={(v) => useExtractionStore.getState().updateField('patientId', v)}
                    placeholder="Patient ID"
                  />
                )}
                <EditableMedicalField
                  id="verify-bp"
                  label="Blood Pressure"
                  icon={Heart}
                  value={editableForm?.bloodPressure || ''}
                  aiValue={extractValue(analysis?.patientProfile?.bloodPressure)}
                  confidence={extractConfidence(analysis?.patientProfile?.bloodPressure)}
                  onChange={(v) => useExtractionStore.getState().updateField('bloodPressure', v)}
                  placeholder="e.g. 120/80 mmHg"
                  hint="Systolic / Diastolic"
                />
                <EditableMedicalField
                  id="verify-diabetes"
                  label="Diabetes Status"
                  icon={Droplets}
                  value={editableForm?.diabetes || ''}
                  aiValue={extractValue(analysis?.patientProfile?.diabetes)}
                  confidence={extractConfidence(analysis?.patientProfile?.diabetes)}
                  onChange={(v) => useExtractionStore.getState().updateField('diabetes', v)}
                  placeholder="Normal / Pre-diabetic / Diabetic"
                />
                <EditableMedicalField
                  id="verify-doctor"
                  label="Doctor / Referred By"
                  icon={Stethoscope}
                  value={editableForm?.doctorName || ''}
                  aiValue={extractValue(analysis?.labMetadata?.doctorName)}
                  confidence={extractConfidence(analysis?.labMetadata?.doctorName)}
                  onChange={(v) => useExtractionStore.getState().updateField('doctorName', v)}
                  placeholder="Enter doctor name"
                />
                <EditableMedicalField
                  id="verify-lab"
                  label="Lab / Hospital"
                  icon={Building2}
                  value={editableForm?.labName || ''}
                  aiValue={extractValue(analysis?.labMetadata?.labName)}
                  confidence={extractConfidence(analysis?.labMetadata?.labName)}
                  onChange={(v) => useExtractionStore.getState().updateField('labName', v)}
                  placeholder="Enter lab or hospital name"
                />
                <EditableMedicalField
                  id="verify-sample"
                  label="Sample Type"
                  icon={FlaskConical}
                  value={editableForm?.sampleType || ''}
                  aiValue={extractValue(analysis?.labMetadata?.sampleType)}
                  confidence={extractConfidence(analysis?.labMetadata?.sampleType)}
                  onChange={(v) => useExtractionStore.getState().updateField('sampleType', v)}
                  placeholder="e.g. Blood, Urine, Serum"
                />
                <EditableMedicalField
                  id="verify-report-date"
                  label="Report Date"
                  icon={Calendar}
                  value={editableForm?.reportDate || ''}
                  aiValue={extractValue(analysis?.labMetadata?.reportDate)}
                  confidence={extractConfidence(analysis?.labMetadata?.reportDate)}
                  onChange={(v) => useExtractionStore.getState().updateField('reportDate', v)}
                  placeholder="Date printed on the report"
                />
              </div>
            </div>
          </Section>

          {/* ── SECTION 2: Lab Values ── */}
          {labKeys.length > 0 ? (
            <Section
              title="Lab Values"
              icon={FlaskConical}
              iconColor="text-primary-400"
              badge={`${labKeys.length} extracted${abnormalLabCount > 0 ? ` · ${abnormalLabCount} abnormal` : ''}`}
            >
              {abnormalLabCount > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-400/8 border border-amber-400/20">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-200">
                    <strong>{abnormalLabCount}</strong> value{abnormalLabCount > 1 ? 's' : ''} outside normal range.
                    <span className="text-amber-400/70 ml-1">Click any value to correct it inline.</span>
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {labKeys.map((key, i) => (
                  <LabValueCard
                    key={key}
                    labKey={key}
                    fieldData={analysis?.extractedValues?.[key]}
                    index={i}
                  />
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-600">
                <Info className="w-3 h-3 flex-shrink-0" />
                Click any value to correct inline. Changes are tracked and visible to your doctor.
              </p>
            </Section>
          ) : (
            <Section title="Lab Values" icon={FlaskConical} iconColor="text-slate-500">
              <div className="glass-card p-6 text-center">
                <FlaskConical className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No lab values detected in this document.</p>
                <p className="text-xs text-slate-600 mt-1">This is normal for prescriptions and discharge summaries.</p>
              </div>
            </Section>
          )}

          {/* ── SECTION 3: Abnormal Findings ── */}
          {abnormal.length > 0 && (
            <Section
              title="Abnormal Findings"
              icon={AlertTriangle}
              iconColor="text-warning-400"
              badge={`${abnormal.length} flagged`}
            >
              <div className="space-y-2.5">
                {abnormal.map((f, i) => (
                  <AbnormalCard key={i} finding={f} index={i} />
                ))}
              </div>
            </Section>
          )}

          {/* ── SECTION 4: Chips ── */}
          <Section title="Symptoms, Conditions & Medicines" icon={Activity} iconColor="text-success-400">
            <div className="glass-card p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <ChipSet
                  fieldName="symptoms"
                  label="Symptoms"
                  icon={Stethoscope}
                  placeholder="Add symptom, press Enter…"
                  chipColor="primary"
                  onBlank="None extracted — add if present"
                />
                <ChipSet
                  fieldName="allergies"
                  label="Allergies"
                  icon={Syringe}
                  placeholder="Add allergen, press Enter…"
                  chipColor="warning"
                  onBlank="None extracted"
                />
                <ChipSet
                  fieldName="detectedConditions"
                  label="Conditions Detected"
                  icon={Activity}
                  placeholder="Add condition, press Enter…"
                  chipColor="accent"
                  onBlank="None extracted — add if known"
                />
                <ChipSet
                  fieldName="medicines"
                  label="Medicines / Prescriptions"
                  icon={Pill}
                  placeholder="Add medicine, press Enter…"
                  chipColor="success"
                  onBlank="None extracted"
                />
              </div>
            </div>
          </Section>

          {/* ── SECTION 5: AI Summary (only shown when Gemini succeeded with real content) ── */}
          {showSummary && (
            <Section title="AI Medical Analysis" icon={Brain} iconColor="text-accent-400">
              <div className={`rounded-2xl border p-5 ${sev.bg} ${sev.border}`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center">
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Gemini AI Analysis</p>
                      <p className="text-xs text-slate-500">AI-assisted extraction · Not a diagnosis</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${sev.bg} ${sev.border} ${sev.text}`}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)} Severity
                  </span>
                </div>

                <div className="h-0.5 rounded-full bg-white/8 mb-4 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: sev.w }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
                    className={`h-full rounded-full ${sev.bar} opacity-60`}
                  />
                </div>

                <p className="text-sm text-slate-200 leading-relaxed mb-4">{analysis.summary}</p>

                {analysis.suggestedFollowUp && (
                  <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-black/20 border border-white/8">
                    <Stethoscope className="w-3.5 h-3.5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-primary-300 mb-0.5">Recommended Follow-Up</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{analysis.suggestedFollowUp}</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Correction Summary ── */}
          {corrCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-4 border border-accent-500/20"
            >
              <div className="flex items-center gap-2 mb-3">
                <Edit3 className="w-4 h-4 text-accent-400" />
                <p className="text-sm font-semibold text-white">
                  {corrCount} correction{corrCount > 1 ? 's' : ''} tracked
                </p>
                <span className="text-xs text-slate-500 ml-1">— visible to your doctor</span>
              </div>
              <div className="space-y-2">
                {userCorrections.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <span className="capitalize text-slate-500 min-w-[100px] flex-shrink-0 pt-0.5">
                      {c.field.replace('lab.', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-600 line-through">{c.aiValue || '(empty)'}</span>
                      <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                      <span className="text-accent-300 font-medium">{c.userValue}</span>
                    </div>
                  </div>
                ))}
                {corrCount > 5 && (
                  <p className="text-xs text-slate-600">+{corrCount - 5} more corrections</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── SECTION 6: Raw Extracted Text (accordion, collapsed) ── */}
          <Section title="Extracted Text" icon={FileText} iconColor="text-slate-500">
            <ExtractedTextAccordion
              text={displayText}
              extractionMethod={extractedData?.extractionMethod}
              ocrConfidence={extractedData?.ocrConfidence}
              pageCount={extractedData?.pageCount}
            />
          </Section>

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/8">
            <Info className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              This is <strong className="text-slate-400">AI-assisted extraction</strong>, not a medical diagnosis.
              Always verify abnormal values. This record is saved only after you click <strong className="text-slate-400">Confirm & Save</strong>.
              Patient corrections are visible to your doctor.
            </p>
          </div>

          <div className="h-2" />
        </div>

        {/* ════ STICKY FOOTER ════ */}
        <footer className="flex-shrink-0 border-t border-white/8 bg-dark-950/98 backdrop-blur-xl px-5 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onRetry}
              disabled={confirming}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/12 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all text-sm font-medium disabled:opacity-40 sm:flex-none"
            >
              <RotateCcw className="w-4 h-4" />
              Re-extract
            </button>

            <div className="hidden sm:block flex-1" />

            {!isValid && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 sm:self-center">
                <AlertTriangle className="w-3.5 h-3.5" />
                Title and date required
              </div>
            )}

            <motion.button
              type="button"
              onClick={() => onConfirm({ recordMeta, editableForm, userCorrections })}
              disabled={confirming || !isValid}
              whileHover={{ scale: confirming || !isValid ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2.5 flex-1 sm:flex-none sm:min-w-[200px] py-3 px-6 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/25"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving record…
                </>
              ) : (
                <>
                  <BadgeCheck className="w-4.5 h-4.5" />
                  Confirm & Save
                </>
              )}
            </motion.button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
