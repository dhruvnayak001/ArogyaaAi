/**
 * components/records/EditableMedicalField.jsx
 * Reusable inline-editable field for the medical verification form.
 *
 * Features:
 *  - Confidence-based border + badge (amber/red for low confidence)
 *  - Click-to-edit inline (pencil icon → input)
 *  - Visual diff: shows if user changed from AI value
 *  - Accessible labels + keyboard support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Check, X, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { classifyConfidence } from '@store/extractionStore';

/* ── Confidence visual config ── */
const CONFIDENCE_CONFIG = {
  high:    { border: 'border-white/10',       bg: '',                   dot: 'bg-success-500', label: '' },
  medium:  { border: 'border-amber-400/40',   bg: 'bg-amber-400/5',     dot: 'bg-amber-400',   label: 'Verify' },
  low:     { border: 'border-danger-400/50',  bg: 'bg-danger-400/5',    dot: 'bg-danger-500',  label: 'Low confidence' },
  unknown: { border: 'border-white/8',        bg: '',                   dot: 'bg-slate-600',   label: '' },
};

/**
 * EditableMedicalField
 * @param {string}   label       — Field label (e.g., "Patient Name")
 * @param {string}   value       — Current form value
 * @param {function} onChange    — Called with new string value on change
 * @param {number}   confidence  — 0.0–1.0 from AI, or null
 * @param {string}   placeholder — Placeholder text
 * @param {string}   aiValue     — Original AI value (for diff display)
 * @param {React.FC} icon        — Lucide icon component
 * @param {string}   type        — Input type ('text', 'number', 'date')
 * @param {boolean}  required    — If true, shows required indicator
 * @param {string}   hint        — Optional hint text below field
 */
export default function EditableMedicalField({
  label,
  value = '',
  onChange,
  confidence = null,
  placeholder = '',
  aiValue = null,
  icon: Icon,
  type = 'text',
  required = false,
  hint = null,
  id,
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const inputRef              = useRef(null);

  const level      = classifyConfidence(confidence);
  const config     = CONFIDENCE_CONFIG[level];
  const isCorrected = aiValue !== null && value !== '' && value !== aiValue && value !== String(aiValue);
  const isEmpty    = !value || value === 'null';

  /* Sync draft when value changes externally */
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEdit = useCallback(() => {
    setDraft(value || '');
    setEditing(true);
  }, [value]);

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
    onChange?.(trimmed);
    setEditing(false);
  }, [draft, onChange]);

  const cancelEdit = useCallback(() => {
    setDraft(value || '');
    setEditing(false);
  }, [value]);

  /* Focus input when entering edit mode */
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    <div className="space-y-1">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest select-none"
        >
          {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
          {label}
          {required && <span className="text-danger-400 ml-0.5">*</span>}
        </label>

        {/* Confidence badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isCorrected && (
            <span className="inline-flex items-center gap-1 text-xs text-accent-400 font-medium">
              <Pencil className="w-2.5 h-2.5" /> Edited
            </span>
          )}
          {level !== 'high' && level !== 'unknown' && confidence !== null && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${
              level === 'medium' ? 'text-amber-400' : 'text-danger-400'
            }`}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {config.label}
              <span className="opacity-60">({Math.round(confidence * 100)}%)</span>
            </span>
          )}
        </div>
      </div>

      {/* Field body */}
      <div
        className={`relative rounded-xl border transition-all duration-200 ${config.border} ${config.bg} ${
          editing ? 'ring-2 ring-primary-500/40 border-primary-500/50' : 'hover:border-white/20 cursor-pointer'
        }`}
        onClick={!editing ? startEdit : undefined}
        role={!editing ? 'button' : undefined}
        tabIndex={!editing ? 0 : undefined}
        onKeyDown={!editing ? (e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(); } : undefined}
      >
        {editing ? (
          <div className="flex items-center">
            <input
              ref={inputRef}
              id={id}
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              onBlur={commitEdit}
              placeholder={placeholder}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none min-w-0"
              autoComplete="off"
            />
            <div className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); commitEdit(); }}
                className="p-1.5 rounded-lg text-success-400 hover:bg-success-500/15 transition-colors"
                title="Confirm"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white/8 transition-colors"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              {isEmpty ? (
                <span className="text-sm text-slate-600 italic">{placeholder || 'Not extracted — click to enter'}</span>
              ) : (
                <span className="text-sm text-white font-medium truncate block">{value}</span>
              )}
              {/* Show original AI value if corrected */}
              {isCorrected && aiValue && (
                <span className="text-xs text-slate-600 line-through mt-0.5 block">
                  AI: {aiValue}
                </span>
              )}
            </div>
            <Pencil className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      {/* Hint text */}
      {hint && (
        <p className="flex items-center gap-1 text-xs text-slate-600">
          <HelpCircle className="w-3 h-3 flex-shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}
