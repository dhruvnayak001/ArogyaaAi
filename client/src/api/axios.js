/**
 * api/axios.js
 * Configured Axios instance with:
 *  - Base URL routed through Vite dev proxy (/api/v1 → https://arogyaaai.onrender.com/api/v1)
 *  - JWT auth header injection
 *  - Automatic silent token refresh on 401 with request queue
 *  - Centralized error normalization
 */

import axios from 'axios';
import { useAuthStore } from '@store/authStore';

/* ── Use relative URL so Vite proxy handles CORS in dev.
      In production, set VITE_API_URL in the build env.      ── */
const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const apiClient = axios.create({
  baseURL:         BASE_URL,
  timeout:         30_000,
  withCredentials: true,       // Required for httpOnly refresh cookie
  headers: {
    /*
     * DO NOT set Content-Type here.
     * For JSON requests axios sets "application/json" automatically.
     * For FormData (file upload) axios sets "multipart/form-data; boundary=..."
     * automatically — hardcoding Content-Type here would strip the boundary
     * and break multer's multipart parser with "Unexpected field".
     */
    'Accept': 'application/json',
  },
});

/* ── Request interceptor: inject Bearer token ── */
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response interceptor: silent refresh on 401 ── */
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) =>
    error ? prom.reject(error) : prom.resolve(token)
  );
  refreshQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    /* Only attempt refresh for 401s that aren't themselves the refresh call */
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      /* Safety timeout: if the refresh hangs beyond 35s (5s > axios timeout),
         drain the queue with an error so subsequent requests aren't blocked
         indefinitely. This guards against OS-level TCP hangs where the socket
         is accepted but the server never responds. */
      const REFRESH_TIMEOUT_MS = 35_000;
      const refreshTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Token refresh timed out')), REFRESH_TIMEOUT_MS)
      );

      try {
        /* Use same relative base — proxy handles it */
        const { data } = await Promise.race([
          axios.post(
            `${BASE_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          ),
          refreshTimeout,
        ]);
        /* Backend returns { success, data: { accessToken, user } } */
        const newToken = data.data?.accessToken || data.accessToken;
        const newUser  = data.data?.user        || data.user;

        /* Update both token AND user so role/state stay in sync */
        useAuthStore.getState().setAccessToken(newToken);
        if (newUser) {
          useAuthStore.getState().setUser(newUser);
        }

        isRefreshing = false;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);

        /* ── Only force logout on definitive auth failures (401) ──
           If the refresh endpoint returns 500/502/503 or network errors,
           that is a transient backend issue — do NOT log the user out.
           They will naturally retry when the next API call fires. */
        const refreshStatus = refreshError.response?.status;
        const isAuthFailure = refreshStatus === 401 || refreshStatus === 403;

        if (isAuthFailure) {
          /* ── Clean logout: stop polling, clear state, then navigate ──
             Use React Router-aware navigation instead of hard location reload
             so the app shell cleans up properly (unmounts, clears timers, etc.)
             We dynamically import the store reset to avoid circular deps. */
          const { logout } = useAuthStore.getState();
          try { await logout(); } catch { /* already logged out */ }

          /* Notify listeners that auth failed (e.g. polling store) */
          window.dispatchEvent(new CustomEvent('arogyaai:auth-failed'));

          /* Soft navigation — let React Router handle the redirect cleanly */
          window.location.replace('/login');
        } else {
          /* Transient server error — log it but keep the user logged in */
          console.warn('[api] Token refresh failed with server error:', refreshStatus, '— will retry on next request');
        }

        return Promise.reject(refreshError);
      }
    }

    /* Normalize error shape — make it a proper Error object */
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    const normalizedError = new Error(message);
    normalizedError.statusCode = error.response?.status || 500;
    normalizedError.errors     = error.response?.data?.errors || [];

    return Promise.reject(normalizedError);
  }
);

export default apiClient;
