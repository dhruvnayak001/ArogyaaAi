/**
 * services/auth.service.js
 * Authentication business logic layer
 *
 * Responsibilities:
 *  - User registration (patient / doctor)
 *  - Login with credential verification
 *  - Silent token refresh via httpOnly cookie
 *  - Logout (revoke refresh token in DB)
 *  - Password reset flow (request + consume)
 *  - Email verification
 *
 * This layer is intentionally kept free of Express
 * req/res objects — pure business logic only.
 */

'use strict';

const crypto   = require('crypto');
const User     = require('../models/User.model');
const AppError = require('../utils/AppError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const { sendEmail, templates } = require('../utils/sendEmail');
const logger = require('../config/logger');

/* ═══════════════════════════════════════════
   REGISTER
   ═══════════════════════════════════════════ */

/**
 * registerUser
 * Creates a new patient or doctor account.
 * Sends a welcome email after registration.
 *
 * @param {{ name, email, password, role }} payload
 * @returns {{ user, accessToken, refreshToken }}
 */
const registerUser = async ({ name, email, password, role = 'patient' }) => {
  /* 1. Prevent duplicate accounts */
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  /* 2. Validate role — only patient/doctor allowed via API */
  if (!['patient', 'doctor'].includes(role)) {
    throw new AppError('Invalid role specified.', 400);
  }

  /* 3. Create user (password hashed by pre-save hook) */
  const user = await User.create({ name: name.trim(), email, password, role });

  /* 4. Generate tokens */
  const tokenPayload = { id: user._id, role: user.role };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: user._id });

  /* 5. Persist hashed refresh token */
  user.refreshToken = _hashToken(refreshToken);
  user.lastLogin    = new Date();
  await user.save({ validateBeforeSave: false });

  /* 6. Welcome email (non-blocking — do not await) */
  const { subject, html } = templates.welcomeEmail(user.name);
  sendEmail({ to: user.email, subject, html }).catch((err) =>
    logger.warn(`Welcome email failed for ${user.email}: ${err.message}`)
  );

  logger.info(`New ${role} registered: ${user.email} [${user._id}]`);

  return {
    user:         _sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/* ═══════════════════════════════════════════
   LOGIN
   ═══════════════════════════════════════════ */

/**
 * loginUser
 * Authenticates a user with email + password.
 * Returns new token pair on success.
 *
 * @param {{ email, password }} credentials
 * @returns {{ user, accessToken, refreshToken }}
 */
const loginUser = async ({ email, password }) => {
  /* 1. Find user (include password for comparison) */
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isActive: true,
  }).select('+password +refreshToken');

  if (!user) {
    /* Generic message — prevent email enumeration */
    throw new AppError('Invalid email or password.', 401);
  }

  /* 2. Compare password */
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  /* 3. Generate fresh token pair */
  const tokenPayload = { id: user._id, role: user.role };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: user._id });

  /* 4. Rotate refresh token in DB */
  user.refreshToken = _hashToken(refreshToken);
  user.lastLogin    = new Date();
  await user.save({ validateBeforeSave: false });

  logger.info(`User logged in: ${user.email} [${user._id}]`);

  return {
    user:        _sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/* ═══════════════════════════════════════════
   REFRESH TOKEN
   ═══════════════════════════════════════════ */

/**
 * refreshAccessToken
 * Verifies the httpOnly refresh token cookie and issues a new access token.
 * Implements refresh token rotation — old token is replaced.
 *
 * @param {string} refreshToken - Raw refresh token from cookie
 * @returns {{ user, accessToken, refreshToken: newRefreshToken }}
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token not provided.', 401);
  }

  /* 1. Verify JWT signature and expiry */
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Session expired. Please log in again.', 401);
    }
    throw new AppError('Invalid refresh token.', 401);
  }

  /* 2. Find user and compare stored hashed token */
  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || !user.isActive) {
    throw new AppError('User not found or account deactivated.', 401);
  }

  const hashedIncoming = _hashToken(refreshToken);
  if (user.refreshToken !== hashedIncoming) {
    /* Token reuse detected — possible theft. Revoke all sessions. */
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
    logger.warn(`Refresh token reuse detected for user ${user._id} — sessions revoked`);
    throw new AppError('Security alert: invalid session. Please log in again.', 401);
  }

  /* 3. Rotate — issue new token pair */
  const tokenPayload    = { id: user._id, role: user.role };
  const newAccessToken  = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken({ id: user._id });

  user.refreshToken = _hashToken(newRefreshToken);
  await user.save({ validateBeforeSave: false });

  return {
    user:         _sanitizeUser(user),
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/* ═══════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════ */

/**
 * logoutUser
 * Revokes the stored refresh token, preventing further silent refreshes.
 *
 * @param {string} userId
 */
const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(
    userId,
    { $unset: { refreshToken: 1 } },
    { new: true }
  );
  logger.info(`User logged out: ${userId}`);
};

