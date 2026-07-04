/**
 * api/chat.api.js
 * AI Chat session and message API calls
 */

import apiClient from './axios';

export const chatApi = {
  /** Get all chat sessions for the current user */
  getSessions: () =>
    apiClient.get('/chat/sessions'),

  /** Get a single session with messages */
  getSession: (sessionId) =>
    apiClient.get(`/chat/sessions/${sessionId}`),

  /** Create a new chat session */
  createSession: (payload = {}) =>
    apiClient.post('/chat/sessions', payload),

  /** Delete a chat session */
  deleteSession: (sessionId) =>
    apiClient.delete(`/chat/sessions/${sessionId}`),

  /**
   * Send a message to the AI chatbot
   * @param {string} sessionId
   * @param {{ content, attachments }} payload
   */
  sendMessage: (sessionId, payload) =>
    apiClient.post(`/chat/sessions/${sessionId}/messages`, payload),

  /** Get all messages in a session */
  getMessages: (sessionId) =>
    apiClient.get(`/chat/sessions/${sessionId}/messages`),

  /**
   * Request emergency analysis from AI
   * @param {{ symptoms, vitals }} payload
   */
  analyzeEmergency: (payload) =>
    apiClient.post('/chat/emergency-analysis', payload),

  /** Get AI-generated summary for a session */
  getSessionSummary: (sessionId) =>
    apiClient.get(`/chat/sessions/${sessionId}/summary`),
};
