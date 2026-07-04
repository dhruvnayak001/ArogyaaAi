/**
 * models/Otp.model.js
 * OTP records for email verification
 *
 * Design:
 *  - One active OTP per user at a time (upsert pattern)
 *  - OTP is SHA-256 hashed before storage
 *  - TTL index auto-purges expired documents (Mongoose / MongoDB native)
 *  - attempt tracking prevents brute-force
 */

'use strict';

const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    /* SHA-256 hash of the 6-digit OTP — never store plaintext */
    hashedOtp: {
      type:     String,
      required: true,
    },

    /* Hard expiry — TTL index deletes the document automatically */
    expiresAt: {
      type:     Date,
      required: true,
    },

    /* Track failed verification attempts */
    attempts: {
      type:    Number,
      default: 0,
    },

    /* Prevent rapid re-send spam */
    lastSentAt: {
      type:    Date,
      default: Date.now,
    },

    /* Marked true after successful verification (prevents double-use) */
    isUsed: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/* MongoDB TTL index — auto-deletes documents after expiresAt */
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* Compound index for fast lookup */
OtpSchema.index({ userId: 1, isUsed: 1 });

const Otp = mongoose.model('Otp', OtpSchema);

module.exports = Otp;
