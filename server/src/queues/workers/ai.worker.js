/**
 * queues/workers/ai.worker.js
 * BullMQ worker for the arogyaai:ai queue.
 *
 * Handles deferred / background AI tasks that do not need to block
 * the HTTP response:
 *
 *   Job name: 'doctor-summary'
 *     payload: { recordId, userId }
 *     action : generateAndSaveDoctorSummary(recordId, userId)
 *
 * Concurrency is intentionally low (2) — Gemini API has per-minute token
 * quota limits and we do not want background jobs to starve foreground calls.
 */

'use strict';

const { Worker }  = require('bullmq');
const logger      = require('../../config/logger');

const QUEUE_NAME = 'arogyaai-ai';

let worker = null;

/**
 * startAiWorker
 * @returns {Worker|null}
 */
const startAiWorker = () => {
  if (!process.env.REDIS_URL) return null;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { name } = job;

      if (name === 'doctor-summary') {
        const { recordId, userId } = job.data;
        logger.info(`[AIWorker] doctor-summary job=${job.id} record=${recordId}`);

        /* Lazy require to avoid circular dependency at module load */
        const recordSvc = require('../../services/record.service');
        await recordSvc.generateAndSaveDoctorSummary(recordId, userId);

        logger.info(`[AIWorker] ✅ doctor-summary complete job=${job.id}`);
        return;
      }

      logger.warn(`[AIWorker] Unknown job name: ${name} (job=${job.id})`);
    },
    {
      connection:  { url: process.env.REDIS_URL },
      concurrency: 2,
    }
  );

  worker.on('failed', (job, err) => {
    logger.warn(`[AIWorker] ❌ job=${job?.id} name=${job?.name} attempt=${job?.attemptsMade} error="${err.message}"`);
  });

  worker.on('error', (err) => {
    logger.warn(`[AIWorker] worker error: ${err.message}`);
  });

  logger.info('[AIWorker] ✅ Started (concurrency=2)');
  return worker;
};

const stopAiWorker = async () => {
  if (worker) {
    await worker.close();
    logger.info('[AIWorker] stopped');
  }
};

module.exports = { startAiWorker, stopAiWorker };
