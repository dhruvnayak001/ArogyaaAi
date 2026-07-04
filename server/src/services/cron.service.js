/**
 * services/cron.service.js
 * Appointment reminder cron jobs using node-cron
 *
 * Jobs:
 *  1. 24-hour reminder  — runs every hour at :00
 *  2.  1-hour reminder  — runs every 15 minutes
 *
 * Duplicate prevention: Appointment.reminderSent24h / reminderSent1h flags
 */

'use strict';

const cron               = require('node-cron');
const crypto             = require('crypto');
const { format, addHours, subMinutes, addMinutes } = require('date-fns');
const Appointment        = require('../models/Appointment.model');
const { createNotification } = require('./notification.service');
const { sendEmail, templates } = require('../utils/sendEmail');
const { enqueueEmail, enqueueNotification } = require('../queues');
const logger             = require('../config/logger');
const { getRedisClient } = require('../config/redis');

/* ── Email template for appointment reminder ── */
const reminderEmailHtml = (recipientName, patientName, doctorName, date, time, hoursAway) => `
  <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0694a2,#7c3aed);padding:32px 40px;text-align:center">
      <h1 style="margin:0;font-size:24px;font-weight:800">ArogyaAI</h1>
      <p style="margin:8px 0 0;opacity:0.8;font-size:13px">APPOINTMENT REMINDER</p>
    </div>
    <div style="padding:40px">
      <h2 style="margin:0 0 16px">⏰ Reminder: ${hoursAway}h Until Your Appointment</h2>
      <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px">
        Hi <strong style="color:#f8fafc">${recipientName}</strong>, this is a friendly reminder about your upcoming appointment.
      </p>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin:0 0 24px">
        <p style="margin:0 0 10px"><strong>Patient:</strong> ${patientName}</p>
        <p style="margin:0 0 10px"><strong>Doctor:</strong> Dr. ${doctorName}</p>
        <p style="margin:0 0 10px"><strong>Date:</strong> ${date}</p>
        <p style="margin:0"><strong>Time:</strong> ${time}</p>
      </div>
      <p style="color:#475569;font-size:12px;margin:0">
        Please arrive 10 minutes early. If you need to cancel, do so through your ArogyaAI dashboard.
      </p>
    </div>
  </div>
`;

/* ════════════════════════════════════════
   SHARED REMINDER PROCESSOR
   ════════════════════════════════════════ */

/**
 * Send reminders for appointments within the specified time window.
 * @param {number} hoursAway    - e.g. 24 or 1
 * @param {string} flagField    - 'reminderSent24h' | 'reminderSent1h'
 * @param {number} windowMins   - tolerance window in minutes (e.g. 65 for ~1h job)
 */
