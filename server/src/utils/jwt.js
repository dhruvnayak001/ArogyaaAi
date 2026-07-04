/**
 * utils/jwt.js
 * JWT token generation and verification helpers
 * Manages access tokens (short-lived) and refresh tokens (long-lived, httpOnly cookie)
 */

'use strict';

const jwt = require('jsonwebtoken');

/* ── Constants ── */
const ACCESS_SECRET   = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,                                // Inaccessible to JS
  secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
  /* lax in dev so cross-origin localhost requests work;
     strict in prod prevents CSRF across domains */
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,            // 7 days in ms
  path:     '/api/v1/auth',                      // Scoped to auth routes only
};

/**
 * Generate a signed JWT access token
 * @param {{ id, role }} payload
 */
const generateAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });

/**
 * Generate a signed JWT refresh token
 * @param {{ id }} payload
 */
const generateRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

/**
 * Verify an access token
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifyAccessToken = (token) =>
  jwt.verify(token, ACCESS_SECRET);

/**
 * Verify a refresh token
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);

/**
 * Attach refresh token as httpOnly cookie and return access token
 * @param {object} res      - Express response
 * @param {object} user     - User document
 * @returns {{ accessToken, refreshToken }}
 */
const issueTokens = (res, user) => {
  const payload      = { id: user._id, role: user.role };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user._id });

  // Set httpOnly cookie
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  return { accessToken, refreshToken };
};

/**
 * Clear the refresh token cookie (on logout)
 */
const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: 0,
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
  clearRefreshCookie,
  REFRESH_COOKIE_OPTIONS,
};
