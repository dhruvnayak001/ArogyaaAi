/**
 * controllers/auth.controller.js
 * HTTP layer for authentication — delegates to auth.service.js
 *
 * Each handler:
 *  1. Extracts inputs from req
 *  2. Calls the service
 *  3. Manages the httpOnly cookie lifecycle
 *  4. Returns a normalized JSON response
 *
 * Error propagation: service throws AppError → catchAsync → errorHandler
 */

'use strict';

const authService     = require('../services/auth.service');
const catchAsync      = require('../utils/catchAsync');
const { issueTokens, clearRefreshCookie, REFRESH_COOKIE_OPTIONS } = require('../utils/jwt');
const User            = require('../models/User.model');
const Appointment     = require('../models/Appointment.model');
const HealthRecord    = require('../models/HealthRecord.model');
const Notification    = require('../models/Notification.model');
const ChatSession     = require('../models/ChatSession.model');
const AppError        = require('../utils/AppError');

/* ── Refresh cookie options — single source of truth in utils/jwt.js ———————————
   REFRESH_COOKIE_OPTIONS is imported from jwt.js to avoid duplication.
   All cookie set/clear calls in this controller use that constant.
   ──────────────────────────────────────────────────────────────────────── */

/* ════════════════════════════════════════
   POST /auth/register
   ════════════════════════════════════════ */
const register = catchAsync(async (req, res) => {
  const { name, email, password, role } = req.body;

  const { user, accessToken, refreshToken } =
    await authService.registerUser({ name, email, password, role });

  /* Set httpOnly refresh token cookie */
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      user,
      accessToken,
    },
  });
});

/* ════════════════════════════════════════
   POST /auth/login
   ════════════════════════════════════════ */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } =
    await authService.loginUser({ email, password });

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: {
      user,
      accessToken,
    },
  });
});

/* ════════════════════════════════════════
   POST /auth/refresh
   Silent token refresh — uses httpOnly cookie
   Called automatically by Axios interceptor
   ════════════════════════════════════════ */
const refresh = catchAsync(async (req, res) => {
  /* Read raw refresh token from signed httpOnly cookie */
  const refreshToken = req.cookies?.refreshToken;

  const { user, accessToken, refreshToken: newRefreshToken } =
    await authService.refreshAccessToken(refreshToken);

  /* Rotate cookie */
  res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    data: {
      user,
      accessToken,
    },
  });
});

/* ════════════════════════════════════════
   POST /auth/logout
   ════════════════════════════════════════ */
const logout = catchAsync(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  if (userId) {
    await authService.logoutUser(userId);
  }

  /* Clear the refresh token cookie */
  res.clearCookie('refreshToken', {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: 0,
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/* ════════════════════════════════════════
   POST /auth/forgot-password
   ════════════════════════════════════════ */
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  /* Service always resolves (no enumeration) */
  await authService.forgotPassword(email);

  res.status(200).json({
    success: true,
    message: 'If an account exists with that email, a reset link has been sent.',
  });
});

/* ════════════════════════════════════════
   POST /auth/reset-password
   ════════════════════════════════════════ */
const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  const { user, accessToken, refreshToken } =
    await authService.resetPassword(token, password);

  /* Log user in after password reset */
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
    data: {
      user,
      accessToken,
    },
  });
});

/* ════════════════════════════════════════
   GET /auth/me
   Returns current authenticated user
   ════════════════════════════════════════ */
const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user._id);

  res.status(200).json({
    success: true,
    data: { user },
  });
});

/* ════════════════════════════════════════
   PATCH /auth/change-password
   ════════════════════════════════════════ */
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  const { user, accessToken, refreshToken } =
    await authService.changePassword(userId, currentPassword, newPassword);

  /* Reissue cookie after password change */
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    data: { user, accessToken },
  });
});

/* ════════════════════════════════════════
   PATCH /auth/me
   Update authenticated user's profile fields
   ════════════════════════════════════════ */
const updateMe = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const allowedFields = [
    'name', 'phone', 'address', 'gender', 'dateOfBirth',
    'bloodGroup', 'allergies', 'chronicConditions', 'emergencyContact',
  ];

  /* Whitelist — prevent role/password escalation via this endpoint */
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!user) throw new AppError('User not found.', 404);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user },
  });
});

/* ════════════════════════════════════════
   DELETE /auth/account
   Permanently deletes the authenticated user's account
   and all associated data.
   ════════════════════════════════════════ */
const deleteAccount = catchAsync(async (req, res) => {
  const userId = req.user._id;

  /* Delete all data linked to this user — notifications use 'recipient' field (not 'user') */
  await Promise.all([
    Appointment.deleteMany({ $or: [{ patient: userId }, { doctor: userId }] }),
    HealthRecord.deleteMany({ user: userId }),
    Notification.deleteMany({ recipient: userId }),  // field is 'recipient', not 'user'
    ChatSession.deleteMany({ user: userId }),
  ]);

  /* Delete user LAST — after all orphaned data is removed */
  await User.findByIdAndDelete(userId);

  /* Clear the refresh token cookie */
  res.clearCookie('refreshToken', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully. All your data has been erased.',
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
  deleteAccount,
};
