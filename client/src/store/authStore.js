/**
 * store/authStore.js
 * Zustand global auth state with persistence
 *
 * State shape:
 *  user            – current user object (null if unauthenticated)
 *  accessToken     – short-lived JWT access token (memory only — NOT persisted)
 *  isLoading       – true while verifying session on initial load
 *  isAuthenticated – derived from user !== null; persisted to survive refresh
 *  _initialized    – internal flag: prevents duplicate initialize() calls
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi } from '@api/auth.api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      /* ── State ── */
      user:            null,
      accessToken:     null,
      isLoading:       true,
      isAuthenticated: false,
      _initialized:    false,   // idempotency flag

      /* ── Setters ── */
      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      setAccessToken: (token) =>
        set({ accessToken: token }),

      /* ── Initialize session on app boot ──
         Safe to call multiple times — only runs once per app lifecycle.
         Uses _initialized flag to prevent race conditions when both
         main.jsx and a route guard call initialize(). */
      initialize: async () => {
        if (get()._initialized) return;          // already ran — bail out
        set({ isLoading: true, _initialized: true });
        try {
          /* Backend envelope: { success, data: { accessToken, user } } */
          const { data } = await authApi.refreshToken();
          const payload  = data.data || data;    // unwrap envelope
          set({
            accessToken:     payload.accessToken,
            user:            payload.user,
            isAuthenticated: true,
          });
        } catch {
          /* No valid refresh cookie — treat as logged out */
          set({ user: null, accessToken: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      /* ── Login action ── */
      login: async (credentials) => {
        const { data } = await authApi.login(credentials);
        const payload  = data.data || data;
        set({
          user:            payload.user,
          accessToken:     payload.accessToken,
          isAuthenticated: true,
          _initialized:    true,   // login counts as initialization
        });
        return payload.user;
      },

      /* ── Register action ── */
      register: async (registerPayload) => {
        const { data } = await authApi.register(registerPayload);
        const payload  = data.data || data;
        set({
          user:            payload.user,
          accessToken:     payload.accessToken,
          isAuthenticated: true,
          _initialized:    true,
        });
        return payload.user;
      },

      /* ── Logout action ──
         1. Clears all auth state + persisted localStorage
         2. Resets the notification polling store to stop background API calls
         3. Clears the chat store so no stale messages show after re-login */
      logout: async () => {
        /* Stop notification polling FIRST to prevent 401 cascade */
        try {
          const { useNotificationStore } = await import('@store/notificationStore');
          useNotificationStore.getState().reset();
        } catch { /* store not yet loaded — safe to ignore */ }

        /* Clear chat store so the next user doesn't see previous sessions */
        try {
          const { useChatStore } = await import('@store/chatStore');
          useChatStore.setState({
            sessions: [], activeSession: null, messages: [],
            isLoadingSessions: false, isSendingMessage: false,
          });
        } catch { /* store not yet loaded — safe to ignore */ }

        try {
          await authApi.logout();
        } catch { /* server already invalidated — proceed with client cleanup */ }

        set({
          user:            null,
          accessToken:     null,
          isAuthenticated: false,
          _initialized:    false,  // allow re-initialization on next login
        });

        /* Wipe entire persisted slice so old role never bleeds into new session */
        useAuthStore.persist.clearStorage();
      },

      /* ── Update user profile in store (goes through persistence) ── */
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'arogyaai-auth',
      storage: createJSONStorage(() => localStorage),
      /* Persist user + isAuthenticated for instant UI on refresh.
         accessToken stays memory-only (security).
         _initialized is NOT persisted — always re-verify on boot. */
      partialize: (state) => ({
        user:            state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
