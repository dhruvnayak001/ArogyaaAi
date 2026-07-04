/**
 * api/doctors.api.js
 * Doctor search, profiles, availability, and consultation management
 */

import apiClient from './axios';

export const doctorsApi = {
  /** Search doctors with filters */
  search: (params = {}) =>
    apiClient.get('/doctors', { params }),

  /** Get a single doctor's public profile */
  getById: (doctorId) =>
    apiClient.get(`/doctors/${doctorId}`),

  /** Get doctor's own profile (doctor role only) */
  getOwnProfile: () =>
    apiClient.get('/doctors/profile'),

  /**
   * Update doctor's own profile (doctor role only)
   * @param {object} payload
   */
  updateProfile: (payload) =>
    apiClient.put('/doctors/profile', payload),

  /**
   * Update doctor's availability (days, hours, lunch break)
   * @param {object} payload
   */
  updateAvailability: (payload) =>
    apiClient.put('/doctors/availability', payload),

  /**
   * Update doctor's per-mode consultation config (doctor role only)
   * @param {Array<{ mode, fee, duration, enabled, description }>} modes
   */
  updateConsultationModes: (modes) =>
    apiClient.put('/doctors/consultation-modes', { modes }),

  /**
   * Update cancellation policy (doctor role only)
   * @param {{ moreThan24h, between12and24h, lessThan12h }} payload
   */
  updateCancellationPolicy: (payload) =>
    apiClient.put('/doctors/cancellation-policy', payload),

  /** Get list of specializations */
  getSpecializations: () =>
    apiClient.get('/doctors/specializations'),

  /** Get patients list (doctor role only) */
  getPatients: (params = {}) =>
    apiClient.get('/doctors/patients', { params }),

  /** Get a specific patient's records (shared access) */
  getPatientRecords: (patientId) =>
    apiClient.get(`/doctors/patients/${patientId}/records`),

  /**
   * Get full Patient 360 AI Command Center data (doctor only)
   * @param {string} patientId
   * @param {string|null} apptId  — optional focus appointment
   */
  getPatient360: (patientId, apptId = null) =>
    apiClient.get(`/doctors/patients/${patientId}/360`, {
      params: apptId ? { apptId } : {},
    }),
};
