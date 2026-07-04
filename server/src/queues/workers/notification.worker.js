/**
 * queues/workers/notification.worker.js
 * BullMQ worker for the arogyaai:notification queue.
 *
 * Each job payload mirrors the args accepted by createNotification():
 *   { recipientId, type, title, message, data, link }
 *
 * createNotification() is already idempotent (Notification.create — no unique
 * index conflict risk), so retries are safe.
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

      await createNotification(recipientId, type, title, message, data, link);

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
