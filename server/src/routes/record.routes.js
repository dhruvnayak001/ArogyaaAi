/**
 * routes/record.routes.js
 *
 * Route table:
 *  GET    /api/v1/records                    → getRecords
 *  GET    /api/v1/records/ai-summary         → getAiSummary
 *  POST   /api/v1/records                    → createRecord  (multipart, field: "file") [legacy]
 *  GET    /api/v1/records/:id                → getRecordById
 *  PUT    /api/v1/records/:id                → updateRecord
 *  DELETE /api/v1/records/:id                → deleteRecord
 *  POST   /api/v1/records/:id/share          → shareRecord
 *  POST   /api/v1/records/:id/reanalyze      → reanalyzeRecord
 *  GET    /api/v1/records/:id/download       → download (stub)
 *
 * NEW (Extraction Confirmation Flow):
 *  POST   /api/v1/records/extract-preview    → extractPreview  (multipart, no DB save)
 *  POST   /api/v1/records/confirm-save       → confirmSave (JSON, saves after confirmation)
 *  GET    /api/v1/records/:id/doctor-summary → getDoctorSummaryById
 *  POST   /api/v1/records/:id/doctor-summary → generateDoctorSummary
 *
 * Upload standard:
 *  - Frontend: formData.append("file", file)       ← single file
 *  - Multer:   upload.single("file")               ← field name "file"
 *  - Controller: req.uploadedFile                  ← set by upload.middleware.js
 */

'use strict';

const express     = require('express');
const router      = express.Router();
const recordCtrl  = require('../controllers/record.controller');
const { protect } = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');
const validate    = require('../middleware/validate.middleware');

/* Centralised upload: multer("file") → Cloudinary → req.uploadedFile */
const { uploadFile, uploadFilePreview } = require('../middleware/upload.middleware');

router.use(protect);

/* GET /ai-summary — must be before /:id */
router.get('/ai-summary', recordCtrl.getAiSummary);

/* ════════════════════════════════════════
   NEW: Extract preview (no DB save)
   Must be BEFORE /:id routes
   ════════════════════════════════════════ */
router.post(
  '/extract-preview',
  uploadFilePreview,            // multer + Cloudinary upload (keeps buffer)
  recordCtrl.extractPreview
);

/* ════════════════════════════════════════
   NEW: Confirm-save (JSON body, no file)
   ════════════════════════════════════════ */
router.post(
  '/confirm-save',
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('type').optional().isIn([
    'lab_report', 'prescription', 'scan',
    'discharge_summary', 'vaccination', 'allergy_report', 'other',
  ]),
  validate,
  recordCtrl.confirmSave
);

/* GET / */
router.get('/', recordCtrl.getRecords);

/* POST / — multipart, field name MUST be "file" [legacy] */
router.post(
  '/',
  uploadFile,
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('type').optional().isIn([
    'lab_report', 'prescription', 'scan',
    'discharge_summary', 'vaccination', 'allergy_report', 'other',
  ]),
  validate,
  recordCtrl.createRecord
);

/* GET /:id */
router.get('/:id',
  param('id').isMongoId(),
  validate,
  recordCtrl.getRecordById
);

/* PUT /:id */
router.put('/:id',
  param('id').isMongoId(),
  validate,
  recordCtrl.updateRecord
);

/* DELETE /:id */
router.delete('/:id',
  param('id').isMongoId(),
  validate,
  recordCtrl.deleteRecord
);

/* POST /:id/share */
router.post('/:id/share',
  param('id').isMongoId(),
  body('doctorId').isMongoId().withMessage('Valid doctor ID is required'),
  validate,
  recordCtrl.shareRecord
);

/* POST /:id/reanalyze — re-run AI analysis on stored extractedText */
router.post('/:id/reanalyze',
  param('id').isMongoId(),
  validate,
  recordCtrl.reanalyzeRecord
);

/* GET /:id/doctor-summary — fetch doctor summary */
router.get('/:id/doctor-summary',
  param('id').isMongoId(),
  validate,
  recordCtrl.getDoctorSummaryById
);

/* POST /:id/doctor-summary — generate / regenerate */
router.post('/:id/doctor-summary',
  param('id').isMongoId(),
  validate,
  recordCtrl.generateDoctorSummary
);

/* GET /:id/download */
router.get('/:id/download',
  param('id').isMongoId(),
  validate,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Download — use fileUrl from record.files[0].url directly',
      data: { recordId: req.params.id },
    });
  }
);

module.exports = router;
