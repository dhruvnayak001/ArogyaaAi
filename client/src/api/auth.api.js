/**
 * api/auth.api.js
 * All authentication API calls
 */

import apiClient from './axios';

export const authApi = {
  /**
   * Register a new user
   * @param {{ name, email, password, role }} payload
   */
  register: (payload) =>
    apiClient.post('/auth/register', payload),

  /**
   * Login with email + password
   * @param {{ email, password }} credentials
   */
  login: (credentials) =>
    apiClient.post('/auth/login', credentials),

  /**
   * Silent token refresh (uses httpOnly refresh cookie)
   */
  refreshToken: () =>
    apiClient.post('/auth/refresh'),

  /**
   * Logout — clears refresh cookie server-side
   */
  logout: () =>
    apiClient.post('/auth/logout'),

  /**
   * Request password reset email
   * @param {{ email }} payload
   */
  forgotPassword: (payload) =>
    apiClient.post('/auth/forgot-password', payload),

  /**
   * Reset password with token from email
   * @param {{ token, password }} payload
   */
  resetPassword: (payload) =>
    apiClient.post('/auth/reset-password', payload),

  /**
   * Get currently authenticated user profile
   */
  getMe: () =>
    apiClient.get('/auth/me'),

  /**
   * Send OTP to authenticated user's email
   */
  sendOtp: () =>
    apiClient.post('/auth/send-otp'),

  /**
   * Verify the submitted 6-digit OTP
   * @param {{ otp: string }} payload
   */
  verifyOtp: (payload) =>
    apiClient.post('/auth/verify-otp', payload),

  /**
   * Resend OTP with cooldown enforcement
   */
  resendOtp: () =>
    apiClient.post('/auth/resend-otp'),

  /** Permanently delete the user account */
  deleteAccount: () =>
    apiClient.delete('/auth/account'),

  /**
   * Update user profile fields
   * @param {object} updates
   */
  updateProfile: (updates) =>
    apiClient.patch('/auth/me', updates),
};
