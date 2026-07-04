/**
 * config/db.js
 * MongoDB Atlas connection with mongoose
 * Includes retry logic and connection event logging
 */

'use strict';

const mongoose = require('mongoose');
const logger   = require('./logger');

const MONGODB_URI = process.env.MONGODB_URI;

/* ── Event Loop Audit: Mongoose Slow Query Profiler ──────────────────────────
   Registered at MODULE SCOPE (not inside connectDB) so it runs exactly once.
   If placed inside connectDB(), it re-registers on every MongoDB reconnect,
   causing pre/post hooks to fire multiple times per query.
   ────────────────────────────────────────────────────────────────────────── */
mongoose.plugin((schema) => {
  /* 'aggregate' and 'save' hooks use a different 'this' context and cannot
     reliably track startTime with the generic query-hook pattern below.
     - save: 'this' in pre/post is the document, not a query object.
     - aggregate: handled separately below with Aggregate-level hooks.
     Only query-based operations are safe to instrument here. */
  const methods = ['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'updateMany', 'countDocuments'];
  methods.forEach((method) => {
    schema.pre(method, function () {
      this._profilerStart = performance.now();
    });
    schema.post(method, function (res, next) {
      if (this._profilerStart) {
        const duration = performance.now() - this._profilerStart;
        if (duration > 2000) {
          const col = this.mongooseCollection ? this.mongooseCollection.name : 'unknown';
          logger.warn(`[SLOW QUERY] ${col}.${method} took ${duration.toFixed(2)}ms`);
        }
      }
      if (typeof next === 'function') next();
    });
  });

  /* Aggregate timing — Aggregate hooks use 'this' = the Aggregate instance.
     We read the collection from this.model().collection.name instead of
     this.mongooseCollection which does not exist on Aggregate objects. */
  schema.pre('aggregate', function () {
    this._profilerStart = performance.now();
  });
  schema.post('aggregate', function (res, next) {
    if (this._profilerStart) {
      const duration = performance.now() - this._profilerStart;
      if (duration > 2000) {
        /* model() is available on Aggregate; fall back gracefully */
        const col = (this.model && this.model().collection)
          ? this.model().collection.name
          : 'unknown';
        logger.warn(`[SLOW QUERY] ${col}.aggregate took ${duration.toFixed(2)}ms`);
      }
    }
    if (typeof next === 'function') next();
  });
});

const connectDB = async () => {
  if (!MONGODB_URI) {
    logger.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  const options = {
    maxPoolSize:               10,     // Maintain up to 10 socket connections
    serverSelectionTimeoutMS:  10000, // Increased: handle Atlas replica failovers (was 5000)
    socketTimeoutMS:           45000, // Close sockets after 45s of inactivity
    heartbeatFrequencyMS:      10000, // Ping Atlas every 10s to detect disconnect early
  };

  try {
    const conn = await mongoose.connect(MONGODB_URI, options);
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`❌ MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

/* Connection event handlers */
mongoose.connection.on('connected',    () => logger.info('Mongoose: connected'));
mongoose.connection.on('reconnected',  () => logger.info('Mongoose: reconnected successfully'));
mongoose.connection.on('disconnected', () => logger.warn('Mongoose: disconnected — will auto-reconnect'));
mongoose.connection.on('error',        (err) => logger.error(`Mongoose error: ${err.message}`));

module.exports = connectDB;