const processReminders = async (hoursAway, flagField, windowMins) => {
  const label = `[CRON][${hoursAway}h]`;
  const tStart = performance.now();
  try {
    const now         = new Date();
    const targetTime  = addHours(now, hoursAway);
    const windowStart = subMinutes(targetTime, windowMins / 2);
    const windowEnd   = addMinutes(targetTime, windowMins / 2);

    const appointments = await Appointment.find({
      status:      { $in: ['pending', 'confirmed'] },
      date:        { $gte: windowStart, $lte: windowEnd },
      [flagField]: false,
    })
      .populate('patient', 'name email')
      .populate('doctor',  'name email');

    if (appointments.length === 0) {
      logger.info(`${label} No reminders to send.`);
      return;
    }

    logger.info(`${label} Processing ${appointments.length} appointment(s)...`);

    /* ── Collect IDs of appointments we successfully dispatch for ── */
    const processedIds = [];

    for (const appt of appointments) {
      const formattedDate = format(new Date(appt.date), 'PPP');

      /* ── Patient notification (via queue, or inline if no Redis) ── */
      enqueueNotification({
        recipientId: appt.patient._id,
        type:    'appointment_reminder',
        title:   `⏰ Appointment in ${hoursAway} hour${hoursAway > 1 ? 's' : ''}`,
        message: `Your appointment with Dr. ${appt.doctor.name} is on ${formattedDate} at ${appt.time}.`,
        data:    { appointmentId: appt._id, hoursAway },
        link:    '/appointments',
      }).catch(() => {});

      /* ── Doctor notification (via queue, or inline if no Redis) ── */
      enqueueNotification({
        recipientId: appt.doctor._id,
        type:    'appointment_reminder',
        title:   `⏰ Upcoming appointment in ${hoursAway}h`,
        message: `${appt.patient.name}'s appointment is on ${formattedDate} at ${appt.time}.`,
        data:    { appointmentId: appt._id, hoursAway },
        link:    '/doctor/dashboard',
      }).catch(() => {});

      const patientReminderHtml = reminderEmailHtml(
        appt.patient.name, appt.patient.name, appt.doctor.name, formattedDate, appt.time, hoursAway
      );
      const doctorReminderHtml  = reminderEmailHtml(
        appt.doctor.name,  appt.patient.name, appt.doctor.name, formattedDate, appt.time, hoursAway
      );
      const reminderSubject = `ArogyaAI — Appointment Reminder (${hoursAway}h)`;

      /* ── Reminder email to patient (via queue, or inline if no Redis) ── */
      enqueueEmail(
        { to: appt.patient.email, subject: reminderSubject, html: patientReminderHtml },
        () => sendEmail({ to: appt.patient.email, subject: reminderSubject, html: patientReminderHtml })
      ).catch((err) => logger.warn(`${label} Patient email failed (${appt._id}): ${err.message}`));

      /* ── Reminder email to doctor (via queue, or inline if no Redis) ── */
      enqueueEmail(
        { to: appt.doctor.email, subject: reminderSubject, html: doctorReminderHtml },
        () => sendEmail({ to: appt.doctor.email, subject: reminderSubject, html: doctorReminderHtml })
      ).catch((err) => logger.warn(`${label} Doctor email failed (${appt._id}): ${err.message}`));

      processedIds.push(appt._id);

      /* ── Event Loop Audit: Yield after each notification dispatch ── */
      await new Promise((resolve) => setImmediate(resolve));
    }

    /* ── Stamp all reminder flags in ONE bulk operation ─────────────────────
       Previously: N sequential appt.save() calls = N MongoDB round-trips.
       Now: one bulkWrite() stamps all flags atomically.
       If this fails (transient DB error), appointments remain un-flagged
       and will be re-processed on the next cron tick — safe and idempotent.
       ─────────────────────────────────────────────────────────────────── */
    if (processedIds.length > 0) {
      const bulkOps = processedIds.map((id) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { [flagField]: true } },
        },
      }));

      const result = await Appointment.bulkWrite(bulkOps, { ordered: false });
      logger.info(`${label} bulkWrite: ${result.modifiedCount}/${processedIds.length} flags set`);
    }

    const tEnd = performance.now();
    logger.info(`${label} ✅ Processed ${appointments.length} appointment(s) in ${(tEnd - tStart).toFixed(2)}ms`);
  } catch (err) {
    const tEnd = performance.now();
    logger.error(`${label} ❌ Cron job failed after ${(tEnd - tStart).toFixed(2)}ms: ${err.message}`, { stack: err.stack });
  }
};


/* ════════════════════════════════════════
   DISTRIBUTED LEADER LOCK (Redis SET NX PX + UUID token ownership)
   ════════════════════════════════════════ */

/**
 * Lua script for safe lock release: only deletes the key if the value
 * still matches the token this process acquired it with. This prevents
 * instance A from ever deleting a lock now held by instance B — e.g. if
 * A's TTL expired (long GC pause, slow job) and B acquired in the
 * meantime, A's release must be a no-op, not a DEL of B's active lock.
 */
const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

/**
 * acquireCronLock
 * Attempts to acquire a short-lived Redis lock for a named cron job using
 * SET key <uuid> NX PX ttl — atomic, so only one server instance can
 * acquire the lock per window, ensuring exactly-once execution. The random
 * UUID token is what makes the release below safe (see RELEASE_LOCK_SCRIPT).
 *
 * When Redis is unavailable (REDIS_URL not set, or connection lost),
 * falls back to local-only mode (safe for single-instance deploys).
 *
 * @param {string} key   - Redis key, e.g. 'cron:lock:24h'
 * @param {number} ttlMs - Lock TTL in ms (should exceed max job duration)
 * @returns {Promise<{acquired: boolean, token: string|null}>}
 */
