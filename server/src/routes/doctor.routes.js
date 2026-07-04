/**
 * routes/doctor.routes.js
 *
 * Route table:
 *  GET  /api/v1/doctors                           → searchDoctors (public)
 *  GET  /api/v1/doctors/specializations           → getSpecializations (public)
 *  GET  /api/v1/doctors/profile                   → getOwnProfile (doctor)
 *  PUT  /api/v1/doctors/profile                   → updateProfile (doctor)
 *  PUT  /api/v1/doctors/availability              → updateAvailability (doctor)
 *  GET  /api/v1/doctors/patients                  → getMyPatients (doctor)
 *  GET  /api/v1/doctors/patients/:patientId/records → getPatientRecords (doctor)
 *  GET  /api/v1/doctors/:id                       → getDoctorById (public)
 */

'use strict';

const express         = require('express');
const router          = express.Router();
const doctorCtrl      = require('../controllers/doctor.controller');
const { protect, authorize, optionalAuth } = require('../middleware/auth.middleware');
const { param, body } = require('express-validator');
const validate        = require('../middleware/validate.middleware');

/* ── Public routes ── */
router.get('/',                optionalAuth, doctorCtrl.searchDoctors);
router.get('/specializations', doctorCtrl.getSpecializations);

/* ── Doctor-only protected routes (specific paths before /:id) ── */
router.get('/profile',
  protect,
  authorize('doctor'),
  doctorCtrl.getOwnProfile
);

router.put('/profile',
  protect,
  authorize('doctor'),
  doctorCtrl.updateProfile
);

router.put('/availability',
  protect,
  authorize('doctor'),
  [
    body('days').isArray().withMessage('Days must be an array'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('startTime must be HH:MM'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('endTime must be HH:MM'),
    body('slotDuration').isInt({ min: 10, max: 120 }).withMessage('slotDuration must be 10–120 min'),
  ],
  validate,
  doctorCtrl.updateAvailability
);

router.put('/consultation-modes',
  protect,
  authorize('doctor'),
  [
    body('modes').isArray({ min: 0, max: 4 }).withMessage('Modes must be an array'),
    body('modes.*.mode').isIn(['video', 'voice', 'clinic', 'home']).withMessage('Invalid mode'),
    body('modes.*.fee').isFloat({ min: 0 }).withMessage('Fee must be non-negative'),
    body('modes.*.duration').isInt({ min: 10, max: 180 }).withMessage('Duration must be 10–180 min'),
    body('modes.*.enabled').isBoolean(),
  ],
  validate,
  doctorCtrl.updateConsultationModes
);

router.put('/cancellation-policy',
  protect,
  authorize('doctor'),
  [
    body('moreThan24h').isFloat({ min: 0, max: 100 }),
    body('between12and24h').isFloat({ min: 0, max: 100 }),
    body('lessThan12h').isFloat({ min: 0, max: 100 }),
  ],
  validate,
  doctorCtrl.updateCancellationPolicy
);

router.get('/patients',
  protect,
  authorize('doctor'),
  doctorCtrl.getMyPatients
);

router.get('/patients/:patientId/records',
  protect,
  authorize('doctor'),
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  validate,
  doctorCtrl.getPatientRecords
);

/* NEW: Patient 360 AI Command Center */
router.get('/patients/:patientId/360',
  protect,
  authorize('doctor'),
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  validate,
  doctorCtrl.getPatient360
);

/* ── Public single doctor (after specific paths) ── */
router.get('/:id',
  param('id').isMongoId().withMessage('Invalid doctor ID'),
  validate,
  doctorCtrl.getDoctorById
);

module.exports = router;
