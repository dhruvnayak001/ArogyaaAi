/**
 * utils/catchAsync.js
 * Wraps async route handlers to automatically forward errors to next()
 * Eliminates try/catch boilerplate in every controller
 */

'use strict';

/**
 * @param {Function} fn - Async express route handler
 * @returns {Function} Wrapped handler that catches rejections
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
