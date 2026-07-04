/**
 * queues/workers/email.worker.js
 * BullMQ worker for the arogyaai:email queue.
 *
 * Each job payload mirrors the object accepted by sendEmail():
 *   { to, subject, html, text? }
 *
 * Retry strategy (set in queues/index.js defaultJobOptions):
 *   3 attempts, exponential backoff starting at 2 s.
 *
 * This module exports startEmailWorker() so callers can
 * start (and gracefully stop) the worker from src/index.js.
 */

'use strict';

const { Worker } = require('bullmq');
const { sendEmail } = require('../../utils/sendEmail');
const logger         = require('../../config/logger');

const QUEUE_NAME = 'arogyaai-email';

let worker = null;

/**
 * startEmailWorker
 * Starts the BullMQ worker listening on the email queue.
 * Safe to call when REDIS_URL is absent — returns null without throwing.
 *
 * @returns {Worker|null}
 */
const startEmailWorker = () => {
  if (!process.env.REDIS_URL) return null;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { to, subject, html, text } = job.data;
      logger.info(`[EmailWorker] job=${job.id} to=${to} subject="${subject}"`);

      await sendEmail({ to, subject, html, text });

      logger.info(`[EmailWorker] ✅ Sent job=${job.id} to=${to}`);
    },
    {
      connection: { url: process.env.REDIS_URL },
      concurrency: 5, // max 5 simultaneous SMTP calls
    }
  );

  worker.on('failed', (job, err) => {
    logger.warn(`[EmailWorker] ❌ job=${job?.id} attempt=${job?.attemptsMade} error="${err.message}"`);
  });

  worker.on('error', (err) => {
    logger.warn(`[EmailWorker] worker error: ${err.message}`);
  });

  logger.info('[EmailWorker] ✅ Started (concurrency=5)');
  return worker;
};

/**
 * stopEmailWorker
 * Gracefully drains in-flight jobs before shutdown.
 */
const stopEmailWorker = async () => {
  if (worker) {
    await worker.close();
    logger.info('[EmailWorker] stopped');
  }
};

module.exports = { startEmailWorker, stopEmailWorker };
