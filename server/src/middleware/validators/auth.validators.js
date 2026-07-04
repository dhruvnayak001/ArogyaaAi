/**
 * middleware/validators/auth.validators.js
 * Express-validator chains for all auth endpoints
 * Used as middleware arrays in auth.routes.js
 */

'use strict';

const { body } = require('express-validator');

/* ────────────────────────────────────────
   Reusable field validators
   ──────────────────────────────────────── */

const emailField = () =>
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail({ gmail_remove_dots: false });

const passwordField = (fieldName = 'password') =>
  body(fieldName)
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number');

const nameField = () =>
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
    .isLength({ max: 60 }).withMessage('Name cannot exceed 60 characters');

/* ────────────────────────────────────────
   Exported validator chains
   ──────────────────────────────────────── */

/**
 * POST /auth/register
 */
const validateRegister = [
  nameField(),
  emailField(),
  passwordField(),
  body('role')
    .optional()
    .isIn(['patient', 'doctor'])
    .withMessage('Role must be either "patient" or "doctor"'),
];

/**
 * POST /auth/login
 */
const validateLogin = [
  emailField(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

/**
 * POST /auth/forgot-password
 */
const validateForgotPassword = [
  emailField(),
];

/**
 * POST /auth/reset-password
 */
const validateResetPassword = [
  body('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token format'),
  passwordField(),
  body('confirmPassword')
    .optional()
    .custom((value, { req }) => {
      if (value && value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

/**
 * POST /auth/change-password  (authenticated)
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  passwordField('newPassword'),
];

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
};
