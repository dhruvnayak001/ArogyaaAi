/**
 * store/notificationStore.js
 * Zustand store for notification state + real-time polling
 *
 * State:
 *  notifications[]  - list of notification objects
 *  unreadCount      - number of unread
 *  isLoading        - true while fetching list
 *  pagination       - server pagination metadata
 *
 * Polling:
 *  startPolling() polls unread count every 30 seconds
 *  stopPolling()  clears the interval
 */

import { create } from 'zustand';
import { notificationsApi } from '@api/notifications.api';

const POLL_INTERVAL_MS = 30_000;

export const useNotificationStore = create((set, get) => ({
  /* ── State ── */
  notifications:  [],
  unreadCount:    0,
  isLoading:      false,
  pagination:     null,
  _pollingTimer:  null,

  /* ── Fetch full list (paginated) ── */
  fetchNotifications: async (params = {}) => {
    set({ isLoading: true });
    try {
      const { data } = await notificationsApi.getAll(params);
      const { notifications, pagination } = data.data;
      set({ notifications, pagination, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      console.error('[NotifStore] fetchNotifications error:', err.message);
    }
  },

  /* ── Fetch more (append, for infinite scroll) ── */
  fetchMore: async () => {
    const { pagination, notifications } = get();
    if (!pagination?.hasMore) return;
    try {
      const { data } = await notificationsApi.getAll({ page: pagination.page + 1, limit: pagination.limit });
      set({
        notifications: [...notifications, ...data.data.notifications],
        pagination:    data.data.pagination,
      });
    } catch (err) {
      console.error('[NotifStore] fetchMore error:', err.message);
    }
  },

  /* ── Lightweight unread count (used by polling) ── */
  fetchUnreadCount: async () => {
    try {
      const { data } = await notificationsApi.getUnreadCount();
      set({ unreadCount: data.data.count });
    } catch {
      /* Silently ignore — network blip during polling */
    }
  },

  /* ── Mark single as read ── */
  markRead: async (id) => {
    try {
      await notificationsApi.markRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      console.error('[NotifStore] markRead error:', err.message);
    }
  },

  /* ── Mark all as read ── */
  markAllRead: async () => {
    try {
      await notificationsApi.markAllRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount:   0,
      }));
    } catch (err) {
      console.error('[NotifStore] markAllRead error:', err.message);
    }
  },

  /* ── Delete a notification ── */
  deleteNotification: async (id) => {
    try {
      await notificationsApi.delete(id);
      set((state) => ({
        notifications: state.notifications.filter((n) => n._id !== id),
        unreadCount:   state.notifications.find((n) => n._id === id && !n.isRead)
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    } catch (err) {
      console.error('[NotifStore] deleteNotification error:', err.message);
    }
  },

  /* ── Optimistically add a notification (for future use) ── */
  addNotification: (notif) => {
    set((state) => ({
      notifications: [notif, ...state.notifications],
      unreadCount:   state.unreadCount + 1,
    }));
  },

  /* ── Start polling unread count ── */
  startPolling: () => {
    const { _pollingTimer, fetchUnreadCount } = get();
    if (_pollingTimer) return; // Already running

    fetchUnreadCount(); // Immediate first fetch

    const timer = setInterval(() => {
      fetchUnreadCount();
    }, POLL_INTERVAL_MS);

    set({ _pollingTimer: timer });
  },

  /* ── Stop polling ── */
  stopPolling: () => {
    const { _pollingTimer } = get();
    if (_pollingTimer) {
      clearInterval(_pollingTimer);
      set({ _pollingTimer: null });
    }
  },

  /* ── Reset store (on logout) ── */
  reset: () => {
    const { _pollingTimer } = get();
    if (_pollingTimer) clearInterval(_pollingTimer);
    set({
      notifications:  [],
      unreadCount:    0,
      isLoading:      false,
      pagination:     null,
      _pollingTimer:  null,
    });
  },
}));
