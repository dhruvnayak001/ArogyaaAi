/**
 * api/appointments.api.js
 * Appointment booking, management, and payment API calls
 */

import apiClient from './axios';

export const appointmentsApi = {
  /** Get all appointments for current user (patient or doctor) */
  getAll: (params = {}) =>
    apiClient.get('/appointments', { params }),

  /** Get a single appointment */
  getById: (appointmentId) =>
    apiClient.get(`/appointments/${appointmentId}`),

  /**
   * Book a new appointment — supports full AI Copilot payload
   * @param {{
   *   doctorId, date, time, consultationType, reason,
   *   symptoms, symptomTranscript,
   *   uploadedReportIds, aiConsultationBrief,
   *   notes
   * }} payload
   */
  book: (payload) =>
    apiClient.post('/appointments', payload),

  /**
   * Update appointment (reschedule or add notes)
   * @param {string} appointmentId
   * @param {object} payload
   */
  update: (appointmentId, payload) =>
    apiClient.put(`/appointments/${appointmentId}`, payload),

  /** Cancel an appointment */
  cancel: (appointmentId, reason) =>
    apiClient.patch(`/appointments/${appointmentId}/cancel`, { reason }),

  /**
   * Doctor: confirm or reject appointment
   * @param {string} appointmentId
   * @param {{ status, notes }} payload
   */
  updateStatus: (appointmentId, payload) =>
    apiClient.patch(`/appointments/${appointmentId}/status`, payload),

  /** Get available slots for a doctor on a date */
  getAvailableSlots: (doctorId, date) =>
    apiClient.get(`/appointments/slots/${doctorId}`, { params: { date } }),

  /** Get upcoming appointments */
  getUpcoming: () =>
    apiClient.get('/appointments/upcoming'),

  /* ─── Payment API methods ─────────────────────────────── */

  /**
   * Create a Razorpay payment order for an appointment
   * @param {string} appointmentId
   */
  createPaymentOrder: (appointmentId) =>
    apiClient.post('/payments/create-order', { appointmentId }),

  /**
   * Verify Razorpay payment after checkout completion
   * @param {{ appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature }} payload
   */
  verifyPayment: (payload) =>
    apiClient.post('/payments/verify', payload),

  /**
   * Retry a failed or pending payment (creates new Razorpay order)
   * @param {string} appointmentId
   */
  retryPayment: (appointmentId) =>
    apiClient.post(`/payments/retry/${appointmentId}`),

  /**
   * Download invoice PDF — returns blob
   * @param {string} appointmentId
   */
  downloadInvoice: (appointmentId) =>
    apiClient.get(`/payments/invoice/${appointmentId}`, { responseType: 'blob' }),

  /**
   * Download receipt PDF — returns blob
   * @param {string} appointmentId
   */
  downloadReceipt: (appointmentId) =>
    apiClient.get(`/payments/receipt/${appointmentId}`, { responseType: 'blob' }),
};
