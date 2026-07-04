/**
 * store/chatStore.js
 * Zustand store for AI chat sessions and messages
 * Fixed: response envelope unwrapping (data.data.*), auto-session on send
 */

import { create } from 'zustand';
import { chatApi } from '@api/chat.api';

export const useChatStore = create((set, get) => ({
  /* ── State ── */
  sessions:          [],
  activeSession:     null,
  messages:          [],
  isLoadingSessions: false,
  isLoadingMessages: false,
  isSendingMessage:  false,
  isRetrying:        false,  // true while silently retrying after a quota/rate-limit error
  error:             null,

  /* ── Load all sessions ── */
  loadSessions: async () => {
    set({ isLoadingSessions: true, error: null });
    try {
      const { data } = await chatApi.getSessions();
      /* Backend: { success, data: { sessions } } */
      const sessions = data.data?.sessions ?? data.sessions ?? [];
      set({ sessions });
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  /* ── Load a session with messages ── */
  loadSession: async (sessionId) => {
    const state = get();
    // Skip fetch only if this is the SAME session AND all messages have real DB _ids
    // (temp-* ids mean we have optimistic state from a just-created session — still skip)
    const alreadyLoaded =
      state.activeSession?._id === sessionId &&
      state.messages.length > 0 &&
      state.messages.every((m) => !String(m._id).startsWith('temp-'));
    if (alreadyLoaded) return;

    set({ isLoadingMessages: true, error: null });
    try {
      const { data } = await chatApi.getSession(sessionId);
      /* Backend: { success, data: { session, messages } } */
      const session  = data.data?.session   ?? data.session;
      const messages = data.data?.messages  ?? data.messages ?? session?.messages ?? [];
      set({ activeSession: session, messages });
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  /* ── Create new session ── */
  createSession: async (payload = {}) => {
    const { data } = await chatApi.createSession(payload);
    /* Backend: { success, data: { session } } */
    const session = data.data?.session ?? data.session;
    set((state) => ({
      sessions:      [session, ...state.sessions],
      activeSession: session,
      messages:      [],
    }));
    return session;
  },

  /* ── Send message (auto-creates session if none active) ── */
  sendMessage: async (content, explicitSessionId) => {
    if (get().isSendingMessage) {
      console.warn('[chatStore] Concurrent request blocked.');
      return;
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      console.warn('[chatStore] sendMessage aborted: invalid or empty content');
      return;
    }

    set({ isSendingMessage: true, isRetrying: false, error: null });

    /* Resolve session: use explicit → active → create new */
    let sessionId = explicitSessionId ?? get().activeSession?._id;
    if (!sessionId) {
      try {
        const session = await get().createSession();
        sessionId = session._id;
      } catch (err) {
        set({ isSendingMessage: false, isRetrying: false, error: err.message });
        return;
      }
    }

    /* Optimistic user bubble */
    const tempId = `temp-${Date.now()}`;
    const userMessage = {
      _id:       tempId,
      role:      'user',
      content,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ messages: [...state.messages, userMessage] }));

    /* ── Attempt helper: one API call ── */
    const attempt = () => chatApi.sendMessage(sessionId, { content });

    /* ── Retry delays for quota/rate-limit errors (ms) ── */
    const RETRY_DELAYS = [5000, 12000];
    const isRecoverable = (err) => {
      const status = err?.statusCode || err?.status || 0;
      const msg    = err?.message || '';
      return (
        status === 429 || status === 503 || status === 502 ||
        msg.includes('quota') || msg.includes('unavailable') ||
        msg.includes('rate') || msg.includes('All AI models')
      );
    };

    let lastErr;
    try {
      for (let i = 0; i <= RETRY_DELAYS.length; i++) {
        try {
          if (i > 0) {
            // Show "still thinking" indicator and wait before retry
            set({ isRetrying: true });
            console.log(`[chatStore] Quota/rate-limit — retrying in ${RETRY_DELAYS[i - 1]}ms (attempt ${i + 1})`);
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[i - 1]));
          }

          console.log('[chatStore] Sending message payload:', { sessionId, content, attempt: i + 1 });
          const { data } = await attempt();

          /* Backend: { success, data: { userMessage, aiMessage } } */
          const savedUser = data.data?.userMessage ?? data.userMessage;
          const savedAI   = data.data?.aiMessage   ?? data.aiMessage;

          set((state) => ({
            messages: [
              ...state.messages.filter((m) => m._id !== tempId),
              savedUser,
              savedAI,
            ],
            sessions: state.sessions.map((s) =>
              s._id === sessionId
                ? { ...s, title: savedUser?.sessionTitle ?? s.title }
                : s
            ),
          }));

          return savedAI;

        } catch (err) {
          lastErr = err;
          console.error(`[chatStore] sendMessage attempt ${i + 1} failed:`, err?.message);
          if (!isRecoverable(err)) break; // non-recoverable — surface immediately
        }
      }

      /* All attempts exhausted */
      console.error('[chatStore] sendMessage — all retries failed:', lastErr);
      set((state) => ({
        messages: state.messages.filter((m) => m._id !== tempId),
        error:    lastErr?.message,
      }));
      throw lastErr;

    } finally {
      set({ isSendingMessage: false, isRetrying: false });
    }
  },

  /* ── Delete session ── */
  deleteSession: async (sessionId) => {
    await chatApi.deleteSession(sessionId);
    set((state) => ({
      sessions:      state.sessions.filter((s) => s._id !== sessionId),
      activeSession: state.activeSession?._id === sessionId ? null  : state.activeSession,
      messages:      state.activeSession?._id === sessionId ? []    : state.messages,
    }));
  },

  /* ── Clear active session ── */
  clearSession: () => set({ activeSession: null, messages: [] }),

  clearError: () => set({ error: null }),
}));
