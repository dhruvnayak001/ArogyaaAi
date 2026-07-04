/**
 * middleware/errorHandler.js
 * Centralized Express error handling middleware
 * Normalizes all errors to a consistent JSON response shape
 */

'use strict';

const logger = require('../config/logger');

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message || 'Internal server error';
  let errors     = err.errors || [];

  /* ── Mongoose: Validation error ── */
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message    = 'Validation failed';
    errors     = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
  }

  /* ── Mongoose: Duplicate key ── */
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  /* ── Mongoose: Cast error (invalid ObjectId) ── */
  if (err.name === 'CastError') {
    statusCode = 400;
    message    = `Invalid ${err.path}: '${err.value}'`;
  }

  /* ── JWT errors ── */
  if (err.name === 'JsonWebTokenError')  { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError')  { statusCode = 401; message = 'Token expired'; }
  if (err.name === 'NotBeforeError')     { statusCode = 401; message = 'Token not active'; }

  /* ── Log errors ── */
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} — ${statusCode}:`, {
      message:   err.message,
      stack:     err.stack,
      userId:    req.user?.id,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} — ${statusCode}: ${message}`);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
