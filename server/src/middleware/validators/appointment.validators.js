/**
 * middleware/validators/appointment.validators.js
 * Additional validators for appointment-specific fields
 */

'use strict';

const { body, param, query } = require('express-validator');

const validateBookAppointment = [
  body('doctorId')
    .notEmpty().isMongoId().withMessage('Valid doctor ID is required'),
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid ISO 8601 date')
    .custom((val) => {
      if (new Date(val) < new Date()) {
        throw new Error('Appointment date must be in the future');
      }
      return true;
    }),
  body('time')
    .notEmpty().withMessage('Time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be HH:MM format'),
  body('reason')
    .trim().notEmpty().withMessage('Reason is required')
    .isLength({ max: 500 }).withMessage('Reason must be under 500 characters'),
  body('type')
    .optional()
    .isIn(['in-person', 'video', 'phone'])
    .withMessage('Type must be in-person, video, or phone'),
  body('symptoms')
    .optional()
    .isArray().withMessage('Symptoms must be an array'),
];

const validateUpdateStatus = [
  param('id').isMongoId().withMessage('Invalid appointment ID'),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['confirmed', 'completed', 'cancelled'])
    .withMessage('Status must be confirmed, completed, or cancelled'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }),
];

const validateGetSlots = [
  param('doctorId').isMongoId().withMessage('Invalid doctor ID'),
  query('date')
    .notEmpty().withMessage('Date query parameter is required')
    .isISO8601().withMessage('Date must be a valid ISO 8601 date'),
];

module.exports = {
  validateBookAppointment,
  validateUpdateStatus,
  validateGetSlots,
};
