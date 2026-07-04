/**
 * routes/ai.routes.js
 * Standalone AI endpoints — medical summaries, quick analysis, consultation brief
 */

'use strict';

const express      = require('express');
const router       = express.Router();
const { protect }  = require('../middleware/auth.middleware');
const catchAsync   = require('../utils/catchAsync');
const geminiSvc    = require('../services/gemini.service');
const HealthRecord = require('../models/HealthRecord.model');
const { body }     = require('express-validator');
const validate     = require('../middleware/validate.middleware');
const logger       = require('../config/logger');


router.use(protect);

/**
 * POST /ai/summarize
 * Summarize arbitrary medical text (e.g. a pasted lab report)
 */
router.post('/summarize',
  body('text').trim().notEmpty().withMessage('Text to summarize is required')
    .isLength({ min: 20, max: 10000 }),
  validate,
  catchAsync(async (req, res) => {
    const { text } = req.body;
    const patientInfo = {
      name:       req.user.name,
      age:        req.user.age,
      bloodGroup: req.user.bloodGroup,
    };
    const summary = await geminiSvc.generateMedicalSummary(text, patientInfo);
    res.status(200).json({ success: true, data: { summary } });
  })
);

/**
 * POST /ai/title
 * Generate a session title from a prompt (internal use)
 */
router.post('/title',
  body('text').trim().notEmpty().isLength({ max: 200 }),
  validate,
  catchAsync(async (req, res) => {
    const title = await geminiSvc.generateSessionTitle(req.body.text);
    res.status(200).json({ success: true, data: { title } });
  })
);

/**
 * POST /ai/consultation-brief
 *
 * Generate an AI Pre-Consultation Copilot brief.
 * Called from the booking wizard BEFORE finalising the appointment.
 *
 * Body:
 *  {
 *    symptomText:      string  — patient's symptom description (any language)
 *    symptomTranscript: string — raw voice transcript (optional)
 *    reportIds:        [ObjectId] — IDs of existing HealthRecord docs to include
 *  }
 */
router.post('/consultation-brief',
  [
    body('symptomText')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 5000 }),
    body('symptomTranscript')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 5000 }),
    body('reportIds')
      .optional()
      .isArray({ max: 10 }),
  ],
  validate,
  catchAsync(async (req, res) => {
    const { symptomText = '', symptomTranscript = '', reportIds = [] } = req.body;

    /* Fetch analysis data from linked health records */
    let reportAnalyses = [];
    if (reportIds.length > 0) {
      const records = await HealthRecord.find({
        _id:  { $in: reportIds },
        user: req.user._id,           // security: only the patient's own records (field is 'user' in HealthRecord schema)
      })
        .select('analysis type title')
        .lean();

      reportAnalyses = records.map((r) => ({
        type:     r.type,
        title:    r.title,
        summary:  r.analysis?.summary,
        severity: r.analysis?.severity,
        abnormal: r.analysis?.abnormalFindings || [],
        values:   r.analysis?.extractedValues  || {},
        conditions: r.analysis?.detectedConditions || [],
      }));
    }

    const patientInfo = {
      name:              req.user.name,
      age:               req.user.age,
      gender:            req.user.gender,
      bloodGroup:        req.user.bloodGroup,
      chronicConditions: req.user.chronicConditions || [],
    };

    /* Generate consultation brief — wrap in try/catch so booking is NEVER blocked */
    let brief = null;
    try {
      brief = await geminiSvc.generateConsultationBrief({
        symptomText,
        symptomTranscript,
        reportAnalyses,
        patientInfo,
      });
    } catch (briefErr) {
      /* Log but don't propagate — booking must proceed even if AI fails */
      logger.warn(`[ai.routes] consultationBrief generation failed (non-fatal): ${briefErr.message}`);
      brief = null;
    }

    res.status(200).json({ success: true, data: { brief } });
  })
);

module.exports = router;
