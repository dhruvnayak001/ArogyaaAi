/**
 * queues/workers/notification.worker.js
 * BullMQ worker for the arogyaai:notification queue.
 *
 * Each job payload mirrors the args accepted by createNotification():
 *   { recipientId, type, title, message, data, link }
 *
 * createNotification() upserts on `dedupeKey` when the job payload carries
 * enough context to build one (recipientId + type + data.appointmentId), so
 * a job retried after a stalled/crashed worker cannot create a duplicate
 * notification document.
 */

'use strict';

const { Worker }           = require('bullmq');
const { createNotification } = require('../../services/notification.service');
const logger               = require('../../config/logger');

const QUEUE_NAME = 'arogyaai-notification';

let worker = null;

/**
 * startNotificationWorker
 * @returns {Worker|null}
 */
const startNotificationWorker = () => {
  if (!process.env.REDIS_URL) return null;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { recipientId, type, title, message, data, link } = job.data;
      logger.info(`[NotifWorker] job=${job.id} type=${type} recipient=${recipientId}`);

      /* Build a dedupe key when the payload has enough context — prevents a
         duplicate notification if this job is retried after a stall. */
      const dedupeKey = data?.appointmentId
        ? `${recipientId}:${type}:${data.appointmentId}`
        : null;

      const notif = await createNotification(recipientId, type, title, message, data, link, dedupeKey);

      /* createNotification() swallows its own DB errors and returns null so
         fire-and-forget callers never throw. The queued path is different:
         BullMQ's retry/backoff only engages if this handler throws, so a
         null result here — meaning the write genuinely failed — must be
         surfaced as a job failure, or the notification is silently and
         permanently lost with the job still marked "completed". */
      if (!notif) {
        throw new Error(`createNotification returned null for recipient ${recipientId} (job=${job.id})`);
      }

      logger.info(`[NotifWorker] ✅ Created job=${job.id}`);
    },
    {
      connection: { url: process.env.REDIS_URL },
      concurrency: 10,
    }
  );

  worker.on('failed', (job, err) => {
    logger.warn(`[NotifWorker] ❌ job=${job?.id} attempt=${job?.attemptsMade} error="${err.message}"`);
  });

  worker.on('error', (err) => {
    logger.warn(`[NotifWorker] worker error: ${err.message}`);
  });

  logger.info('[NotifWorker] ✅ Started (concurrency=10)');
  return worker;
};

const stopNotificationWorker = async () => {
  if (worker) {
    await worker.close();
    logger.info('[NotifWorker] stopped');
  }
};

module.exports = { startNotificationWorker, stopNotificationWorker };
