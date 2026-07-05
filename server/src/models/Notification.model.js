/**
 * models/Notification.model.js
 * In-app notification schema
 * TTL: documents auto-expire after 90 days
 */

'use strict';

const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'appointment_booked',      // doctor receives when patient books
  'appointment_confirmed',   // patient receives when doctor confirms
  'appointment_cancelled',   // both parties receive on cancellation
  'appointment_reminder',    // 24h and 1h reminders
  'doctor_approval',         // patient notified on approval status
  'emergency_alert',         // emergency contacts / doctors
  'ai_summary_ready',        // patient notified when AI pre-summary is generated
  'payment_confirmed',       // patient notified when payment is verified
  'refund_processed',       // patient notified when a refund is processed
];

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    type: {
      type:     String,
      enum:     NOTIFICATION_TYPES,
      required: true,
      index:    true,
    },

    title: {
      type:     String,
      required: true,
      maxlength: 120,
    },

    message: {
      type:     String,
      required: true,
      maxlength: 500,
    },

    isRead: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    /* Contextual payload — appointmentId, doctorId, etc. */
    data: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },

    /* Link user can navigate to when clicking the notification */
    link: {
      type:    String,
      default: null,
    },

    /* Optional idempotency key (e.g. `${recipientId}:${type}:${appointmentId}`).
       Lets createNotification() upsert instead of blind-insert, so a BullMQ
       job retried after a stalled/crashed worker (Notification.create()
       already succeeded, but the job wasn't acknowledged in time) does not
       produce a duplicate notification document. Sparse so notifications
       created without a dedupeKey are unaffected. */
    dedupeKey: {
      type:   String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ── Compound indexes ── */
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

/* ── TTL: auto-delete after 90 days ── */
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
