/**
 * store/extractionStore.js
 * Zustand store for the AI extraction confirmation flow.
 *
 * v3: buildEditableForm now uses normalizeMedicalExtraction to merge
 *     Gemini AI output with regex-parsed raw OCR text.
 *     Fields are NEVER empty if the document had extractable data.
 *
 * State flow:
 *   idle → uploading → extracting → confirming → saving → done
 */

import { create } from 'zustand';
import { normalizeMedicalExtraction } from '@utils/normalizeMedicalExtraction';

/* ── Confidence threshold constants ── */
export const CONFIDENCE_THRESHOLDS = {
  HIGH:   0.8,
  MEDIUM: 0.6,
  LOW:    0,
};

export const classifyConfidence = (confidence) => {
  if (confidence === null || confidence === undefined) return 'unknown';
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH)   return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
};

export const extractValue = (fieldData) => {
  if (!fieldData) return null;
  if (typeof fieldData === 'string') return fieldData || null;
  if (typeof fieldData === 'object') return fieldData.value ?? null;
  return null;
};

export const extractConfidence = (fieldData) => {
  if (!fieldData) return null;
  if (typeof fieldData === 'object' && fieldData.confidence !== undefined) {
    return fieldData.confidence;
  }
  return null;
};

/**
 * Build the flat editable form by:
 *  1. Running normalizeMedicalExtraction(rawText, analysis) to merge AI + regex results
 *  2. Returning a flat object ready for the verification UI
 *
 * This ensures fields are NEVER empty when the document has data,
 * even when Gemini fails completely.
 */
const buildEditableForm = (analysis, rawText = '') => {
  const normalized = normalizeMedicalExtraction(rawText, analysis);

  return {
    /* Store cleanedText so the accordion can display it */
    _cleanedText: normalized.cleanedText,

    /* Scalar patient info */
    patientName:   normalized.patientName,
    age:           normalized.age,
    gender:        normalized.gender,
    patientId:     normalized.patientId,
    bloodPressure: normalized.bloodPressure,
    diabetes:      normalized.diabetes,
    doctorName:    normalized.doctorName,
    labName:       normalized.labName,
    sampleType:    normalized.sampleType,
    reportDate:    normalized.reportDate,

    /* Arrays */
    symptoms:           normalized.symptoms,
    allergies:          normalized.allergies,
    detectedConditions: normalized.detectedConditions,
    medicines:          normalized.medicines,

    /* Lab value dict { hemoglobin: '12.5', glucose: '95', ... } */
    labValues: normalized.labValues,
  };
};

