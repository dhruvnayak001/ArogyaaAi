/**
 * middleware/notFound.js
 * 404 handler for unmatched routes
 */

'use strict';

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = notFound;
