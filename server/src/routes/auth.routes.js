/**
 * routes/auth.routes.js
 * Authentication route definitions
 *
 * Route table:
 *  POST   /api/v1/auth/register         → register       (public)
 *  POST   /api/v1/auth/login            → login          (public)
 *  POST   /api/v1/auth/refresh          → refresh        (public — uses cookie)
 *  POST   /api/v1/auth/logout           → logout         (optional auth)
 *  POST   /api/v1/auth/forgot-password  → forgotPassword (public)
 *  POST   /api/v1/auth/reset-password   → resetPassword  (public)
 *  GET    /api/v1/auth/me               → getMe          (protected)
 *  PATCH  /api/v1/auth/me               → updateMe       (protected)
 *  PATCH  /api/v1/auth/change-password  → changePassword (protected)
 *  POST   /api/v1/auth/send-otp         → sendOtp        (protected)
 *  POST   /api/v1/auth/verify-otp       → verifyOtp      (protected)
 *  POST   /api/v1/auth/resend-otp       → resendOtp      (protected)
 */

'use strict';

const express  = require('express');
const router   = express.Router();

const authCtrl = require('../controllers/auth.controller');
const otpCtrl  = require('../controllers/otp.controller');
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} = require('../middleware/validators/auth.validators');

/* ── Public routes ── */
router.post('/register',
  validateRegister,
  validate,
  authCtrl.register
);

router.post('/login',
  validateLogin,
  validate,
  authCtrl.login
);

router.post('/refresh',
  authCtrl.refresh
);

/* Logout works with or without a valid access token
   (cookie is always cleared on the server side) */
router.post('/logout',
  optionalAuth,
  authCtrl.logout
);

router.post('/forgot-password',
  validateForgotPassword,
  validate,
  authCtrl.forgotPassword
);

router.post('/reset-password',
  validateResetPassword,
  validate,
  authCtrl.resetPassword
);

/* ── Protected routes (requires valid access token) ── */
router.get('/me',
  protect,
  authCtrl.getMe
);

router.patch('/change-password',
  protect,
  validateChangePassword,
  validate,
  authCtrl.changePassword
);

/* ── OTP / Email Verification (protected) ── */
router.post('/send-otp',   protect, otpCtrl.sendOtp);
router.post('/verify-otp', protect, otpCtrl.verifyOtp);
router.post('/resend-otp', protect, otpCtrl.resendOtp);

/* ── Update profile (protected) ── */
router.patch('/me', protect, authCtrl.updateMe);

/* ── Delete account (protected) ── */
router.delete('/account', protect, authCtrl.deleteAccount);

module.exports = router;