export const useExtractionStore = create((set, get) => ({
  /* ── Upload phase ── */
  phase: 'idle',
  uploadStage: null,
  error: null,

  /* ── Extracted (pre-save) data ── */
  extractedData: null,
  fileInfo: null,

  /* ── Editable form ── */
  editableForm: null,

  /* ── Record metadata ── */
  recordMeta: null,

  /* ── User correction tracking ── */
  userCorrections: [],

  /* ── Saved record ── */
  savedRecord: null,
  doctorSummary: null,

  /* ────────────────────────────────────────
     Actions
     ──────────────────────────────────────── */

  startUpload: () => set({
    phase: 'uploading',
    uploadStage: 'upload',
    error: null,
    extractedData: null,
    fileInfo: null,
    editableForm: null,
    userCorrections: [],
    savedRecord: null,
    doctorSummary: null,
  }),

  setUploadStage: (stage) => set({ uploadStage: stage }),

  /**
   * Called when extract-preview returns.
   * Builds the editable form from BOTH Gemini analysis AND raw OCR text.
   */
  setExtractedData: (apiResponse, fileInfo, recordMeta) => {
    const { analysis, extractedText, extractionMethod, ocrConfidence, pageCount } = apiResponse;

    /* KEY FIX: pass extractedText into buildEditableForm so the normalizer
       can regex-parse raw text as fallback for every empty AI field. */
    const editableForm = buildEditableForm(analysis, extractedText);

    set({
      phase: 'confirming',
      uploadStage: null,
      extractedData: { analysis, extractedText, extractionMethod, ocrConfidence, pageCount },
      fileInfo,
      editableForm,
      recordMeta,
      userCorrections: [],
      error: null,
    });
  },

  /**
   * Update a scalar field and track the correction.
   */
  updateField: (fieldName, newValue) => {
    const state = get();

    /* Find the original AI value to compare for correction tracking */
    const profile   = state.extractedData?.analysis?.patientProfile  || {};
    const labMeta   = state.extractedData?.analysis?.labMetadata      || {};
    const oldAiValue = extractValue(profile[fieldName])
                    || extractValue(labMeta[fieldName])
                    || '';

    const existingIdx = state.userCorrections.findIndex((c) => c.field === fieldName);
    let updatedCorrections = [...state.userCorrections];

    if (newValue !== oldAiValue) {
      const correction = { field: fieldName, aiValue: oldAiValue, userValue: String(newValue) };
      if (existingIdx >= 0) {
        updatedCorrections[existingIdx] = correction;
      } else {
        updatedCorrections.push(correction);
      }
    } else {
      if (existingIdx >= 0) updatedCorrections.splice(existingIdx, 1);
    }

    set((s) => ({
      editableForm: { ...s.editableForm, [fieldName]: newValue },
      userCorrections: updatedCorrections,
    }));
  },

  /**
   * Update an individual lab value and track the correction.
   */
  updateLabValue: (key, newValue) => {
    const state       = get();
    const aiFieldData = state.extractedData?.analysis?.extractedValues?.[key];
    const aiRaw       = extractValue(aiFieldData) || '';
    const aiNumeric   = aiRaw.replace(/[^\d.]/g, '').trim() || aiRaw;

    const correctionField = `lab.${key}`;
    const existingIdx     = state.userCorrections.findIndex((c) => c.field === correctionField);
    let updatedCorrections = [...state.userCorrections];

    if (newValue !== aiNumeric) {
      const correction = { field: correctionField, aiValue: aiNumeric, userValue: String(newValue) };
      if (existingIdx >= 0) {
        updatedCorrections[existingIdx] = correction;
      } else {
        updatedCorrections.push(correction);
      }
    } else {
      if (existingIdx >= 0) updatedCorrections.splice(existingIdx, 1);
    }

    set((s) => ({
      editableForm: {
        ...s.editableForm,
        labValues: { ...(s.editableForm?.labValues || {}), [key]: newValue },
      },
      userCorrections: updatedCorrections,
    }));
  },

  /**
   * Update an array field (symptoms, allergies, conditions, medicines).
   */
  updateArrayField: (fieldName, newArray) => {
    const state    = get();
    const analysis = state.extractedData?.analysis;
    let aiArrayRaw = [];

    if (fieldName === 'symptoms' || fieldName === 'allergies') {
      aiArrayRaw = analysis?.patientProfile?.[fieldName] || [];
    } else if (fieldName === 'detectedConditions') {
      aiArrayRaw = analysis?.detectedConditions || [];
    } else if (fieldName === 'medicines') {
      aiArrayRaw = analysis?.medicines || [];
    }

    const aiArray = aiArrayRaw.map(extractValue).filter(Boolean);
    const aiStr   = JSON.stringify([...aiArray].sort());
    const newStr  = JSON.stringify([...newArray].sort());

    const existingIdx      = state.userCorrections.findIndex((c) => c.field === fieldName);
    let updatedCorrections = [...state.userCorrections];

    if (newStr !== aiStr) {
      const correction = { field: fieldName, aiValue: aiStr, userValue: newStr };
      if (existingIdx >= 0) {
        updatedCorrections[existingIdx] = correction;
      } else {
        updatedCorrections.push(correction);
      }
    } else {
      if (existingIdx >= 0) updatedCorrections.splice(existingIdx, 1);
    }

    set((s) => ({
      editableForm: { ...s.editableForm, [fieldName]: newArray },
      userCorrections: updatedCorrections,
    }));
  },

  updateRecordMeta: (updates) => set((s) => ({
    recordMeta: { ...s.recordMeta, ...updates },
  })),

  setSaving:      ()          => set({ phase: 'saving' }),
  setSaved:       (record)    => set({ phase: 'done', savedRecord: record }),
  setDoctorSummary: (summary) => set({ doctorSummary: summary }),
  setError:       (message)   => set({ phase: 'error', error: message }),

  reset: () => set({
    phase: 'idle',
    uploadStage: null,
    error: null,
    extractedData: null,
    fileInfo: null,
    editableForm: null,
    recordMeta: null,
    userCorrections: [],
    savedRecord: null,
    doctorSummary: null,
  }),

  /* ── Selectors ── */

  getFieldConfidence: (fieldPath) => {
    const analysis = get().extractedData?.analysis;
    if (!analysis) return 'unknown';
    const parts = fieldPath.split('.');
    let obj = analysis;
    for (const part of parts) {
      obj = obj?.[part];
      if (obj === undefined) return 'unknown';
    }
    return classifyConfidence(extractConfidence(obj));
  },

  getLowConfidenceCount: () => {
    const analysis = get().extractedData?.analysis;
    if (!analysis) return 0;
    let count = 0;
    const profile = analysis.patientProfile || {};
    const check = (f) => {
      const c = extractConfidence(f);
      if (c !== null && c < CONFIDENCE_THRESHOLDS.HIGH) count++;
    };
    check(profile.patientName);
    check(profile.age);
    check(profile.bloodPressure);
    check(profile.diabetes);
    (profile.symptoms  || []).forEach(check);
    (profile.allergies || []).forEach(check);
    return count;
  },
}));
