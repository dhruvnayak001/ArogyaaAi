/**
 * models/HealthRecord.model.js
 * Patient health records — lab reports, prescriptions, documents
 * Includes full medical analysis schema from PDF/OCR + Gemini pipeline.
 * 
 * v2: Added confirmation flow fields:
 *   - confirmationStatus: 'pending' | 'confirmed'
 *   - confirmedAt: timestamp when user clicked "Confirm & Save"
 *   - userCorrections: tracked diffs between AI values and user-edited values
 *   - patientProfile: structured patient info extracted by AI (with confidence)
 *   - doctorSummary: AI-generated clinical summary for doctors (post-confirmation)
 */

'use strict';

const mongoose = require('mongoose');

/* ── Abnormal finding sub-schema ── */
const AbnormalFindingSchema = new mongoose.Schema({
  parameter:      { type: String },
  value:          { type: String },
  normalRange:    { type: String },
  severity:       { type: String, enum: ['critical', 'high', 'moderate', 'low'] },
  interpretation: { type: String },
  confidence:     { type: Number, default: null }, // 0.0 - 1.0
}, { _id: false });

/* ── Analysis sub-schema ── */
const AnalysisSchema = new mongoose.Schema({
  summary:            { type: String, default: null },
  detectedConditions: [{ type: mongoose.Schema.Types.Mixed }], // supports { value, confidence } or string
  abnormalFindings:   [AbnormalFindingSchema],
  medicines:          [{ type: mongoose.Schema.Types.Mixed }], // supports { value, confidence } or string
  severity: {
    type:    String,
    enum:    ['critical', 'high', 'moderate', 'low', 'normal'],
    default: null,
  },
  suggestedFollowUp: { type: String, default: null },
  /* Key lab values extracted — can be { value, confidence } objects or flat strings */
  extractedValues: {
    type:    mongoose.Schema.Types.Mixed,
    default: {},
  },
  /* Patient profile extracted from document (with confidence scores) */
  patientProfile: {
    type:    mongoose.Schema.Types.Mixed,
    default: {},
  },
  /* Lab / doctor metadata — can be { value, confidence } objects */
  labMetadata: {
    type:    mongoose.Schema.Types.Mixed,
    default: {},
  },
  /* Overall AI confidence for this extraction (0.0 - 1.0) */
  overallConfidence: { type: Number, default: null },
  analyzedAt: { type: Date, default: null },
}, { _id: false });

/* ── User correction sub-schema ── */
const UserCorrectionSchema = new mongoose.Schema({
  field:       { type: String, required: true },    // e.g. 'bloodPressure', 'patientName'
  aiValue:     { type: String, default: null },     // original AI-extracted value
  userValue:   { type: String, default: null },     // user-corrected value
  correctedAt: { type: Date,   default: Date.now },
}, { _id: false });

/* ── Doctor summary sub-schema ── */
const DoctorSummarySchema = new mongoose.Schema({
  symptoms:           [{ type: String }],
  duration:           { type: String, default: null },
  riskLevel:          { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Low' },
  possibleConditions: [{ type: String }],
  suggestedTests:     [{ type: String }],
  clinicalNotes:      { type: String, default: null },
  urgentFlags:        [{ type: String }],
  aiConfidence:       { type: Number, default: null }, // 0-100
  disclaimer:         { type: String, default: 'AI-supported triage — final diagnosis requires clinical evaluation' },
  generatedAt:        { type: Date, default: null },
}, { _id: false });

/* ── Main schema ── */
const HealthRecordSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    title: {
      type:      String,
      required:  [true, 'Record title is required'],
      trim:      true,
      maxlength: 200,
    },
    type: {
      type:    String,
      enum:    ['lab_report', 'prescription', 'scan', 'discharge_summary', 'vaccination', 'allergy_report', 'other'],
      default: 'other',
    },
    date: {
      type:    Date,
      default: Date.now,
    },

    /* ── File storage — each entry is a Cloudinary upload result ── */
    files: [
      {
        url:          { type: String, default: null },
        publicId:     { type: String, default: null },
        originalName: { type: String },
        mimeType:     { type: String },
        size:         { type: Number, default: 0 },
      },
    ],
    /* Quick-access URL (first uploaded file) */
    fileUrl: { type: String, default: null },

    /* ── Text extraction results ── */
    extractedText: {
      type:      String,
      default:   null,
      maxlength: 100000,
    },
    extractionMethod: {
      type:    String,
      enum:    ['pdf-parse', 'tesseract-ocr', 'gemini-vision-ocr', 'pdf-parse-failed', 'ocr-failed', 'ocr-unavailable', 'unsupported', 'extraction-failed', 'none', null],
      default: null,
    },
    ocrConfidence: { type: Number, default: null },   // 0-100
    pageCount:     { type: Number, default: null },

    /* ── AI-generated structured analysis ── */
    analysis: {
      type:    AnalysisSchema,
      default: null,
    },

    /* ── Confirmation flow ── */
    confirmationStatus: {
      type:    String,
      enum:    ['pending', 'confirmed'],
      default: 'pending',
    },
    confirmedAt: { type: Date, default: null },

    /* Tracked diffs: AI value vs patient-corrected value */
    userCorrections: {
      type:    [UserCorrectionSchema],
      default: [],
    },

    /* ── AI Doctor Summary (generated after confirmation) ── */
    doctorSummary: {
      type:    DoctorSummarySchema,
      default: null,
    },

    /* Free-text description or manual notes */
    description: {
      type:      String,
      maxlength: 5000,
    },
    /* Legacy AI analysis field (kept for backward compat) */
    aiAnalysis: {
      content:     { type: String, default: null },
      generatedAt: { type: Date,   default: null },
    },

    /* Sharing */
    sharedWith: [
      {
        doctor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sharedAt: { type: Date, default: Date.now },
      },
    ],

    tags:      [{ type: String }],
    isPrivate: { type: Boolean, default: false },
    notes:     { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ── Indexes ── */
HealthRecordSchema.index({ user: 1, createdAt: -1 });
HealthRecordSchema.index({ user: 1, type: 1 });
HealthRecordSchema.index({ 'sharedWith.doctor': 1 });
HealthRecordSchema.index({ 'analysis.severity': 1 });
HealthRecordSchema.index({ confirmationStatus: 1, user: 1 });

const HealthRecord = mongoose.model('HealthRecord', HealthRecordSchema);

module.exports = HealthRecord;
