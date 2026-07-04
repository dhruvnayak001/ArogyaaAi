/**
 * components/records/UploadRecordModal.jsx
 * Upload modal — PRODUCTION CONFIRMATION FLOW:
 *
 *   Step 1: FORM    — user fills title, type, date, picks a file
 *   Step 2: PROCESS — upload → AI extraction with confidence scores (no DB save yet)
 *   Step 3: CONFIRM — MedicalVerificationModal opens for review/editing
 *   Step 4: SAVE    — only after user clicks "Confirm & Save"
 *   Step 5: SUCCESS — record saved, doctor summary generated in background
 *
 * Why this matters: AI-extracted health data is NEVER auto-saved.
 * The patient MUST verify before anything is written to the database.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, X, CheckCircle, Loader2, Sparkles,
  ScanLine, Brain, Cloud, AlertTriangle,
} from 'lucide-react';
import Modal                      from '@components/ui/Modal';
import MedicalVerificationModal   from '@components/records/MedicalVerificationModal';
import { recordsApi }             from '@api/records.api';
import { useExtractionStore }     from '@store/extractionStore';
import toast from 'react-hot-toast';

/* ── Types ── */
const RECORD_TYPES = [
  'lab_report', 'prescription', 'scan', 'discharge_summary',
  'vaccination', 'allergy_report', 'other',
];
const TYPE_LABELS = {
  lab_report:        'Lab Report',
  prescription:      'Prescription',
  scan:              'Scan / X-Ray / MRI',
  discharge_summary: 'Discharge Summary',
  vaccination:       'Vaccination Record',
  allergy_report:    'Allergy Report',
  other:             'Other',
};

/* ── Processing stages ── */
const STAGES = [
  { id: 'upload',  label: 'Uploading securely',    icon: Cloud,     desc: 'Encrypting and uploading your document…' },
  { id: 'parse',   label: 'Parsing document',      icon: FileText,  desc: 'Extracting text content from the file…' },
  { id: 'ocr',     label: 'Visual recognition',    icon: ScanLine,  desc: 'Reading scanned content via AI OCR…' },
  { id: 'analyze', label: 'AI medical extraction', icon: Brain,     desc: 'Gemini AI is extracting health values with confidence scores…' },
];

const STAGE_MESSAGES = [
  'Analyzing medical report…',
  'Extracting health information…',
  'Computing confidence scores…',
  'Building structured verification view…',
];

/* ════════════════════════════════════════
   Processing UI
   ════════════════════════════════════════ */
