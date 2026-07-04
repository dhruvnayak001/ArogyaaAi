/**
 * config/logger.js
 * Winston logger configuration
 * Outputs structured JSON in production, human-readable in dev
 */

'use strict';

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');  // registers DailyRotateFile transport

const { combine, timestamp, printf, colorize, json, errors } = format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) =>
    stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`
  )
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level:       process.env.LOG_LEVEL || 'info',
  format:      process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    ...(process.env.NODE_ENV === 'production'
      ? [
          /* Rotating error log — max 100 MB per file, 14-day retention */
          new transports.DailyRotateFile({
            filename:     'logs/error-%DATE%.log',
            datePattern:  'YYYY-MM-DD',
            level:        'error',
            maxSize:      '100m',
            maxFiles:     '14d',
            zippedArchive: true,
          }),
          /* Rotating combined log — max 100 MB per file, 14-day retention */
          new transports.DailyRotateFile({
            filename:     'logs/combined-%DATE%.log',
            datePattern:  'YYYY-MM-DD',
            maxSize:      '100m',
            maxFiles:     '14d',
            zippedArchive: true,
          }),
        ]
      : []),
  ],
  exitOnError: false,
});

module.exports = logger;
