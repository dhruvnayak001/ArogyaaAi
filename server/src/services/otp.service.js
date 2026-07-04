/**
 * services/otp.service.js
 * Business logic for OTP generation, verification, and resend
 *
 * Security properties:
 *  - Cryptographically random 6-digit OTP (crypto.randomInt)
 *  - SHA-256 hashed before persistence
 *  - 10-minute expiry window
 *  - 60-second resend cooldown
 *  - Max 5 attempts before 15-minute lockout
 */

'use strict';

const crypto    = require('crypto');
const Otp       = require('../models/Otp.model');
const User      = require('../models/User.model');
const AppError  = require('../utils/AppError');
const { sendEmail, templates } = require('../utils/sendEmail');
const logger    = require('../config/logger');

/* ── Constants ── */
const OTP_LENGTH          = 6;
const OTP_EXPIRY_MINUTES  = 10;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS        = 5;
const LOCKOUT_MINUTES     = 15;

/* ── Helpers ── */
const _hashOtp = (otp) =>
  crypto.createHash('sha256').update(String(otp)).digest('hex');

const _generateOtp = () => {
  /* crypto.randomInt(min, max) → [min, max) — secure, uniform */
  const min = Math.pow(10, OTP_LENGTH - 1); // 100000
  const max = Math.pow(10, OTP_LENGTH);     // 1000000
  return crypto.randomInt(min, max);
};

/* ════════════════════════════════════════
   generateAndSendOtp
   Creates a new OTP record (replacing any existing) and emails it.
   ════════════════════════════════════════ */
const generateAndSendOtp = async (userId) => {
  /* Load user to get name + email for the template */
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found.', 404);

  if (user.isEmailVerified) {
    throw new AppError('Email is already verified.', 400);
  }

  /* Check resend cooldown — prevent spam */
  const existing = await Otp.findOne({ userId, isUsed: false });
  if (existing) {
    const secondsSinceSent =
      (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
    if (secondsSinceSent < RESEND_COOLDOWN_SEC) {
      const waitSec = Math.ceil(RESEND_COOLDOWN_SEC - secondsSinceSent);
      throw new AppError(
        `Please wait ${waitSec} second${waitSec !== 1 ? 's' : ''} before requesting a new OTP.`,
        429
      );
    }
  }

  /* Generate OTP */
  const rawOtp    = _generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  /* Upsert — one active OTP per user */
  await Otp.findOneAndUpdate(
    { userId },
    {
      hashedOtp:  _hashOtp(rawOtp),
      expiresAt,
      attempts:   0,
      lastSentAt: new Date(),
      isUsed:     false,
    },
    { upsert: true, new: true }
  );

  /* Send OTP email */
  try {
    const { subject, html } = templates.otpEmail(user.name, rawOtp, OTP_EXPIRY_MINUTES);
    await sendEmail({ to: user.email, subject, html });
    logger.info(`OTP sent to ${user.email} [${userId}]`);
  } catch (err) {
    /* Delete the OTP record if email fails so user can retry */
    await Otp.deleteOne({ userId });
    logger.error(`OTP email failed for ${user.email}: ${err.message}`);
    throw new AppError('Failed to send OTP email. Please try again.', 500);
  }

  return { email: user.email, expiresIn: OTP_EXPIRY_MINUTES };
};

/* ════════════════════════════════════════
   verifyOtp
   Validates the submitted OTP against the stored hash.
   ════════════════════════════════════════ */
const verifyOtp = async (userId, submittedOtp) => {
  /* Validate shape */
  const otpStr = String(submittedOtp).trim();
  if (!/^\d{6}$/.test(otpStr)) {
    throw new AppError('OTP must be a 6-digit number.', 400);
  }

  /* Load the OTP record */
  const otpRecord = await Otp.findOne({ userId, isUsed: false });

  if (!otpRecord) {
    throw new AppError('No active OTP found. Please request a new one.', 400);
  }

  /* Check expiry */
  if (new Date() > otpRecord.expiresAt) {
    await Otp.deleteOne({ userId });
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  /* Lockout check */
  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    const lockoutMs  = LOCKOUT_MINUTES * 60 * 1000;
    const lockedUntil = new Date(otpRecord.lastSentAt.getTime() + lockoutMs);
    if (new Date() < lockedUntil) {
      const waitMin = Math.ceil((lockedUntil - Date.now()) / 60000);
      throw new AppError(
        `Too many failed attempts. Please try again in ${waitMin} minute${waitMin !== 1 ? 's' : ''}.`,
        429
      );
    }
    /* Lockout expired — delete and ask for fresh OTP */
    await Otp.deleteOne({ userId });
    throw new AppError('Too many failed attempts. Please request a new OTP.', 400);
  }

  /* Compare hash */
  const expectedHash = _hashOtp(otpStr);
  if (otpRecord.hashedOtp !== expectedHash) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    const remaining = MAX_ATTEMPTS - otpRecord.attempts;
    throw new AppError(
      `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      400
    );
  }

  /* ✅ OTP is correct — mark as used and verify user */
  otpRecord.isUsed = true;
  await otpRecord.save();

  await User.findByIdAndUpdate(userId, { isEmailVerified: true });

  logger.info(`Email verified for user ${userId}`);

  return { verified: true };
};

/* ════════════════════════════════════════
   resendOtp
   Alias with explicit cooldown messaging.
   ════════════════════════════════════════ */
const resendOtp = async (userId) => {
  /* generateAndSendOtp already enforces cooldown */
  return generateAndSendOtp(userId);
};

module.exports = {
  generateAndSendOtp,
  verifyOtp,
  resendOtp,
};
