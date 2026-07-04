/**
 * components/records/ExtractedMedicalDataModal.jsx
 *
 * Production-grade AI extraction confirmation modal.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  🛡️  Please confirm extracted details                       │
 *  │  Fields with ⚠ need your verification (low AI confidence)   │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  Patient Name: [ Rahul Sharma ]   Age: [ 24 ]               │
 *  │  Blood Pressure: [ 140/90 ]  ⚠    Diabetes: [ High ]        │
 *  │  Symptoms: [Fever ✕] [Chest Pain ✕] [+ Add]                 │
 *  │  Allergies: [Penicillin ✕] [+ Add]                          │
 *  │  Conditions: [Viral Infection ✕] [+ Add]                    │
 *  │  Medicines: [Paracetamol ✕] [+ Add]                         │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  AI Summary (Gemini)         Severity: Moderate             │
 *  │  Abnormal Findings (3 flagged)                              │
 *  │  Extracted Lab Values                                       │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  [Retry Extraction]         [Confirm & Save]                │
 *  └─────────────────────────────────────────────────────────────┘
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, CheckCircle, X, Plus, Brain,
  Sparkles, Stethoscope, FlaskConical, Activity, Pill, Loader2,
  RotateCcw, Edit3, Info, TrendingUp, TrendingDown, Minus,
  User, Calendar, Heart, Syringe, CheckCircle2,
} from 'lucide-react';
import {
  useExtractionStore,
  classifyConfidence,
  extractValue,
  extractConfidence,
  CONFIDENCE_THRESHOLDS,
} from '@store/extractionStore';

/* ════════════════════════════════════════
   Confidence UI Helpers
   ════════════════════════════════════════ */

const CONFIDENCE_STYLES = {
  high:    { border: 'border-success-500/30', bg: '',                   badge: 'text-success-400', label: '' },
  medium:  { border: 'border-amber-400/50',   bg: 'bg-amber-400/5',     badge: 'text-amber-400',   label: '⚠ Please verify' },
  low:     { border: 'border-danger-400/60',  bg: 'bg-danger-400/5',    badge: 'text-danger-400',  label: '⚠ Low confidence — enter manually' },
  unknown: { border: 'border-white/10',       bg: '',                   badge: '',                 label: '' },
};

function ConfidenceBadge({ confidence, compact = false }) {
  const level = classifyConfidence(confidence);
  if (level === 'high' || level === 'unknown') return null;
  const styles = CONFIDENCE_STYLES[level];
  const pct    = confidence !== null ? `${Math.round(confidence * 100)}%` : '';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${styles.badge}`}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      {compact ? pct : styles.label}
      {!compact && pct && <span className="opacity-60 ml-0.5">({pct})</span>}
    </span>
  );
}

/* ── Wrapper for each field with confidence styling ── */
function ConfidenceField({ label, fieldName, confidence, icon: Icon, children, className = '' }) {
  const level  = classifyConfidence(confidence);
  const styles = CONFIDENCE_STYLES[level];
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </label>
        <ConfidenceBadge confidence={confidence} />
      </div>
      <div className={`rounded-xl border transition-colors ${styles.border} ${styles.bg}`}>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Chip Tag Input
   ════════════════════════════════════════ */

function ChipInput({ fieldName, label, icon: Icon, placeholder, confidence, chipColor = 'primary' }) {
  const { editableForm, updateArrayField } = useExtractionStore();
  const chips   = editableForm?.[fieldName] || [];
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const chipColors = {
    primary: 'bg-primary-500/15 border-primary-500/30 text-primary-300',
    success: 'bg-success-500/15 border-success-500/30 text-success-300',
    warning: 'bg-amber-500/15  border-amber-500/30  text-amber-300',
    danger:  'bg-danger-500/15  border-danger-500/30  text-danger-300',
  };
  const cls = chipColors[chipColor] || chipColors.primary;

  const addChip = useCallback(() => {
    const val = input.trim();
    if (!val || chips.includes(val)) { setInput(''); return; }
    updateArrayField(fieldName, [...chips, val]);
    setInput('');
    inputRef.current?.focus();
  }, [input, chips, fieldName, updateArrayField]);

  const removeChip = useCallback((chip) => {
    updateArrayField(fieldName, chips.filter((c) => c !== chip));
  }, [chips, fieldName, updateArrayField]);

  const level  = classifyConfidence(confidence);
  const styles = CONFIDENCE_STYLES[level];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </label>
        <ConfidenceBadge confidence={confidence} />
      </div>
      <div className={`rounded-xl border p-3 min-h-[50px] transition-colors ${styles.border} ${styles.bg}`}>
        <div className="flex flex-wrap gap-2 mb-2">
          <AnimatePresence>
            {chips.map((chip, i) => (
              <motion.span
                key={`${chip}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${cls}`}
              >
                {chip}
                <button
                  type="button"
                  onClick={() => removeChip(chip)}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${chip}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(); } }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none min-w-0"
          />
          {input.trim() && (
            <button
              type="button"
              onClick={addChip}
              className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Scalar Text Field
   ════════════════════════════════════════ */
function ConfidenceInput({ fieldName, label, icon: Icon, placeholder, confidence, type = 'text' }) {
  const { editableForm, updateField } = useExtractionStore();
  const value = editableForm?.[fieldName] || '';

  const level  = classifyConfidence(confidence);
  const styles = CONFIDENCE_STYLES[level];

  return (
    <ConfidenceField label={label} fieldName={fieldName} confidence={confidence} icon={Icon}>
      <input
        type={type}
        id={`confirm-field-${fieldName}`}
        value={value}
        onChange={(e) => updateField(fieldName, e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none ${styles.border !== 'border-white/10' ? 'rounded-xl' : ''}`}
      />
    </ConfidenceField>
  );
}

