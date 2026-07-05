/**
 * controllers/webhook.controller.js
 * Inbound Razorpay webhook — POST /api/v1/payments/webhook
 *
 * This route is mounted directly on the Express app (see src/index.js)
 * BEFORE the global express.json() parser, using a route-specific
 * express.raw() middleware, because the HMAC signature must be computed
 * over the exact raw request bytes Razorpay sent — a re-serialized
 * JSON.stringify(JSON.parse(body)) is not guaranteed to match byte-for-byte.
 *
 * It intentionally does NOT go through the `protect` auth middleware —
 * Razorpay has no JWT. Authentication here IS the HMAC signature check.
 */

'use strict';

const crypto        = require('crypto');
const logger         = require('../config/logger');
const WebhookEvent   = require('../models/WebhookEvent.model');
const paymentService = require('../services/payment.service');
const catchAsync     = require('../utils/catchAsync');

/**
 * Constant-time HMAC-SHA256 signature comparison.
 */
const isValidSignature = (rawBody, signature, secret) => {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const givenBuf     = Buffer.from(String(signature), 'utf8');
  if (expectedBuf.length !== givenBuf.length) return false;
  try {
    return crypto.timingSafeEqual(expectedBuf, givenBuf);
  } catch {
    return false;
  }
};

/* Wrapped in catchAsync (same convention as every other route handler in the
   app) so a synchronous throw or unguarded rejection anywhere in this
   function — including in isValidSignature or any future edit — is routed
   to the standard Express error handler instead of becoming an
   unhandledRejection. Left un-wrapped, a single malformed webhook POST could
   trip index.js's unhandledRejection handler, which calls process.exit(1)
   and takes the whole server down for every user. */
const handleRazorpayWebhook = catchAsync(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting inbound webhook.');
    return res.status(503).json({ success: false, message: 'Webhook not configured.' });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    logger.error('[Webhook] Expected raw Buffer body — check route middleware ordering.');
    return res.status(400).json({ success: false, message: 'Invalid request body.' });
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!isValidSignature(rawBody, signature, secret)) {
    logger.warn('[Webhook] Invalid Razorpay webhook signature — rejected.');
    return res.status(400).json({ success: false, message: 'Invalid signature.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload.' });
  }

  const paymentOrRefundId =
    event.payload?.payment?.entity?.id ||
    event.payload?.refund?.entity?.id  ||
    '';
  const eventId =
    req.headers['x-razorpay-event-id'] ||
    event.id ||
    `${event.event}-${event.created_at}-${paymentOrRefundId}`;

  /* Idempotency: claim this event exactly once. A duplicate delivery fails
     the unique-index insert and is skipped before any processing happens. */
  try {
    await WebhookEvent.create({ eventId, eventType: event.event });
  } catch (err) {
    if (err.code === 11000) {
      logger.info(`[Webhook] Duplicate event ${eventId} — already processed, skipping.`);
      return res.status(200).json({ success: true, message: 'Already processed.' });
    }
    logger.error(`[Webhook] Failed to record event ${eventId}: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal error.' });
  }

  try {
    await paymentService.processWebhookEvent(event);
  } catch (err) {
    logger.error(`[Webhook] Processing failed for event ${eventId} (${event.event}): ${err.message}`, { stack: err.stack });
    /* Release the idempotency claim so a Razorpay retry (same eventId) can
       reprocess a transient failure instead of being silently dropped. */
    await WebhookEvent.deleteOne({ eventId }).catch(() => {});
    return res.status(500).json({ success: false, message: 'Processing failed, will retry.' });
  }

  return res.status(200).json({ success: true });
});

module.exports = { handleRazorpayWebhook };
