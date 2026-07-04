/**
 * api/notifications.api.js
 * Axios wrappers for notification endpoints
 */

import apiClient from './axios';

export const notificationsApi = {
  /**
   * Get paginated notifications
   * @param {{ page?, limit?, unreadOnly? }} params
   */
  getAll: (params = {}) =>
    apiClient.get('/notifications', { params }),

  /** Get unread count */
  getUnreadCount: () =>
    apiClient.get('/notifications/unread-count'),

  /** Mark a single notification as read */
  markRead: (id) =>
    apiClient.patch(`/notifications/${id}/read`),

  /** Mark all notifications as read */
  markAllRead: () =>
    apiClient.patch('/notifications/read-all'),

  /** Delete a notification */
  delete: (id) =>
    apiClient.delete(`/notifications/${id}`),
};