/* ════════════════════════════════════════
   Abnormal Finding Row
   ════════════════════════════════════════ */
function AbnormalRow({ finding }) {
  const cls = {
    critical: 'bg-red-500/10 border-red-500/25 text-red-400',
    high:     'bg-orange-500/10 border-orange-500/25 text-orange-400',
    moderate: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400',
    low:      'bg-blue-500/10 border-blue-500/25 text-blue-400',
  }[finding.severity] || 'bg-white/5 border-white/10 text-slate-400';

  const TrendIcon = finding.trend === 'high' ? TrendingUp
    : finding.trend === 'low' ? TrendingDown : Minus;

  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <TrendIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <p className="font-semibold text-sm text-white">{finding.parameter}</p>
            {finding.confidence && finding.confidence < CONFIDENCE_THRESHOLDS.HIGH && (
              <span className="text-xs text-amber-400">(⚠ verify)</span>
            )}
          </div>
          {finding.interpretation && (
            <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{finding.interpretation}</p>
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

/* ════════════════════════════════════════
   Severity Banner
   ════════════════════════════════════════ */
const SEV_STYLES = {
  critical: { bg: 'bg-red-500/15',    border: 'border-red-500/40',    text: 'text-red-400',    bar: 'bg-red-500',     label: 'Critical',  width: '100%' },
  high:     { bg: 'bg-orange-500/15', border: 'border-orange-500/40', text: 'text-orange-400', bar: 'bg-orange-500',  label: 'High',      width: '80%' },
  moderate: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', bar: 'bg-yellow-500',  label: 'Moderate',  width: '60%' },
  low:      { bg: 'bg-blue-500/15',   border: 'border-blue-500/40',   text: 'text-blue-400',   bar: 'bg-blue-500',    label: 'Low',       width: '40%' },
  normal:   { bg: 'bg-success-500/15',border: 'border-success-500/40',text: 'text-success-400',bar: 'bg-success-500', label: 'Normal',    width: '20%' },
};

/* ════════════════════════════════════════
   Main Modal Content
   ════════════════════════════════════════ */
export default function ExtractedMedicalDataModal({
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
    userCorrections,
    updateRecordMeta,
    getLowConfidenceCount,
    phase,
  } = useExtractionStore();

  const analysis     = extractedData?.analysis;
  const profile      = analysis?.patientProfile || {};
  const labMeta      = analysis?.labMetadata    || {};
  const sevStyle     = SEV_STYLES[analysis?.severity] || SEV_STYLES.normal;
  const lowConfCount = getLowConfidenceCount();

  const hasAbnormal     = analysis?.abnormalFindings?.length > 0;
  const hasValues       = analysis?.extractedValues && Object.values(analysis.extractedValues).some((v) => {
    const val = typeof v === 'object' ? v?.value : v;
    return val && val !== 'null';
  });
  const extractedValues = analysis?.extractedValues || {};

  if (!isOpen || !extractedData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-2xl my-4 rounded-2xl bg-dark-900 border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-dark-900/95 backdrop-blur border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Confirm Extracted Details</h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-accent-400" />
                AI-assisted extraction · Review before saving
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-all"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-120px)] px-6 py-5 space-y-5">

          {/* ── Trust banner ── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-2xl bg-warning-500/10 border border-warning-500/25"
          >
            <ShieldCheck className="w-5 h-5 text-warning-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">
                Please verify all fields below
                {lowConfCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium">
                    {lowConfCount} {lowConfCount === 1 ? 'field needs' : 'fields need'} attention
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Fields highlighted in <span className="text-amber-400">yellow</span> have lower AI confidence — 
                please verify they're correct. All fields are editable.
              </p>
            </div>
          </motion.div>

          {/* ── Record metadata ── */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Edit3 className="w-4 h-4 text-primary-400" />
              <p className="font-semibold text-white text-sm">Record Details</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">Title</label>
                <input
                  id="confirm-title"
                  type="text"
                  value={recordMeta?.title || ''}
                  onChange={(e) => updateRecordMeta({ title: e.target.value })}
                  className="input-field text-sm"
                  placeholder="Record title"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">Date</label>
                <input
                  id="confirm-date"
                  type="date"
                  value={recordMeta?.date || ''}
                  onChange={(e) => updateRecordMeta({ date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>

          {/* ── Patient Profile — editable fields ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-accent-400" />
              <p className="font-semibold text-white text-sm">Patient Information</p>
              <span className="ml-auto text-xs text-slate-500">All fields editable</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ConfidenceInput
                fieldName="patientName"
                label="Patient Name"
                icon={User}
                placeholder="e.g. Rahul Sharma"
                confidence={extractConfidence(profile.patientName) ?? extractConfidence(labMeta.patientName)}
              />
              <ConfidenceInput
                fieldName="age"
                label="Age"
                icon={Calendar}
                placeholder="e.g. 24"
                confidence={extractConfidence(profile.age)}
              />
              <ConfidenceInput
                fieldName="bloodPressure"
                label="Blood Pressure"
                icon={Heart}
                placeholder="e.g. 140/90 mmHg"
                confidence={extractConfidence(profile.bloodPressure)}
              />
              <ConfidenceInput
                fieldName="diabetes"
                label="Diabetes Status"
                icon={Activity}
                placeholder="e.g. Normal / Pre-diabetic / High"
                confidence={extractConfidence(profile.diabetes)}
              />
            </div>

            {/* Symptoms — chip input */}
            <ChipInput
              fieldName="symptoms"
              label="Symptoms"
              icon={Stethoscope}
              placeholder="Type a symptom, press Enter..."
              confidence={profile.symptoms?.length > 0 ? extractConfidence(profile.symptoms[0]) : null}
              chipColor="primary"
            />

            {/* Allergies — chip input */}
            <ChipInput
              fieldName="allergies"
              label="Allergies"
              icon={Syringe}
              placeholder="Type an allergen, press Enter..."
              confidence={profile.allergies?.length > 0 ? extractConfidence(profile.allergies[0]) : null}
              chipColor="warning"
            />
          </motion.div>

          {/* ── Conditions + Medicines — editable chips ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="glass-card p-5">
              <ChipInput
                fieldName="detectedConditions"
                label="Conditions Detected"
                icon={Activity}
                placeholder="Add condition..."
                confidence={analysis?.detectedConditions?.length > 0 ? extractConfidence(analysis.detectedConditions[0]) : null}
                chipColor="primary"
              />
            </div>
            <div className="glass-card p-5">
              <ChipInput
                fieldName="medicines"
                label="Medicines"
                icon={Pill}
                placeholder="Add medicine..."
                confidence={analysis?.medicines?.length > 0 ? extractConfidence(analysis.medicines[0]) : null}
                chipColor="success"
              />
            </div>
          </motion.div>

          {/* ── AI Summary ── */}
          {analysis?.summary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`rounded-2xl border p-5 ${sevStyle.bg} ${sevStyle.border}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">AI Medical Summary</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-accent-400" />
                      Gemini AI · AI-assisted extraction
                      {extractedData.ocrConfidence ? ` · ${extractedData.ocrConfidence}% extraction confidence` : ''}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${sevStyle.bg} ${sevStyle.border} ${sevStyle.text}`}>
                  {analysis.severity ? analysis.severity.charAt(0).toUpperCase() + analysis.severity.slice(1) : 'Normal'}
                </span>
              </div>

              {/* Severity bar */}
              <div className="h-0.5 rounded-full bg-white/10 mb-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: sevStyle.width }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                  className={`h-full rounded-full ${sevStyle.bar} opacity-60`}
                />
              </div>

              <p className="text-sm text-slate-200 leading-relaxed">{analysis.summary}</p>

              {analysis.suggestedFollowUp && (
                <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-black/20 border border-white/10">
                  <Stethoscope className="w-3.5 h-3.5 text-primary-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-primary-400 mb-0.5">Recommended Follow-Up</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{analysis.suggestedFollowUp}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Abnormal Findings ── */}
          {hasAbnormal && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-warning-400" />
                <p className="font-semibold text-white text-sm">
                  Abnormal Findings
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    ({analysis.abnormalFindings.length} flagged)
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                {analysis.abnormalFindings.map((f, i) => (
                  <AbnormalRow key={i} finding={f} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Extracted Lab Values ── */}
          {hasValues && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-accent-400" />
                <p className="font-semibold text-white text-sm">Extracted Lab Values</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {Object.entries(extractedValues).map(([key, fieldData]) => {
                  const val  = typeof fieldData === 'object' ? fieldData?.value : fieldData;
                  const conf = typeof fieldData === 'object' ? fieldData?.confidence : null;
                  if (!val || val === 'null') return null;
                  const level = classifyConfidence(conf);
                  return (
                    <div key={key} className={`flex justify-between items-center py-2 border-b border-white/5 last:border-0 ${level === 'medium' ? 'text-amber-400' : level === 'low' ? 'text-danger-400' : ''}`}>
                      <span className="text-slate-400 text-xs capitalize flex items-center gap-1">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                        {level !== 'high' && level !== 'unknown' && conf !== null && (
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                        )}
                      </span>
                      <span className={`text-xs font-mono font-medium ${level === 'medium' ? 'text-amber-300' : level === 'low' ? 'text-danger-300' : 'text-white'}`}>
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Correction summary ── */}
          {userCorrections.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-4 border border-accent-500/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <Edit3 className="w-3.5 h-3.5 text-accent-400" />
                <p className="text-xs font-semibold text-accent-400">
                  {userCorrections.length} correction{userCorrections.length > 1 ? 's' : ''} tracked
                </p>
              </div>
              <div className="space-y-1.5">
                {userCorrections.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-slate-500 capitalize min-w-[100px]">
                      {c.field.replace(/([A-Z])/g, ' $1')}:
                    </span>
                    <span className="text-slate-600 line-through">{c.aiValue || '(empty)'}</span>
                    <span className="text-white">→ {c.userValue}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Disclaimer ── */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/8">
            <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              This is <strong className="text-slate-400">AI-assisted extraction</strong>, not a medical diagnosis.
              Data will only be saved after you click "Confirm & Save". Corrections are tracked and visible to your doctor.
            </p>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1 pb-2 border-t border-white/5">
            <button
              type="button"
              onClick={onRetry}
              disabled={confirming}
              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl border border-white/15 text-slate-400 hover:text-white hover:border-white/25 hover:bg-white/5 transition-all text-sm font-medium disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Extraction
            </button>
            <motion.button
              type="button"
              onClick={() => onConfirm({ recordMeta, editableForm, userCorrections })}
              disabled={confirming || !recordMeta?.title?.trim() || !recordMeta?.date}
              whileHover={{ scale: confirming ? 1 : 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20"
            >
              {confirming ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Confirm & Save</>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
