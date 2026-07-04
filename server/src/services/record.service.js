/**
 * services/record.service.js
 * Health records CRUD, AI summarization, confirmation flow, and doctor summary
 *
 * New in v2:
 *  - extractPreviewFromBuffer: runs AI extraction WITHOUT saving to DB
 *  - confirmRecord: saves user-confirmed data + corrections + triggers doctor summary
 *  - generateAndSaveDoctorSummary: calls Gemini to produce clinical doctor summary
 */

'use strict';

const HealthRecord = require('../models/HealthRecord.model');
const User         = require('../models/User.model');
const AppError     = require('../utils/AppError');
const geminiSvc    = require('./gemini.service');
const medicalSvc   = require('./medicalAnalysis.service');
const logger       = require('../config/logger');

/* Escape special regex characters to prevent ReDoS attacks.
   Applied to all user-supplied strings used in MongoDB $regex queries. */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ════════════════════════════════════════
   GET RECORDS
   ════════════════════════════════════════ */

const getRecords = async (userId, filters = {}) => {
  const query = { user: userId };
  if (filters.type)   query.type   = filters.type;
  if (filters.search) {
    const safe = escapeRegex(String(filters.search).slice(0, 100));
    query.title = { $regex: safe, $options: 'i' };
  }

  const page  = Math.max(1,  parseInt(filters.page,  10) || 1);
  const limit = Math.min(50, parseInt(filters.limit, 10) || 20);
  const skip  = (page - 1) * limit;

  const [records, total] = await Promise.all([
    /* Exclude extractedText (up to 100 KB per doc) from list responses.
       It is only needed for reanalysis and is available on the detail endpoint
       (getRecordById), which returns the full document without a .select(). */
    HealthRecord.find(query)
      .select('-extractedText')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    HealthRecord.countDocuments(query),
  ]);

  return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getRecordById = async (recordId, userId) => {
  const record = await HealthRecord.findOne({ _id: recordId, user: userId });
  if (!record) throw new AppError('Health record not found.', 404);
  return record;
};

/* ════════════════════════════════════════
   EXTRACT PREVIEW (no DB save)
   ════════════════════════════════════════ */

/**
 * extractPreviewFromBuffer
 * Runs the full AI extraction pipeline (text + Gemini with confidence scores)
 * WITHOUT writing anything to MongoDB.
 *
 * Used by POST /records/extract-preview.
 * Returns extracted data for the confirmation modal.
 *
 * @param {Buffer} buffer     - File buffer from multer
 * @param {string} mimetype   - File MIME type
 * @param {string} recordType - e.g. 'lab_report'
 * @returns extraction result with confidence scores
 */
const extractPreviewFromBuffer = async (buffer, mimetype, recordType) => {
  logger.info(`Extract-preview: ${mimetype}, type=${recordType}`);

  const result = await medicalSvc.analyzeDocumentWithConfidence(buffer, mimetype, recordType);
  return result;
};

/* ════════════════════════════════════════
   CREATE / UPDATE / DELETE
   ════════════════════════════════════════ */

const createRecord = async (userId, payload, uploadedFile = null) => {
  const { title, type, date, description, tags, notes } = payload;

  const files = [];
  if (uploadedFile) {
    files.push({
      url:          uploadedFile.secure_url   || null,
      publicId:     uploadedFile.public_id    || null,
      originalName: uploadedFile.originalname || uploadedFile.original_filename,
      mimeType:     uploadedFile.mimetype,
      size:         uploadedFile.bytes        || 0,
    });
  }

  const record = await HealthRecord.create({
    user:        userId,
    title,
    type:        type || 'other',
    date:        date || new Date(),
    description: description || null,
    tags:        Array.isArray(tags) ? tags : tags ? [tags] : [],
    notes:       notes || null,
    files,
    fileUrl:          uploadedFile?.secure_url      || null,
    /* Extraction results from upload.middleware Step 3 */
    extractedText:    uploadedFile?.extractedText    || null,
    extractionMethod: uploadedFile?.extractionMethod || null,
    ocrConfidence:    uploadedFile?.ocrConfidence    ?? null,
    pageCount:        uploadedFile?.pageCount        ?? null,
    analysis:         uploadedFile?.analysis         || null,
    /* Default to pending until user confirms via the new flow */
    confirmationStatus: 'confirmed', // legacy flow — auto-confirmed
  });

  const hasSev = record.analysis?.severity;
  logger.info(
    `Record created: ${record._id} user=${userId}` +
    (uploadedFile ? ` file=${uploadedFile.originalname}` : '') +
    (hasSev ? ` severity=${hasSev}` : '')
  );
  return record;
};

/**
 * createConfirmedRecord
 * Called by POST /records/confirm-save.
 * Saves the record ONLY after user has reviewed & confirmed the AI extraction.
 *
 * @param {string} userId
 * @param {object} payload - title, type, date, description + confirmed medical fields
 * @param {object} uploadedFile - Cloudinary result attached by upload middleware
 * @param {object} extractedData - AI extraction result (from extract-preview)
 * @param {object} userCorrections - Array of { field, aiValue, userValue }
 * @param {object} confirmedFields - Patient-edited field values
 */
const createConfirmedRecord = async (
  userId,
  payload,
  uploadedFile = null,
  extractedData = null,
  userCorrections = [],
  confirmedFields = {}
) => {
  const { title, type, date, description, tags, notes } = payload;

  const files = [];
  if (uploadedFile) {
    files.push({
      url:          uploadedFile.secure_url   || null,
      publicId:     uploadedFile.public_id    || null,
      originalName: uploadedFile.originalname || uploadedFile.original_filename,
      mimeType:     uploadedFile.mimetype,
      size:         uploadedFile.bytes        || 0,
    });
  }

  /* ── Merge confirmed user data into the analysis object ──────────────────
   *
   * Priority: user-confirmed values ALWAYS win over raw AI values.
   * This ensures the saved record exactly reflects what the patient verified.
   *
   * confirmedFields shape (sent by UploadRecordModal):
   *   confirmedLabValues  : { hemoglobin: "12.5", glucose: "95", ... }  (flat strings)
   *   patientProfile      : { patientName: {value}, age: {value}, ... }
   *   labMetadata         : { doctorName: {value}, labName: {value}, ... }
   *   detectedConditions  : [{ value: "anemia" }, ...]
   *   medicines           : [{ value: "Metformin" }, ...]
   * ──────────────────────────────────────────────────────────────────────── */
  const baseAnalysis = extractedData?.analysis || {};

  /* Lab values: confirmed flat dict → wrapped in { value } shape for schema compat */
  const confirmedLabFlat = confirmedFields.confirmedLabValues || {};
  const mergedExtractedValues = {
    ...(baseAnalysis.extractedValues || {}),  // keep any AI values not overridden
    ...Object.fromEntries(
      Object.entries(confirmedLabFlat)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => [k, { value: String(v), confidence: 1.0 }])
    ),
  };

  /* Patient profile: user-confirmed wins */
  const confirmedProfile  = confirmedFields.patientProfile  || {};
  const confirmedLabMeta  = confirmedFields.labMetadata     || {};
  const mergedPatientProfile = {
    ...(baseAnalysis.patientProfile || {}),
    ...confirmedProfile,
    ...Object.fromEntries(
      Object.entries(confirmedLabMeta)
        .filter(([, v]) => v?.value)
        .map(([k, v]) => [k, v])
    ),
  };

  /* Conditions & medicines: confirmed arrays win */
  const confirmedConditions = (confirmedFields.detectedConditions || [])
    .map((c) => (typeof c === 'string' ? c : c?.value)).filter(Boolean);
  const confirmedMedicines  = (confirmedFields.medicines || [])
    .map((m) => (typeof m === 'string' ? m : m?.value)).filter(Boolean);

  /* Abnormal findings: use AI's if present, else we keep base */
  const mergedAbnormal = baseAnalysis.abnormalFindings?.length > 0
    ? baseAnalysis.abnormalFindings
    : [];

  /* Build the final merged analysis stored to DB */
  const mergedAnalysis = {
    ...baseAnalysis,
    extractedValues:    mergedExtractedValues,
    patientProfile:     mergedPatientProfile,
    detectedConditions: confirmedConditions.length > 0 ? confirmedConditions : (baseAnalysis.detectedConditions || []),
    medicines:          confirmedMedicines.length  > 0 ? confirmedMedicines  : (baseAnalysis.medicines          || []),
    abnormalFindings:   mergedAbnormal,
  };

  /* Use cleaned OCR text if the client sent it (avoids raw OCR noise in DB) */
  const textToStore = payload.cleanedText?.trim()
    || extractedData?.extractedText
    || null;

  const record = await HealthRecord.create({
    user:        userId,
    title,
    type:        type || 'other',
    date:        date || new Date(),
    description: description || null,
    tags:        Array.isArray(tags) ? tags : tags ? [tags] : [],
    notes:       notes || null,
    files,
    fileUrl:          uploadedFile?.secure_url      || null,
    extractedText:    textToStore,
    extractionMethod: extractedData?.extractionMethod || null,
    ocrConfidence:    extractedData?.ocrConfidence    ?? null,
    pageCount:        extractedData?.pageCount        ?? null,
    analysis:         mergedAnalysis,
    /* Confirmation metadata */
    confirmationStatus: 'confirmed',
    confirmedAt:        new Date(),
    userCorrections:    userCorrections.map((c) => ({
      ...c,
      correctedAt: new Date(),
    })),
  });

  logger.info(
    `Confirmed record saved: ${record._id} user=${userId}, ` +
    `corrections=${userCorrections.length}, severity=${record.analysis?.severity}, ` +
    `labValues=${Object.keys(confirmedLabFlat).length}`
  );
  return record;
};