function UploadProgress({ stage }) {
  const activeIdx = STAGES.findIndex((s) => s.id === stage);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMsgIdx((i) => (i + 1) % STAGE_MESSAGES.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="py-6 px-2">
      <AnimatePresence mode="wait">
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-center text-sm font-medium text-primary-300 mb-6"
        >
          {STAGE_MESSAGES[msgIdx]}
        </motion.p>
      </AnimatePresence>

      <div className="space-y-4">
        {STAGES.map((s, i) => {
          const Icon      = s.icon;
          const isDone    = i < activeIdx;
          const isActive  = i === activeIdx;
          const isPending = i > activeIdx;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                isDone   ? 'bg-success-500/20 border border-success-500/40' :
                isActive ? 'bg-primary-500/20 border border-primary-500/40' :
                           'bg-white/5 border border-white/10'
              }`}>
                {isDone   ? <CheckCircle className="w-4 h-4 text-success-400" />
                : isActive ? <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                :            <Icon className="w-4 h-4 text-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? 'text-success-400' : isActive ? 'text-white' : 'text-slate-600'}`}>
                  {s.label}
                </p>
                {isActive && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs text-slate-500 mt-0.5">
                    {s.desc}
                  </motion.p>
                )}
              </div>
              {isDone   && <span className="text-xs text-success-500 font-medium flex-shrink-0">Done</span>}
              {isActive && <span className="text-xs text-primary-400 font-medium animate-pulse flex-shrink-0">Active</span>}
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-6 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${((activeIdx + 1) / STAGES.length) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <p className="text-center text-xs text-slate-600 mt-2">
        Step {activeIdx + 1} of {STAGES.length}
        {activeIdx >= 2 && ' · AI extraction may take 10–30 seconds'}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════
   Main Modal
   ════════════════════════════════════════ */
function UploadRecordModal({ isOpen, onClose, onSuccess }) {
  const [form,     setForm]     = useState({ title: '', type: 'lab_report', date: '' });
  const [file,     setFile]     = useState(null);
  const [dragging, setDragging] = useState(false);
  const [step,     setStep]     = useState('form');    // 'form' | 'process' | 'confirm'
  const [stage,    setStage]    = useState(null);
  const [confirming, setConfirming] = useState(false);

  const fileRef    = useRef(null);
  const stageTimer = useRef([]);

  const {
    startUpload, setExtractedData, setSaving,
    setSaved, setError, reset,
  } = useExtractionStore();

  const clearTimers = () => {
    stageTimer.current.forEach(clearTimeout);
    stageTimer.current = [];
  };

  const resetAll = useCallback(() => {
    setForm({ title: '', type: 'lab_report', date: '' });
    setFile(null);
    setStep('form');
    setStage(null);
    setConfirming(false);
    clearTimers();
    reset();
  }, [reset]);

  const handleClose = () => {
    if (step === 'process') return;
    resetAll();
    onClose();
  };

  useEffect(() => () => clearTimers(), []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0] ?? e.target?.files?.[0];
    if (f) setFile(f);
  }, []);

  /* Optimistic stage animation */
  const advanceStages = () => {
    [
      { s: 'upload',  ms: 0    },
      { s: 'parse',   ms: 2500 },
      { s: 'ocr',     ms: 5500 },
      { s: 'analyze', ms: 9000 },
    ].forEach(({ s, ms }) => {
      const t = setTimeout(() => setStage(s), ms);
      stageTimer.current.push(t);
    });
  };

  /* ── Step 1 → Step 2: Upload + AI Extract (no DB save) ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Please enter a record title'); return; }
    if (!form.date)          { toast.error('Please select the record date'); return; }
    if (!file)               { toast.error('Please attach a file'); return; }

    startUpload();
    setStep('process');
    setStage('upload');
    advanceStages();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', form.type);

      const { data } = await recordsApi.extractPreview(formData);
      const result   = data.data;

      clearTimers();

      setExtractedData(
        {
          analysis:         result.analysis,
          extractedText:    result.extractedText,
          extractionMethod: result.extractionMethod,
          ocrConfidence:    result.ocrConfidence,
          pageCount:        result.pageCount,
        },
        result.fileInfo,
        { title: form.title, type: form.type, date: form.date }
      );

      setStep('confirm');
    } catch (err) {
      clearTimers();
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      toast.error(msg);
      setError(msg);
      setStep('form');
      setStage(null);
    }
  };

  /* ── Step 3: User confirms → save to DB ── */
  const handleConfirm = async ({ recordMeta, editableForm, userCorrections }) => {
    setConfirming(true);
    setSaving();

    try {
      const { extractedData, fileInfo } = useExtractionStore.getState();

      const payload = {
        title:       recordMeta.title,
        type:        recordMeta.type  || form.type,
        date:        recordMeta.date  || form.date,
        /* Cleaned OCR text — stored instead of raw noise */
        cleanedText: editableForm._cleanedText || '',
        extractedData,
        userCorrections,
        confirmedFields: {
          patientProfile: {
            patientName:   { value: editableForm.patientName },
            age:           { value: editableForm.age },
            bloodPressure: { value: editableForm.bloodPressure },
            diabetes:      { value: editableForm.diabetes },
            symptoms:      (editableForm.symptoms   || []).map((s) => ({ value: s })),
            allergies:     (editableForm.allergies  || []).map((a) => ({ value: a })),
          },
          labMetadata: {
            doctorName:  { value: editableForm.doctorName  || '' },
            labName:     { value: editableForm.labName     || '' },
            sampleType:  { value: editableForm.sampleType  || '' },
            reportDate:  { value: editableForm.reportDate  || '' },
          },
          confirmedLabValues: editableForm.labValues || {},
          detectedConditions: (editableForm.detectedConditions || []).map((c) => ({ value: c })),
          medicines:          (editableForm.medicines          || []).map((m) => ({ value: m })),
        },
        fileInfo,
      };

      const { data } = await recordsApi.confirmSave(payload);
      const savedRec = data.data?.record;

      setSaved(savedRec);

      const sevMsg = savedRec?.analysis?.severity
        ? ` · ${savedRec.analysis.severity} severity`
        : '';
      toast.success(`✓ Record saved successfully${sevMsg}`);

      onSuccess?.(savedRec);
      resetAll();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save record';
      toast.error(msg);
      setError(msg);
      setConfirming(false);
    }
  };

  /* ── Retry: go back to form ── */
  const handleRetry = () => {
    clearTimers();
    reset();
    setStep('form');
    setStage(null);
    setConfirming(false);
  };

  const modalTitle = step === 'form'    ? 'Upload Health Record'
    : step === 'process' ? 'Analyzing Your Document…'
    :                      null; // verification modal has its own header

  return (
    <>
      {/* ── Upload / Process modal ── */}
      {step !== 'confirm' && (
        <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="md">
          <AnimatePresence mode="wait">
            {/* ══ STEP 1: Form ══ */}
            {step === 'form' && (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* Title */}
                <div>
                  <label className="form-label" htmlFor="record-title">Record Title *</label>
                  <input
                    id="record-title" type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Blood Test Report — Jan 2025"
                    className="input-field"
                    required
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="form-label" htmlFor="record-type">Record Type</label>
                  <select
                    id="record-type"
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="input-field"
                  >
                    {RECORD_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-dark-800">{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="form-label" htmlFor="record-date">Record Date *</label>
                  <input
                    id="record-date" type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="input-field"
                    required
                  />
                </div>

                {/* Drop zone */}
                <div>
                  <label className="form-label">
                    Attach File *
                    <span className="ml-2 text-xs text-slate-500 font-normal">
                      — AI extracts lab values, conditions &amp; patient info
                    </span>
                  </label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                      dragging ? 'border-primary-400 bg-primary-500/10'
                      : file   ? 'border-success-500/40 bg-success-500/5'
                      :          'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    {file ? (
                      <>
                        <CheckCircle className="w-8 h-8 text-success-400" />
                        <div className="text-center">
                          <p className="text-white text-sm font-medium">{file.name}</p>
                          <p className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-500/10 border border-primary-500/20">
                          <Sparkles className="w-3 h-3 text-primary-400" />
                          <span className="text-xs text-primary-300">AI extracts with confidence scores</span>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                          className="text-xs text-danger-400 hover:underline">
                          Remove file
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-500" />
                        <div className="text-center">
                          <p className="text-white text-sm font-medium">Drop a file here</p>
                          <p className="text-slate-500 text-xs">PDF, JPG, PNG — up to 20 MB</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Brain className="w-3 h-3" />
                          <span>Gemini AI extracts every lab value + confidence score</span>
                        </div>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={onDrop} className="hidden" aria-label="File upload" />
                  </div>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary-500/5 border border-primary-500/15">
                  <Sparkles className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-primary-300">You'll review everything before it's saved.</strong>
                    {' '}A full verification screen will appear where you can check all extracted lab values,
                    patient info, and conditions before saving.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={handleClose} className="btn-ghost flex-1 py-2.5 text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={!file} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                    <Upload className="w-4 h-4" /> Upload & Extract
                  </button>
                </div>
              </motion.form>
            )}

            {/* ══ STEP 2: Processing ══ */}
            {step === 'process' && (
              <motion.div
                key="process"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-slate-400 text-sm text-center mb-2">
                  Processing <span className="text-white font-medium">"{file?.name}"</span>
                </p>
                <UploadProgress stage={stage} />
              </motion.div>
            )}
          </AnimatePresence>
        </Modal>
      )}

      {/* ══ STEP 3: Medical Verification Modal ══ */}
      <AnimatePresence>
        {step === 'confirm' && (
          <MedicalVerificationModal
            isOpen={true}
            onClose={handleRetry}
            onConfirm={handleConfirm}
            onRetry={handleRetry}
            confirming={confirming}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default UploadRecordModal;
