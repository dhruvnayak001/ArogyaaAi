/**
 * queues/workers/refund.worker.js
 * BullMQ worker for the arogyaai-refund queue.
 *
 * Each job payload: { appointmentId, reason? }
 *
 * Retry strategy (set in queues/index.js defaultJobOptions for this queue):
 *   3 attempts, exponential backoff starting at 3 s.
 *
 * The actual refund logic (idempotency checks + Razorpay call + atomic DB
 * update) lives in payment.service.processRefundJob() so it can be reused by
 * both this worker and the inline (no-Redis) fallback in queues/index.js.
 *
 * On the FINAL failed attempt (retries exhausted), the appointment is marked
 * refundStatus = 'failed' here so it surfaces for manual reconciliation —
 * individual retryable attempts do NOT flip the status, since a subsequent
 * attempt may still succeed.
 */

'use strict';

const { Worker } = require('bullmq');
const logger     = require('../../config/logger');

const QUEUE_NAME = 'arogyaai-refund';

let worker = null;

/**
 * startRefundWorker
 * Safe to call when REDIS_URL is absent — returns null without throwing.
 *
 * @returns {Worker|null}
 */
const startRefundWorker = () => {
  if (!process.env.REDIS_URL) return null;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { appointmentId } = job.data;
      logger.info(`[RefundWorker] job=${job.id} appointment=${appointmentId} attempt=${job.attemptsMade + 1}`);

      /* Lazy require to avoid circular dependency at module-load time. */
      const paymentService = require('../../services/payment.service');
      await paymentService.processRefundJob(job.data);

      logger.info(`[RefundWorker] ✅ Completed job=${job.id} appointment=${appointmentId}`);
    },
    {
      connection:  { url: process.env.REDIS_URL },
      concurrency: 3, // low concurrency — refunds are infrequent and money-sensitive
    }
  );

  worker.on('failed', async (job, err) => {
    logger.warn(
      `[RefundWorker] ❌ job=${job?.id} attempt=${job?.attemptsMade}/${job?.opts?.attempts} error="${err.message}"`
    );

    /* Only mark permanently 'failed' once every retry has been exhausted —
       an individual failed attempt may still succeed on the next retry. */
    if (job && job.attemptsMade >= (job.opts?.attempts || 1)) {
      try {
        const Appointment = require('../../models/Appointment.model');
        await Appointment.findOneAndUpdate(
          { _id: job.data.appointmentId, refundStatus: { $ne: 'processed' } },
          { $set: { refundStatus: 'failed', refundFailReason: String(err.message).slice(0, 300) } }
        );
        logger.error(
          `[RefundWorker] Refund permanently failed for appointment ${job.data.appointmentId} ` +
          `after ${job.attemptsMade} attempts — manual reconciliation required.`
        );
      } catch (dbErr) {
        logger.error(`[RefundWorker] Failed to persist refund failure state: ${dbErr.message}`);
      }
    }
  });

  worker.on('error', (err) => {
    logger.warn(`[RefundWorker] worker error: ${err.message}`);
  });

  logger.info('[RefundWorker] ✅ Started (concurrency=3)');
  return worker;
};

/**
 * stopRefundWorker
 * Gracefully drains in-flight jobs before shutdown.
 */
const stopRefundWorker = async () => {
  if (worker) {
    await worker.close();
    logger.info('[RefundWorker] stopped');
  }
};

module.exports = { startRefundWorker, stopRefundWorker };
