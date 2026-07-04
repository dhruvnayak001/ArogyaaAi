/**
 * routes/appointment.routes.js
 *
 * Route table:
 *  GET    /api/v1/appointments                    → getAppointments
 *  GET    /api/v1/appointments/upcoming           → getUpcoming
 *  POST   /api/v1/appointments                    → bookAppointment  (patient)
 *  GET    /api/v1/appointments/slots/:doctorId    → getAvailableSlots
 *  GET    /api/v1/appointments/:id                → getAppointmentById
 *  PUT    /api/v1/appointments/:id                → updateAppointment (patient)
 *  PATCH  /api/v1/appointments/:id/status         → updateStatus     (doctor)
 *  PATCH  /api/v1/appointments/:id/cancel         → cancelAppointment (patient)
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const apptCtrl   = require('../controllers/appointment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { body, param, query } = require('express-validator');
const validate   = require('../middleware/validate.middleware');

router.use(protect);

/* Specific paths BEFORE /:id to avoid conflicts */
router.get('/upcoming', apptCtrl.getUpcoming);

router.get('/slots/:doctorId',
  param('doctorId').isMongoId().withMessage('Invalid doctor ID'),
  query('date').notEmpty().withMessage('Date query param is required').isISO8601(),
  validate,
  apptCtrl.getAvailableSlots
);

/* Root — list & book */
router.get('/', apptCtrl.getAppointments);

router.post('/',
  authorize('patient'),
  [
    body('doctorId').isMongoId().withMessage('Valid doctor ID is required'),
    body('date').notEmpty().isISO8601().withMessage('Valid date is required'),
    body('time')
      .notEmpty().withMessage('Time is required')
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be HH:MM format'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
      .isLength({ max: 500 }),
    body('type').optional().isIn(['in-person', 'video', 'phone', 'clinic', 'voice', 'home']),
    body('consultationType').optional().isIn(['video', 'voice', 'clinic', 'home']).withMessage('consultationType must be video, voice, clinic, or home'),
    body('symptoms').optional().isArray({ max: 20 }),
    body('symptoms.*').optional().isString().isLength({ max: 200 }),
    body('symptomTranscript').optional({ checkFalsy: true }).isString().isLength({ max: 5000 }),
    body('uploadedReportIds').optional().isArray({ max: 10 }),
    body('uploadedReportIds.*').optional().isMongoId(),
    /* aiConsultationBrief — validate known safe fields only (prevent mass assignment) */
    body('aiConsultationBrief').optional().isObject(),
    body('aiConsultationBrief.summaryText').optional().isString().isLength({ max: 2000 }),
    body('aiConsultationBrief.urgencyLevel').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    body('aiConsultationBrief.symptoms').optional().isArray({ max: 30 }),
    body('aiConsultationBrief.symptoms.*').optional().isString().isLength({ max: 200 }),
    body('aiConsultationBrief.findings').optional().isArray({ max: 20 }),
    body('aiConsultationBrief.findings.*').optional().isString().isLength({ max: 500 }),
    body('aiConsultationBrief.suggestedFocusAreas').optional().isArray({ max: 10 }),
    body('aiConsultationBrief.suggestedFocusAreas.*').optional().isString().isLength({ max: 300 }),
    body('aiConsultationBrief.recommendedSpecialty').optional().isString().isLength({ max: 100 }),
    body('aiConsultationBrief.aiConfidence').optional().isFloat({ min: 0, max: 100 }),
    body('aiConsultationBrief.symptomTimeline').optional().isString().isLength({ max: 200 }),
    body('aiConsultationBrief.disclaimer').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  apptCtrl.bookAppointment
);

/* Single appointment */
router.get('/:id',
  param('id').isMongoId(),
  validate,
  apptCtrl.getAppointmentById
);

router.put('/:id',
  authorize('patient'),
  param('id').isMongoId(),
  validate,
  apptCtrl.updateAppointment
);

router.patch('/:id/status',
  authorize('doctor'),
  param('id').isMongoId(),
  body('status').isIn(['confirmed', 'completed', 'cancelled'])
    .withMessage('Status must be confirmed, completed, or cancelled'),
  validate,
  apptCtrl.updateStatus
);

router.patch('/:id/cancel',
  authorize('patient'),
  param('id').isMongoId(),
  validate,
  apptCtrl.cancelAppointment
);

module.exports = router;