/* ═══════════════════════════════════════════
   FORGOT PASSWORD
   ═══════════════════════════════════════════ */

/**
 * forgotPassword
 * Generates a password reset token and sends it via email.
 * Always responds successfully even if email not found (prevents enumeration).
 *
 * @param {string} email
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({
    email:    email.toLowerCase().trim(),
    isActive: true,
  });

  /* Always return success — don't reveal if email exists */
  if (!user) {
    logger.info(`Password reset requested`);
    return;
  }

  /* Generate unhashed token (stored hashed in DB) */
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  /* Build reset URL — points to frontend */
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

  try {
    const { subject, html } = templates.passwordReset(resetUrl);
    await sendEmail({ to: user.email, subject, html });
    logger.info(`Password reset email sent [user: ${user._id}]`);
  } catch (err) {
    /* Rollback token if email fails */
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    logger.error(`Password reset email failed [user: ${user._id}]: ${err.message}`);
    throw new AppError('Failed to send reset email. Please try again later.', 500);
  }
};

/* ═══════════════════════════════════════════
   RESET PASSWORD
   ═══════════════════════════════════════════ */

/**
 * resetPassword
 * Validates the reset token and updates the user's password.
 *
 * @param {string} token    - Unhashed token from email link
 * @param {string} password - New plaintext password
 * @returns {{ user, accessToken, refreshToken }}
 */
const resetPassword = async (token, password) => {
  /* Hash the incoming token to compare with stored hash */
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  /* Find user with valid, non-expired token */
  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: Date.now() },
    isActive:             true,
  }).select('+password');

  if (!user) {
    throw new AppError('Password reset token is invalid or has expired.', 400);
  }

  /* Update password (pre-save hook handles hashing) */
  user.password             = password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken         = undefined; // Invalidate all existing sessions

  await user.save();

  /* Issue new tokens — log user in automatically */
  const tokenPayload = { id: user._id, role: user.role };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: user._id });

  user.refreshToken = _hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  logger.info(`Password reset completed [user: ${user._id}]`);

  return {
    user:        _sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/* ═══════════════════════════════════════════
   GET CURRENT USER
   ═══════════════════════════════════════════ */

/**
 * getMe
 * Returns the currently authenticated user's profile.
 *
 * @param {string} userId
 * @returns {object} Sanitized user object
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return _sanitizeUser(user);
};

/* ═══════════════════════════════════════════
   PRIVATE HELPERS
   ═══════════════════════════════════════════ */

/**
 * Hash a token using SHA-256 (for secure DB storage)
 * @param {string} token
 * @returns {string}
 */
const _hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Remove sensitive fields before returning user to client
 * @param {object} user - Mongoose user document
 * @returns {object} Clean user object
 */
const _sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.refreshToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  return obj;
};

/* ═══════════════════════════════════════════
   CHANGE PASSWORD (authenticated)
   ═══════════════════════════════════════════ */

/**
 * changePassword
 * Allows an authenticated user to change their password.
 * Verifies the current password before applying the update.
 * Rotates all tokens to invalidate other sessions.
 *
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {{ user, accessToken, refreshToken }}
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  /* Verify current password */
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 401);
  }

  /* Ensure new password differs */
  const isSame = await user.comparePassword(newPassword);
  if (isSame) {
    throw new AppError('New password must be different from your current password.', 400);
  }

  /* Update password — pre-save hook re-hashes */
  user.password     = newPassword;
  user.refreshToken = undefined; // Invalidate all existing sessions
  await user.save();

  /* Issue fresh tokens */
  const tokenPayload = { id: user._id, role: user.role };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: user._id });

  user.refreshToken = _hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  logger.info(`Password changed for user: ${user._id}`);

  return {
    user:        _sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  getMe,
  changePassword,
};