const acquireCronLock = async (key, ttlMs) => {
  const redis = getRedisClient();
  if (!redis) return { acquired: true, token: null }; // No Redis — single-instance fallback

  const token = crypto.randomUUID();
  try {
    /* SET key token NX PX ttl — returns 'OK' only if key did not exist */
    const result = await redis.set(key, token, 'NX', 'PX', ttlMs);
    if (result === 'OK') {
      logger.info(`[CRON] Lock acquired: ${key} (token=${token.slice(0, 8)}…)`);
      return { acquired: true, token };
    }
    logger.info(`[CRON] Lock skipped: ${key} — held by another instance`);
    return { acquired: false, token: null };
  } catch (err) {
    /* Redis error — log and allow execution rather than silently skip */
    logger.warn(`[CRON] Redis lock error for ${key}: ${err.message} — running without lock`);
    return { acquired: true, token: null };
  }
};

/**
 * releaseCronLock
 * Releases a lock previously acquired via acquireCronLock, using a Lua
 * compare-and-delete so this instance can only ever remove a lock it still
 * owns (stored token === our token). A mismatch means the TTL already
 * expired and another instance has since acquired it — in that case we log
 * and do nothing, rather than evicting the current owner's lock.
 *
 * @param {string} key
 * @param {string|null} token - the token returned by acquireCronLock; null
 *   (Redis absent, or acquire ran without a lock) is a safe no-op.
 */
const releaseCronLock = async (key, token) => {
  const redis = getRedisClient();
  if (!redis || !token) return;
  try {
    const result = await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
    if (result === 1) {
      logger.info(`[CRON] Lock released: ${key}`);
    } else {
      logger.warn(`[CRON] Lock release skipped: ${key} — token mismatch (already expired or held by another instance)`);
    }
  } catch (err) {
    /* fire-and-forget — lock TTL expires anyway */
    logger.warn(`[CRON] Redis lock release error for ${key}: ${err.message}`);
  }
};

/* ════════════════════════════════════════
   INITIALIZE CRON JOBS
   ════════════════════════════════════════ */

const initCron = () => {
  /* ── In-process overlap guard flags ────────────────────────────────────────
     Prevents a second tick on THIS instance starting before the first one
     finishes. The Redis lock (below) handles the cross-instance case.        */
  let isRunning24h = false;
  let isRunning1h  = false;

  /* ── 24-hour reminder: runs every hour at minute 0 ── */
  cron.schedule('0 * * * *', async () => {
    if (isRunning24h) {
      logger.warn('[CRON][24h] Skipping tick — previous run still in progress');
      return;
    }

    /* Distributed lock: 58-minute TTL (slightly under the 60-min interval).
       Any second server instance that fires at the same tick will see the key
       and skip, ensuring the job runs exactly once across the cluster. */
    const lockKey = 'cron:lock:24h';
    const { acquired, token } = await acquireCronLock(lockKey, 58 * 60 * 1000);
    if (!acquired) {
      logger.info('[CRON][24h] Skipping tick — another instance holds the lock');
      return;
    }

    isRunning24h = true;
    logger.info('[CRON] Running 24-hour appointment reminder job...');
    processReminders(24, 'reminderSent24h', 65)
      .catch((err) => logger.error(`[CRON][24h] Uncaught error: ${err.message}`))
      .finally(async () => {
        isRunning24h = false;
        await releaseCronLock(lockKey, token);
      });
  }, {
    scheduled: true,
    timezone:  'Asia/Kolkata',
  });

  /* ── 1-hour reminder: runs every 15 minutes ── */
  cron.schedule('*/15 * * * *', async () => {
    if (isRunning1h) {
      logger.warn('[CRON][1h] Skipping tick — previous run still in progress');
      return;
    }

    /* Distributed lock: 13-minute TTL (slightly under the 15-min interval). */
    const lockKey = 'cron:lock:1h';
    const { acquired, token } = await acquireCronLock(lockKey, 13 * 60 * 1000);
    if (!acquired) {
      logger.info('[CRON][1h] Skipping tick — another instance holds the lock');
      return;
    }

    isRunning1h = true;
    logger.info('[CRON] Running 1-hour appointment reminder job...');
    processReminders(1, 'reminderSent1h', 20)
      .catch((err) => logger.error(`[CRON][1h] Uncaught error: ${err.message}`))
      .finally(async () => {
        isRunning1h  = false;
        await releaseCronLock(lockKey, token);
      });
  }, {
    scheduled: true,
    timezone:  'Asia/Kolkata',
  });

  logger.info('[CRON] ✅ Initialized: 24h reminder (every hour) + 1h reminder (every 15min)');
};

module.exports = { initCron, acquireCronLock, releaseCronLock };
