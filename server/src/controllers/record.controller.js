/**
 * controllers/record.controller.js
 * HTTP layer for health records
 *
 * v2 additions:
 *  - extractPreview: POST /records/extract-preview — AI extraction without saving
 *  - confirmSave:    POST /records/confirm-save — save after user confirmation
 *  - generateDoctorSummary: POST /records/:id/doctor-summary
 *  - getDoctorSummary:      GET  /records/:id/doctor-summary
 */

'use strict';

const recordService = require('../services/record.service');
const catchAsync    = require('../utils/catchAsync');
const AppError      = require('../utils/AppError');
const logger        = require('../config/logger');

/* GET /records */
const getRecords = catchAsync(async (req, res) => {
  const result = await recordService.getRecords(req.user._id, req.query);
  res.status(200).json({ success: true, data: result });
});

/* GET /records/ai-summary */
const getAiSummary = catchAsync(async (req, res) => {
  const summary = await recordService.getAiSummary(req.user._id);
  res.status(200).json({ success: true, data: { summary } });
});

/* GET /records/:id */
const getRecordById = catchAsync(async (req, res) => {
  const record = await recordService.getRecordById(req.params.id, req.user._id);
  res.status(200).json({ success: true, data: { record } });
});

/* POST /records */
const createRecord = catchAsync(async (req, res) => {
  const uploadedFile = req.uploadedFile || null;
  const record = await recordService.createRecord(req.user._id, req.body, uploadedFile);
  res.status(201).json({
    success: true,
    message: 'Health record created',
    data: { record },
  });
});

/* PUT /records/:id */
const updateRecord = catchAsync(async (req, res) => {
  const record = await recordService.updateRecord(
    req.params.id,
    req.user._id,
    req.body
  );
  res.status(200).json({ success: true, data: { record } });
});

/* DELETE /records/:id */
const deleteRecord = catchAsync(async (req, res) => {
  await recordService.deleteRecord(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: 'Health record deleted' });
});

/* POST /records/:id/share */
const shareRecord = catchAsync(async (req, res) => {
  const { doctorId } = req.body;
  if (!doctorId) throw new AppError('doctorId is required', 400);
  const record = await recordService.shareRecord(
    req.params.id,
    req.user._id,
    doctorId
  );
  res.status(200).json({
    success: true,
    message: 'Record shared with doctor',
    data: { record },
  });
});

/* POST /records/:id/reanalyze */
const reanalyzeRecord = catchAsync(async (req, res) => {
  const record = await recordService.reanalyzeRecord(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    message: 'Medical analysis refreshed',
    data: { record },
  });
});

/* ════════════════════════════════════════
   NEW: EXTRACT PREVIEW (no DB save)
   POST /records/extract-preview
   ════════════════════════════════════════ */
const extractPreview = catchAsync(async (req, res) => {
  const file = req.uploadedFile;

  if (!file || !file._buffer) {
    throw new AppError('No file uploaded. Please attach a file to extract medical data.', 400);
  }

  const { mimetype, originalname } = file;
  const EXTRACTABLE = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!EXTRACTABLE.includes(mimetype)) {
    throw new AppError(`File type "${mimetype}" is not supported for AI extraction. Use PDF, JPG, or PNG.`, 400);
  }

  const recordType = req.body?.type || 'other';

  logger.info(`Extract-preview request: user=${req.user._id}, file="${originalname}", type=${recordType}`);

  const result = await recordService.extractPreviewFromBuffer(
    file._buffer,
    mimetype,
    recordType
  );

  /* Clean up buffer — not needed after extraction */
  delete file._buffer;

  res.status(200).json({
    success: true,
    message: 'AI extraction complete. Please review and confirm.',
    data: {
      extractedText:    result.extractedText,
      extractionMethod: result.extractionMethod,
      ocrConfidence:    result.ocrConfidence,
      pageCount:        result.pageCount,
      analysis:         result.analysis,
      /* Metadata about uploaded file (for the confirm-save step) */
      fileInfo: {
        secure_url:        file.secure_url        || null,
        public_id:         file.public_id         || null,
        original_filename: file.original_filename || originalname,
        bytes:             file.bytes             || 0,
        mimetype,
        originalname,
      },
    },
  });
});

/* ════════════════════════════════════════
   NEW: CONFIRM SAVE (user-confirmed record)
   POST /records/confirm-save
   ════════════════════════════════════════ */
const confirmSave = catchAsync(async (req, res) => {
  const {
    title,
    type,
    date,
    description,
    tags,
    notes,
    extractedData,      // AI extraction result (from extract-preview response)
    userCorrections,    // array of { field, aiValue, userValue }
    confirmedFields,    // user-edited final values
    fileInfo,           // Cloudinary file info from extract-preview response
  } = req.body;

  if (!title?.trim()) throw new AppError('Record title is required.', 400);
  if (!date)          throw new AppError('Record date is required.', 400);

  /* Reconstruct uploadedFile-like object from fileInfo (no re-upload needed) */
  /* MED-07: Validate that the secure_url belongs to our Cloudinary account.
     The client sends fileInfo back from the extract-preview response. An attacker
     could substitute a different URL. Reject any URL not from our CDN origin. */
  let uploadedFile = null;
  if (fileInfo?.secure_url) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const isValidCloudinaryUrl = cloudName
      ? fileInfo.secure_url.startsWith(`https://res.cloudinary.com/${cloudName}/`)
      : true; // skip check if Cloudinary not configured (dev mode)

    if (!isValidCloudinaryUrl) {
      throw new AppError('Invalid file URL: must be from your Cloudinary account.', 400);
    }

    uploadedFile = {
      secure_url:         fileInfo.secure_url,
      public_id:          fileInfo.public_id,
      original_filename:  fileInfo.original_filename,
      bytes:              fileInfo.bytes,
      mimetype:           fileInfo.mimetype,
      originalname:       fileInfo.originalname,
    };
  }


  const record = await recordService.createConfirmedRecord(
    req.user._id,
    { title, type, date, description, tags, notes },
    uploadedFile,
    extractedData,
    Array.isArray(userCorrections) ? userCorrections : [],
    confirmedFields || {}
  );

  /* Generate doctor summary in background (non-blocking) */
  recordService.generateAndSaveDoctorSummary(record._id, req.user._id)
    .catch((err) => logger.warn(`Background doctor summary failed for ${record._id}: ${err.message}`));

  res.status(201).json({
    success: true,
    message: 'Record saved and confirmed successfully',
    data: { record },
  });
});

/* ════════════════════════════════════════
   NEW: DOCTOR SUMMARY
   POST /records/:id/doctor-summary — generate/regenerate
   GET  /records/:id/doctor-summary — fetch
   ════════════════════════════════════════ */
const generateDoctorSummary = catchAsync(async (req, res) => {
  const { record, doctorSummary } = await recordService.generateAndSaveDoctorSummary(
    req.params.id,
    req.user._id
  );
  res.status(200).json({
    success: true,
    message: 'Doctor summary generated',
    data: { doctorSummary, recordId: record._id },
  });
});

const getDoctorSummaryById = catchAsync(async (req, res) => {
  const doctorSummary = await recordService.getDoctorSummary(
    req.params.id,
    req.user._id
  );
  res.status(200).json({
    success: true,
    data: { doctorSummary },
  });
});

module.exports = {
  getRecords,
  getAiSummary,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  shareRecord,
  reanalyzeRecord,
  extractPreview,
  confirmSave,
  generateDoctorSummary,
  getDoctorSummaryById,
};
