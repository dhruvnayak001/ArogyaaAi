/**
 * utils/AppError.js
 * Custom error class for operational errors
 * Differentiates operational errors (expected) from programming bugs
 */

'use strict';

class AppError extends Error {
  /**
   * @param {string} message  - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {Array}  errors   - Optional array of field-level errors
   */
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.statusCode    = statusCode;
    this.status        = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Marks as expected operational error
    this.errors        = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
