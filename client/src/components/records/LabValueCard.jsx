/**
 * components/records/LabValueCard.jsx
 * Displays a single extracted lab value with:
 *  - Status: NORMAL / LOW / HIGH with color coding
 *  - Normal reference range
 *  - Inline editable value
 *  - Confidence indicator
 *  - Animated status transition
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { useExtractionStore, extractConfidence, classifyConfidence } from '@store/extractionStore';

/* ════════════════════════════════════════
   Lab value metadata — labels, units, normal ranges
   ════════════════════════════════════════ */
export const LAB_META = {
  hemoglobin:    { label: 'Hemoglobin',       unit: 'g/dL',        normalRange: '12.0 – 17.5', min: 12.0, max: 17.5, icon: '🩸' },
  glucose:       { label: 'Blood Glucose',    unit: 'mg/dL',       normalRange: '70 – 99',      min: 70,   max: 99,   icon: '🍬' },
  cholesterol:   { label: 'Cholesterol',      unit: 'mg/dL',       normalRange: '< 200',        min: 0,    max: 200,  icon: '🫀' },
  systolicBP:    { label: 'Systolic BP',      unit: 'mmHg',        normalRange: '90 – 120',     min: 90,   max: 120,  icon: '📊' },
  diastolicBP:   { label: 'Diastolic BP',     unit: 'mmHg',        normalRange: '60 – 80',      min: 60,   max: 80,   icon: '📊' },
  hba1c:         { label: 'HbA1c',            unit: '%',           normalRange: '< 5.7',        min: 0,    max: 5.7,  icon: '💉' },
  creatinine:    { label: 'Creatinine',       unit: 'mg/dL',       normalRange: '0.7 – 1.3',    min: 0.7,  max: 1.3,  icon: '🧪' },
  sodium:        { label: 'Sodium (Na)',       unit: 'mEq/L',       normalRange: '135 – 145',    min: 135,  max: 145,  icon: '⚡' },
  potassium:     { label: 'Potassium (K)',     unit: 'mEq/L',       normalRange: '3.5 – 5.0',    min: 3.5,  max: 5.0,  icon: '⚡' },
  wbc:           { label: 'WBC Count',        unit: '×10³/µL',     normalRange: '4.5 – 11.0',   min: 4.5,  max: 11.0, icon: '🦠' },
  platelets:     { label: 'Platelets',        unit: '×10³/µL',     normalRange: '150 – 400',    min: 150,  max: 400,  icon: '🔬' },
  triglycerides: { label: 'Triglycerides',    unit: 'mg/dL',       normalRange: '< 150',        min: 0,    max: 150,  icon: '💧' },
};

/* ── Status classification ── */
export function getLabStatus(metaKey, valueStr) {
  const meta = LAB_META[metaKey];
  if (!meta || !valueStr) return 'unknown';
  const num = parseFloat(String(valueStr).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return 'unknown';
  if (num < meta.min) return 'low';
  if (num > meta.max) return 'high';
  return 'normal';
}

/* ── Status visual config ── */
const STATUS_CONFIG = {
  normal:  {
    border: 'border-l-success-500',
    bg:     'bg-success-500/5',
    badge:  'bg-success-500/15 border border-success-500/30 text-success-400',
    text:   'text-success-400',
    label:  'NORMAL',
    Icon:   Minus,
    glow:   '',
  },
  low:     {
    border: 'border-l-amber-400',
    bg:     'bg-amber-400/5',
    badge:  'bg-amber-400/15 border border-amber-400/30 text-amber-400',
    text:   'text-amber-400',
    label:  'LOW',
    Icon:   TrendingDown,
    glow:   '',
  },
  high:    {
    border: 'border-l-red-400',
    bg:     'bg-red-400/5',
    badge:  'bg-red-400/15 border border-red-400/30 text-red-400',
    text:   'text-red-400',
    label:  'HIGH',
    Icon:   TrendingUp,
    glow:   '',
  },
  unknown: {
    border: 'border-l-slate-700',
    bg:     '',
    badge:  'bg-slate-700/30 border border-slate-600/20 text-slate-400',
    text:   'text-slate-400',
    label:  '—',
    Icon:   Minus,
    glow:   '',
  },
};

/**
 * LabValueCard
 * @param {string} labKey    - Key from extractedValues (e.g., 'hemoglobin')
 * @param {any}    fieldData - { value, confidence } object or plain string
 * @param {number} index     - For stagger animation
 */
export default function LabValueCard({ labKey, fieldData, index = 0 }) {
  const { editableForm, updateLabValue } = useExtractionStore();
  const meta       = LAB_META[labKey];
  const currentVal = editableForm?.labValues?.[labKey] ?? '';

  /* Derive status from the current (possibly edited) value */
  const status     = getLabStatus(labKey, currentVal);
  const sConfig    = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const StatusIcon = sConfig.Icon;

  /* Confidence from AI */
  const confidence = extractConfidence(fieldData);
  const confLevel  = classifyConfidence(confidence);

  /* Editing state */
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(currentVal);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(currentVal);
  }, [currentVal, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitEdit = () => {
    updateLabValue(labKey, draft.trim());
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(currentVal);
    setEditing(false);
  };

  if (!meta) return null; // unknown lab key

  const isEmpty = !currentVal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={`relative rounded-xl border-l-4 border border-white/8 p-4 ${sConfig.border} ${sConfig.bg} group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base select-none" aria-hidden="true">{meta.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white/90 leading-tight">{meta.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{meta.unit}</p>
          </div>
        </div>

        {/* Status badge */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${sConfig.badge}`}>
          <StatusIcon className="w-3 h-3" />
          {sConfig.label}
        </span>
      </div>

      {/* Editable value */}
      <div
        className={`rounded-xl border transition-all mb-2 ${
          editing
            ? 'border-primary-500/50 ring-2 ring-primary-500/20'
            : 'border-white/8 hover:border-white/20 cursor-pointer'
        } bg-black/20`}
        onClick={!editing ? () => setEditing(true) : undefined}
      >
        {editing ? (
          <div className="flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              onBlur={commitEdit}
              placeholder="Enter value..."
              className="flex-1 bg-transparent px-3 py-2 text-sm font-mono text-white outline-none min-w-0"
            />
            <div className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); commitEdit(); }}
                className="p-1 rounded-lg text-success-400 hover:bg-success-500/15 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
                className="p-1 rounded-lg text-slate-500 hover:bg-white/8 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-2">
            {isEmpty ? (
              <span className="text-sm text-slate-600 italic">Not extracted</span>
            ) : (
              <span className={`text-lg font-bold font-mono ${isEmpty ? 'text-slate-600' : sConfig.text}`}>
                {currentVal}
                <span className="text-xs font-normal text-slate-500 ml-1">{meta.unit}</span>
              </span>
            )}
            <Pencil className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      {/* Normal range */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Ref: <span className="font-mono text-slate-400">{meta.normalRange} {meta.unit}</span>
        </p>

        {/* Confidence indicator */}
        {confidence !== null && confLevel !== 'high' && (
          <span className={`inline-flex items-center gap-1 text-xs ${
            confLevel === 'medium' ? 'text-amber-400' : 'text-danger-400'
          }`}>
            <AlertTriangle className="w-3 h-3" />
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}