const updateRecord = async (recordId, userId, updates) => {
  const record = await HealthRecord.findOne({ _id: recordId, user: userId });
  if (!record) throw new AppError('Health record not found.', 404);

  const ALLOWED = ['title', 'type', 'date', 'description', 'tags', 'notes'];
  ALLOWED.forEach((field) => {
    if (updates[field] !== undefined) record[field] = updates[field];
  });

  await record.save();
  return record;
};

const deleteRecord = async (recordId, userId) => {
  const record = await HealthRecord.findOneAndDelete({ _id: recordId, user: userId });
  if (!record) throw new AppError('Health record not found.', 404);
  logger.info(`Health record deleted: ${recordId}`);
  return record;
};

/**
 * reanalyzeRecord
 * Re-runs medical analysis on an existing record's extractedText.
 */
const reanalyzeRecord = async (recordId, userId) => {
  const record = await HealthRecord.findOne({ _id: recordId, user: userId });
  if (!record) throw new AppError('Health record not found.', 404);

  if (!record.extractedText) {
    throw new AppError('No extracted text available for re-analysis. Re-upload the file.', 400);
  }

  const analysis = await medicalSvc.analyzeWithGemini(record.extractedText, record.type);

  record.analysis = analysis;
  await record.save();

  logger.info(`Re-analysis complete for record ${recordId} — severity=${analysis.severity}`);
  return record;
};

