/**
 * queues/index.js
 * BullMQ queue registry — email, AI processing, notifications.
 *
 * All three queues share the single ioredis connection created by config/redis.js.
 * When REDIS_URL is not set, getRedisClient() returns null and createQueue() returns
 * null — all enqueue() calls fall back to inline (synchronous) execution so existing
 * behaviour is completely preserved for local dev.
 *
 * Queue design:
 *   emailQueue        — Nodemailer sends (fire-and-forget, at-most-once)
 *   aiQueue           — Gemini API calls that can be deferred (doctor summary, reanalysis)
 *   notificationQueue — MongoDB Notification.create (idempotent, low-urgency)
 *
 * Worker processes for all three queues are started in queues/worker.js, which
 * must be launched as a separate process or imported once at server startup.
 */

'use strict';

const { Queue } = require('bullmq');
const logger    = require('../config/logger');

let emailQueue        = null;
let aiQueue           = null;
let notificationQueue = null;
let refundQueue       = null;

/**
 * Initialise all BullMQ queues.
 * Called once from src/index.js after the DB connection is ready.
 * Safe to call when REDIS_URL is absent — returns without creating queues.
 */
const initQueues = () => {
  const { getRedisClient } = require('../config/redis');
  const redis = getRedisClient();

  if (!redis) {
    logger.warn(
      '[BullMQ] REDIS_URL not configured — background queues disabled; jobs run inline. ' +
      'Refunds will run inline with NO automatic retry — not recommended for production payment reliability.'
    );
    return;
  }

  /* BullMQ requires a connection factory, not a shared ioredis instance,
     because it calls .duplicate() internally. We pass the connection options
     directly from the env URL instead of reusing the singleton client. */
  const connection = { url: process.env.REDIS_URL };

  const queueOpts = {
    connection,
    defaultJobOptions: {
      attempts:        3,
      backoff:         { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail:    { count: 50 },
    },
  };

  emailQueue        = new Queue('arogyaai-email',        queueOpts);
  aiQueue           = new Queue('arogyaai-ai',           queueOpts);
  notificationQueue = new Queue('arogyaai-notification', queueOpts);

  /* Refund jobs get their own defaultJobOptions: 3 attempts with exponential
     backoff (money-critical — retries recover from transient Razorpay/network
     errors without hammering the API). */
  refundQueue = new Queue('arogyaai-refund', {
    connection,
    defaultJobOptions: {
      attempts:        3,
      backoff:         { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 100 },
      removeOnFail:    { count: 100 },
    },
  });

  logger.info('[BullMQ] ✅ Queues initialised: email, ai, notification, refund');
};

/* ── Typed enqueue helpers ─────────────────────────────────────────────────
   Each function accepts a job payload, enqueues it when Redis is available,
   or calls the inline fallback when it is not.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * enqueueEmail
 * @param {{ to, subject, html, text? }} payload
 * @param {Function} inlineFallback — called when queue is not available
 */
const enqueueEmail = async (payload, inlineFallback) => {
  if (!emailQueue) {
    /* Graceful degradation: call inline immediately (existing behaviour) */
    return inlineFallback().catch((err) =>
      logger.warn(`[Email inline] ${err.message}`)
    );
  }
  try {
    await emailQueue.add('send', payload);
  } catch (err) {
    logger.warn(`[BullMQ email enqueue failed] ${err.message} — running inline`);
    return inlineFallback().catch(() => {});
  }
};

/**
 * enqueueAI
 * @param {string} jobName — e.g. 'doctor-summary', 'reanalyze'
 * @param {object} payload — job-specific data
 */
const enqueueAI = async (jobName, payload) => {
  if (!aiQueue) return null;
  try {
    return await aiQueue.add(jobName, payload);
  } catch (err) {
    logger.warn(`[BullMQ AI enqueue failed] ${err.message}`);
    return null;
  }
};

/**
 * enqueueNotification
 * @param {{ recipientId, type, title, message, data, link }} payload
 *
 * When the notification queue is unavailable (no Redis or enqueue error),
 * falls back to calling createNotification() inline — preserving existing behaviour.
 * Lazy require breaks any potential circular-dependency at startup.
 */
const enqueueNotification = async (payload) => {
  const { recipientId, type, title, message, data, link } = payload;

  const callInline = () => {
    /* Lazy require to avoid circular dependency at module-load time */
    const { createNotification } = require('../services/notification.service');
    return createNotification(recipientId, type, title, message, data, link)
      .catch((err) => logger.warn(`[Notification inline] ${err.message}`));
  };

  if (!notificationQueue) {
    /* Graceful degradation: execute inline (same as the original fire-and-forget) */
    return callInline();
  }

  try {
    return await notificationQueue.add('create', payload);
  } catch (err) {
    logger.warn(`[BullMQ notification enqueue failed] ${err.message} — running inline`);
    return callInline();
  }
};

/**
 * enqueueRefund
 * @param {{ appointmentId, reason? }} payload
 *
 * When the refund queue is unavailable (no Redis or enqueue error), falls back
 * to processing the refund inline — preserving functionality on single-instance/
 * dev deployments, but WITHOUT the retry/backoff protection the queue provides.
 * Uses a deterministic jobId (`refund-<appointmentId>`) so a second enqueue for
 * the same appointment while one is still queued/active is naturally deduped by
 * BullMQ instead of creating a duplicate refund attempt.
 */
const enqueueRefund = async (payload) => {
  const { appointmentId } = payload;

  const callInline = async () => {
    logger.warn(
      `[Refund inline] REDIS_URL not configured — processing refund for appointment ` +
      `${appointmentId} inline with NO automatic retry.`
    );
    /* Lazy require to avoid circular dependency at module-load time
       (payment.service.js requires this module for enqueueNotification). */
    const paymentService = require('../services/payment.service');
    try {
      await paymentService.processRefundJob(payload);
    } catch (err) {
      logger.error(
        `[Refund inline] Refund failed for appointment ${appointmentId} with no retry available: ${err.message}`
      );
      /* Best-effort — mark failed since there is no queue to retry it later. */
      const Appointment = require('../models/Appointment.model');
      await Appointment.findOneAndUpdate(
        { _id: appointmentId, refundStatus: { $ne: 'processed' } },
        { $set: { refundStatus: 'failed', refundFailReason: String(err.message).slice(0, 300) } }
      ).catch(() => {});
    }
  };

  if (!refundQueue) return callInline();

  try {
    return await refundQueue.add('refund', payload, { jobId: `refund-${appointmentId}` });
  } catch (err) {
    logger.warn(`[BullMQ refund enqueue failed] ${err.message} — running inline`);
    return callInline();
  }
};

module.exports = {
  initQueues,
  enqueueEmail,
  enqueueAI,
  enqueueNotification,
  enqueueRefund,
  /* Exposed for worker.js */
  getEmailQueue:        () => emailQueue,
  getAiQueue:           () => aiQueue,
  getNotificationQueue: () => notificationQueue,
  getRefundQueue:       () => refundQueue,
};
