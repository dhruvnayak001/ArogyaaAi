/**
 * routes/emergency.routes.js
 * Emergency analysis endpoint — re-exports chat's analyzeEmergency
 * with its own rate limiting (stricter — 10 req/15min)
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const rateLimit  = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const catchAsync = require('../utils/catchAsync');
const geminiSvc  = require('../services/gemini.service');
const { body }   = require('express-validator');
const validate   = require('../middleware/validate.middleware');
const logger     = require('../config/logger');
const { detectEmergencyKeywords } = require('../utils/emergencyKeywords');

const emergencyLimiter = rateLimit({
  windowMs:     15 * 60 * 1000,
  max:          10,
  message: { success: false, message: 'Too many emergency requests. If this is an emergency, call 112.' },
});

/* POST /emergency/analyze */
router.post('/analyze',
  emergencyLimiter,
  protect,
  body('symptoms').trim().notEmpty().withMessage('Symptoms are required')
    .isLength({ max: 2000 }),
  validate,
  catchAsync(async (req, res) => {
    const { symptoms, vitals, conditions, age } = req.body;

    /* Multilingual pre-check: synchronous keyword scan before the Gemini round-trip.
       Covers English, Hindi (Devanagari + romanised), and Marathi (Devanagari + romanised).
       Does NOT alter the response shape — purely for logging and prompt enrichment. */
    const kwMatch = detectEmergencyKeywords(symptoms);
    if (kwMatch.detected) {
      logger.warn(
        `[EMERGENCY] Multilingual keyword match: "${kwMatch.matchedKeyword}" ` +
        `— user=${req.user?._id}, escalating to Gemini triage`
      );
    }

    const analysis = await geminiSvc.analyzeEmergency(symptoms, {
      vitals,
      conditions,
      age: age || req.user?.age,
      /* Pass the local-detection hint so Gemini can factor it into its reasoning */
      localKeywordDetected: kwMatch.detected ? kwMatch.matchedKeyword : null,
    });
    res.status(200).json({ success: true, data: { analysis } });
  })
);

module.exports = router;