/* ════════════════════════════════════════
   DOCTOR SUMMARY
   ════════════════════════════════════════ */

/**
 * generateAndSaveDoctorSummary
 * Generates an AI clinical summary formatted for doctors and saves it to the record.
 * Should be called AFTER user confirms the record.
 */
const generateAndSaveDoctorSummary = async (recordId, userId) => {
  const record = await HealthRecord.findOne({ _id: recordId, user: userId });
  if (!record) throw new AppError('Health record not found.', 404);

  if (record.confirmationStatus !== 'confirmed') {
    throw new AppError('Record must be confirmed by patient before generating doctor summary.', 400);
  }

  /* Build patient profile from confirmed analysis */
  const profile = record.analysis?.patientProfile || {};
  const patientProfile = {
    name:        profile.patientName?.value || 'Unknown',
    age:         profile.age?.value         || 'Unknown',
    symptoms:    (profile.symptoms || []).map((s) => typeof s === 'string' ? s : s.value).filter(Boolean),
    bloodPressure: profile.bloodPressure?.value || null,
    diabetes:    profile.diabetes?.value    || null,
    allergies:   (profile.allergies || []).map((a) => typeof a === 'string' ? a : a.value).filter(Boolean),
  };

  const doctorSummary = await medicalSvc.generateDoctorSummary(record.analysis, patientProfile);

  record.doctorSummary = doctorSummary;
  await record.save();

  logger.info(`Doctor summary generated for record ${recordId} — risk=${doctorSummary.riskLevel}`);
  return { record, doctorSummary };
};

