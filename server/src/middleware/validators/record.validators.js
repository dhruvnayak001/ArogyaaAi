/**
 * middleware/validators/record.validators.js
 * Validators for health record endpoints
 */

'use strict';

const { body, param } = require('express-validator');

const VALID_RECORD_TYPES = [
  'lab_report', 'prescription', 'scan',
  'discharge_summary', 'vaccination', 'allergy_report', 'other',
];

const validateCreateRecord = [
  body('title')
    .trim()
    .notEmpty().withMessage('Record title is required')
    .isLength({ max: 200 }).withMessage('Title must be under 200 characters'),
  body('type')
    .optional()
    .isIn(VALID_RECORD_TYPES)
    .withMessage(`Type must be one of: ${VALID_RECORD_TYPES.join(', ')}`),
  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }),
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),
];

const validateUpdateRecord = [
  param('id').isMongoId().withMessage('Invalid record ID'),
  body('title')
    .optional().trim()
    .isLength({ max: 200 }),
  body('type')
    .optional()
    .isIn(VALID_RECORD_TYPES),
];

const validateShareRecord = [
  param('id').isMongoId().withMessage('Invalid record ID'),
  body('doctorId')
    .notEmpty().withMessage('Doctor ID is required')
    .isMongoId().withMessage('Invalid doctor ID'),
];

module.exports = {
  validateCreateRecord,
  validateUpdateRecord,
  validateShareRecord,
};
