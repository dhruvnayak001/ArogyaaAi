/**
 * models/WebhookEvent.model.js
 * Idempotency ledger for inbound Razorpay webhook events.
 *
 * One document per `eventId` (Razorpay's `x-razorpay-event-id` header, or a
 * derived fallback). The unique index is what actually enforces "duplicate
 * events must never duplicate refunds/notifications/confirmations" — a
 * second delivery of the same event fails to insert (code 11000) and is
 * skipped by the caller before any processing happens.
 */

'use strict';

const mongoose = require('mongoose');

const WebhookEventSchema = new mongoose.Schema(
  {
    eventId:   { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* Razorpay does not redeliver webhooks beyond a few days — retaining the
   dedupe ledger for 30 days is more than enough headroom. */
WebhookEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('WebhookEvent', WebhookEventSchema);
