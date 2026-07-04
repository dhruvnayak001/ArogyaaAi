/**
 * middleware/validate.middleware.js
 * Express-validator result handler middleware
 */

'use strict';

const { validationResult } = require('express-validator');

/**
 * Runs after validation chains — returns 422 with field errors if invalid
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map((e) => ({
        field:   e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = validate;
