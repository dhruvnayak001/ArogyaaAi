/**
 * controllers/otp.controller.js
 * HTTP handlers for OTP email verification endpoints
 *
 * All routes require an authenticated user (protect middleware).
 */

'use strict';

const otpService = require('../services/otp.service');
const catchAsync = require('../utils/catchAsync');

/* ════════════════════════════════════════
   POST /auth/send-otp
   Send OTP to the authenticated user's email
   ════════════════════════════════════════ */
const sendOtp = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const { email, expiresIn } = await otpService.generateAndSendOtp(userId);

  res.status(200).json({
    success: true,
    message: `Verification code sent to ${email}`,
    data: {
      email,
      expiresIn, // minutes
    },
  });
});

/* ════════════════════════════════════════
   POST /auth/verify-otp
   Verify the OTP submitted by the user
   ════════════════════════════════════════ */
const verifyOtp = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { otp  } = req.body;

  await otpService.verifyOtp(userId, otp);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully! Your account is now fully active.',
    data:    { isEmailVerified: true },
  });
});

/* ════════════════════════════════════════
   POST /auth/resend-otp
   Resend the OTP with cooldown protection
   ════════════════════════════════════════ */
const resendOtp = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const { email, expiresIn } = await otpService.resendOtp(userId);

  res.status(200).json({
    success: true,
    message: `New verification code sent to ${email}`,
    data: {
      email,
      expiresIn,
    },
  });
});

module.exports = {
  sendOtp,
  verifyOtp,
  resendOtp,
};
