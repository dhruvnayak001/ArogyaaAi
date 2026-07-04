/**
 * api/ai.api.js
 * AI endpoint wrappers — consultation brief generation
 */

import apiClient from './axios';

export const aiApi = {
  /**
   * Generate an AI Pre-Consultation Copilot brief.
   * @param {{ symptomText, symptomTranscript, reportIds }} payload
   */
  generateConsultationBrief: (payload) =>
    apiClient.post('/ai/consultation-brief', payload),

  /**
   * Summarize arbitrary medical text
   * @param {string} text
   */
  summarize: (text) =>
    apiClient.post('/ai/summarize', { text }),
};