/**
 * getDoctorSummary
 * Returns existing doctor summary for a record, or generates it if missing.
 */
const getDoctorSummary = async (recordId, userId) => {
  const record = await HealthRecord.findOne({ _id: recordId, user: userId });
  if (!record) throw new AppError('Health record not found.', 404);

  if (record.doctorSummary?.generatedAt) {
    return record.doctorSummary;
  }

  /* Auto-generate if not present and record is confirmed */
  if (record.confirmationStatus === 'confirmed' && record.analysis) {
    const { doctorSummary } = await generateAndSaveDoctorSummary(recordId, userId);
    return doctorSummary;
  }

  throw new AppError('No doctor summary available. Confirm the record first.', 400);
};

/* ════════════════════════════════════════
   AI SUMMARY
   ════════════════════════════════════════ */

/**
 * Generate or return cached AI summary of all user records
 */
const getAiSummary = async (userId) => {
  const [user, records] = await Promise.all([
    User.findById(userId).lean(),
    /* Cap to 30 most-recent confirmed records; select only fields used in the prompt.
       The Gemini prompt slices at 12 000 chars anyway — fetching all records wastes
       memory for any patient with a long history. */
    HealthRecord.find({ user: userId, confirmationStatus: 'confirmed' })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('title type description notes')
      .lean(),
  ]);

  if (!user) throw new AppError('User not found.', 404);
  if (records.length === 0) {
    throw new AppError('No health records found to summarize.', 400);
  }

  const recordsText = records.map((r) => {
    const parts = [`Record: ${r.title}`, `Type: ${r.type}`];
    if (r.description) parts.push(`Content: ${r.description}`);
    if (r.notes)       parts.push(`Notes: ${r.notes}`);
    return parts.join('\n');
  }).join('\n\n---\n\n');

  const patientInfo = {
    name:              user.name,
    age:               user.age,
    bloodGroup:        user.bloodGroup,
    chronicConditions: user.chronicConditions,
    allergies:         user.allergies,
  };

  const summary = await geminiSvc.generateMedicalSummary(recordsText, patientInfo);
  return summary;
};

/* ════════════════════════════════════════
   SHARING
   ════════════════════════════════════════ */

const shareRecord = async (recordId, patientId, doctorId) => {
  const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true });
  if (!doctor) throw new AppError('Doctor not found.', 404);

  const record = await HealthRecord.findOne({ _id: recordId, user: patientId });
  if (!record) throw new AppError('Health record not found.', 404);

  const alreadyShared = record.sharedWith.some(
    (s) => s.doctor.toString() === doctorId.toString()
  );
  if (alreadyShared) throw new AppError('Record is already shared with this doctor.', 409);

  record.sharedWith.push({ doctor: doctorId, sharedAt: new Date() });
  await record.save();

  logger.info(`Record ${recordId} shared with doctor ${doctorId}`);
  return record;
};

module.exports = {
  getRecords,
  getRecordById,
  createRecord,
  createConfirmedRecord,
  updateRecord,
  deleteRecord,
  getAiSummary,
  shareRecord,
  reanalyzeRecord,
  extractPreviewFromBuffer,
  generateAndSaveDoctorSummary,
  getDoctorSummary,
};
