/**
 * api/records.api.js
 * Health records CRUD + AI extraction confirmation flow API calls
 *
 * v2 additions:
 *  - extractPreview: POST /records/extract-preview (no DB save, returns confidence scores)
 *  - confirmSave:    POST /records/confirm-save (saves after user confirmation)
 *  - getDoctorSummary:      GET  /records/:id/doctor-summary
 *  - generateDoctorSummary: POST /records/:id/doctor-summary
 */

import apiClient from './axios';

export const recordsApi = {
  /** Get all health records for current user */
  getAll: (params = {}) =>
    apiClient.get('/records', { params }),

  /** Get a single record */
  getById: (recordId) =>
    apiClient.get(`/records/${recordId}`),

  /**
   * [LEGACY] Create a new health record (auto-analyzes and saves immediately)
   * @param {FormData} payload - Must use FormData; field name "file" for the file
   */
  create: (payload) =>
    apiClient.post('/records', payload),

  /** Update a health record */
  update: (recordId, payload) =>
    apiClient.put(`/records/${recordId}`, payload),

  /** Delete a health record */
  delete: (recordId) =>
    apiClient.delete(`/records/${recordId}`),

  /** Get AI-generated summary of records */
  getAiSummary: () =>
    apiClient.get('/records/ai-summary'),

  /** Download a record as PDF */
  download: (recordId) =>
    apiClient.get(`/records/${recordId}/download`, { responseType: 'blob' }),

  /** Share record with a doctor */
  share: (recordId, doctorId) =>
    apiClient.post(`/records/${recordId}/share`, { doctorId }),

  /** Re-run AI medical analysis on stored extracted text */
  reanalyze: (recordId) =>
    apiClient.post(`/records/${recordId}/reanalyze`),

  /* ════════════════════════════════════════
     NEW: Extraction Confirmation Flow
     ════════════════════════════════════════ */

  /**
   * STEP 1: Upload file → AI extraction with confidence scores (NO DB save).
   * Returns: { extractedText, extractionMethod, ocrConfidence, analysis (with confidence), fileInfo }
   * @param {FormData} formData - Must include field "file" + optionally "type"
   */
  extractPreview: (formData) =>
    apiClient.post('/records/extract-preview', formData),

  /**
   * STEP 2: Save confirmed record to DB (only after user reviews).
   * @param {object} payload - { title, type, date, extractedData, userCorrections, confirmedFields, fileInfo }
   */
  confirmSave: (payload) =>
    apiClient.post('/records/confirm-save', payload),

  /**
   * Get existing doctor summary for a record.
   * Auto-generates if not present and record is confirmed.
   */
  getDoctorSummary: (recordId) =>
    apiClient.get(`/records/${recordId}/doctor-summary`),

  /**
   * Generate / regenerate AI doctor summary for a confirmed record.
   */
  generateDoctorSummary: (recordId) =>
    apiClient.post(`/records/${recordId}/doctor-summary`),
};
