/**
 * pages/chat/ChatPage.jsx
 * AI Healthcare Chatbot — production-grade implementation with Voice AI
 *
 * Voice architecture:
 *  - All voice state owned by useVoiceOrchestrator
 *  - committedText lives in orchestrator refs (no render-loop)
 *  - handleSend reads from orchestrator.getFullText() — stable ref, no stale closures
 *  - Auto-send is triggered by orchestrator's onAutoSend callback
 *  - Textarea onChange writes ONLY to orchestrator.setCommittedText (not React state)
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '@store/chatStore';
import {
  Send, Plus, Trash2, MessageSquare, Sparkles,
  AlertTriangle, Bot,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useVoiceOrchestrator } from '@hooks/useVoiceOrchestrator';
import { stripMarkdownForTTS } from '@services/voice.service';
import VoiceControls from '@components/chat/VoiceControls';

const SUGGESTIONS = [
  'I have a headache and fever since yesterday',
  'What are the signs of high blood pressure?',
  'Can I take ibuprofen with metformin?',
  'I need to book an appointment urgently',
];

/* ── Typing indicator ── */
function TypingIndicator({ isRetrying }) {
  return (
    <div className="flex justify-start">
      <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-primary-400"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
        {isRetrying && (
          <span className="text-xs text-slate-400 ml-1 animate-pulse">
            Still thinking…
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Message bubble ── */
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser
            ? 'bg-primary-500 text-white rounded-br-sm'
            : 'glass-card text-slate-200 rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none
              prose-p:my-1 prose-headings:text-white prose-headings:font-semibold
              prose-strong:text-white prose-code:text-primary-300
              prose-ul:my-1 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Emergency banner */}
        {msg.isEmergency && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-danger-500/15 border border-danger-500/30 rounded-xl text-xs text-danger-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Emergency detected — call 112 if in immediate danger
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   Main Component
══════════════════════════════════════════ */
function ChatPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    sessions, messages, activeSession,
    isLoadingSessions, isSendingMessage, isRetrying,
    loadSessions, loadSession, createSession, sendMessage, deleteSession,
  } = useChatStore();

  /* ── Stable send handler ref — allows orchestrator to call it without stale closure ── */
  const handleSendRef = useRef(null);

  /* ── Voice Orchestrator ── */
  const voice = useVoiceOrchestrator({
    lang: 'en-IN',
    silenceMs: 2000,
    onAutoSend: useCallback((text) => {
      // Called directly from orchestrator — no React render race
      handleSendRef.current?.(text);
    }, []),
  });

  /* ── Scroll to bottom ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSendingMessage, voice.displayText]);

  /* ── Focus textarea when listening starts ── */
  useEffect(() => {
    if (voice.isListening && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [voice.isListening]);

  /* ── Load sessions on mount ── */
  useEffect(() => {
    loadSessions();
  // loadSessions is stable (Zustand action ref is stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load session from URL ── */
  useEffect(() => {
    if (sessionId) loadSession(sessionId);
  // loadSession is stable (Zustand action ref is stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /* ── Auto-resize textarea ── */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 144) + 'px';
  }, []);

  /* ── Core send handler ── */
  const handleSend = useCallback(async (textOverride) => {
    // textOverride is provided by orchestrator's onAutoSend (ref-based, no stale data)
    // For manual sends, we call voice.getFullText() which reads from refs
    const content = (textOverride ?? voice.getFullText()).trim();
    if (!content || isSendingMessage) return;

    // Stop listening and clear voice buffers immediately
    voice.stopListening();
    voice.stopSpeaking();
    voice.clearAfterSend();
    voice.setProcessing(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const aiMsg = await sendMessage(content);

      /* After auto-create: navigate to new session */
      const newSession = useChatStore.getState().activeSession;
      if (newSession && !sessionId) {
        navigate(`/chat/${newSession._id}`, { replace: true });
      }

      voice.setProcessing(false);

      /* Auto-speak AI response */
      if (aiMsg?.content) {
        const plainText = stripMarkdownForTTS(aiMsg.content);
        voice.speak(plainText);
      }
    } catch (err) {
      voice.setProcessing(false);
      // Map quota / backend errors to user-friendly language — never expose raw API messages
      const rawMsg = err?.message ?? '';
      const isQuotaOrUnavailable =
        err?.statusCode === 429 || err?.statusCode === 503 || err?.statusCode === 502 ||
        rawMsg.includes('quota') || rawMsg.includes('All AI models') ||
        rawMsg.includes('unavailable') || rawMsg.includes('rate');

      const userMsg = isQuotaOrUnavailable
        ? 'ArogyaAI is under high demand right now. Please try again in a moment.'
        : (rawMsg || 'Failed to send message. Please try again.');

      toast.error(userMsg, { duration: 5000 });
    }
  }, [isSendingMessage, sendMessage, sessionId, navigate, voice]);

  /* Keep handleSendRef in sync so orchestrator can call the latest version */
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleNewChat = async () => {
    try {
      const session = await createSession();
      navigate(`/chat/${session._id}`, { replace: false });
    } catch {
      toast.error('Could not create a new chat');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteSession(id);
      if (activeSession?._id === id) navigate('/chat', { replace: true });
    } catch {
      toast.error('Could not delete session');
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 lg:-m-8 overflow-hidden">

      {/* ── Session sidebar ── */}
      <aside className="w-60 flex-shrink-0 border-r border-white/5 flex flex-col bg-dark-900/40 hidden md:flex">
        <div className="p-3 border-b border-white/5">
          <button
            id="new-chat-btn"
            onClick={handleNewChat}
            className="btn-primary w-full text-sm py-2"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
          {isLoadingSessions ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-9 rounded-xl" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 px-3">
              <MessageSquare className="w-7 h-7 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No chats yet</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session._id}
                role="button"
                tabIndex={0}
                id={`session-${session._id}`}
                onClick={() => navigate(`/chat/${session._id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/chat/${session._id}`)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all group flex items-center justify-between gap-2 cursor-pointer ${
                  activeSession?._id === session._id
                    ? 'bg-primary-500/15 text-white border border-primary-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="truncate">{session.title || 'New Conversation'}</span>
                <button
                  onClick={(e) => handleDeleteSession(e, session._id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-danger-400 transition-all flex-shrink-0"
                  aria-label="Delete session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="h-13 px-5 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">ArogyaAI Assistant</p>
            <p className="text-xs text-slate-500">Powered by Gemini AI</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
            <span className="text-xs text-success-400">Online</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto scrollable px-4 py-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-lg"
              >
                <MessageSquare className="w-10 h-10 text-white" />
              </motion.div>
              <div className="text-center">
                <h2 className="text-xl font-display font-bold text-white mb-2">How can I help you today?</h2>
                <p className="text-slate-400 text-sm max-w-sm">
                  Describe your symptoms, ask about medications, or get health guidance — 24/7.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-md w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-left p-3 rounded-xl glass-card-hover text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <MessageBubble key={msg._id ?? idx} msg={msg} />
              ))}
              {isSendingMessage && <TypingIndicator isRetrying={isRetrying} />}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="p-3 border-t border-white/5 flex-shrink-0">

          {/* ── Google-style listening status bar ── */}
          <AnimatePresence>
            {voice.isListening && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2
                               bg-primary-500/8 border border-primary-500/20
                               rounded-xl">
                  <div className="flex items-center gap-2.5">
                    {/* Pulsing red dot — universally understood as "recording" */}
                    <motion.span
                      className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <span className="text-xs font-medium text-primary-300 tracking-wide">
                      Listening
                    </span>
                    {/* Animated sound bars */}
                    <div className="flex items-end gap-0.5 h-3">
                      {[0.4, 0.75, 1, 0.6, 0.85].map((h, i) => (
                        <motion.span
                          key={i}
                          className="w-0.5 bg-primary-400 rounded-full"
                          animate={{ scaleY: [h, h * 0.3, h] }}
                          transition={{
                            duration: 0.6 + i * 0.1,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: i * 0.08,
                          }}
                          style={{ height: `${h * 100}%`, transformOrigin: 'bottom' }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Speak now — sends automatically
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Input box — glows while listening ── */}
          <div
            className="relative flex items-end gap-2 glass-card px-3 py-2 transition-all duration-300"
            style={voice.isListening ? {
              boxShadow: '0 0 0 1.5px rgba(99,102,241,0.45), 0 0 12px rgba(99,102,241,0.12)',
            } : undefined}
          >
            {/* Voice Controls */}
            <VoiceControls
              isListening={voice.isListening}
              isMuted={false}
              isSpeaking={voice.isSpeaking}
              isSupported={voice.isSTTSupported}
              permissionState={voice.permissionState}
              interimTranscript=""
              transcript=""
              error={voice.voiceError}
              onToggleListening={() => {
                if (isSendingMessage || voice.isProcessing) return;
                voice.toggleListening();
              }}
              onToggleMute={() => {}}
              onStopListening={voice.stopListening}
              onClearTranscript={() => voice.clearAfterSend()}
              onStopSpeaking={voice.stopSpeaking}
              onReplay={voice.replaySpeech}
              onUseTranscript={() => {}}
              hasLastSpoken={false}
            />

            <textarea
              ref={textareaRef}
              id="chat-input"
              value={voice.displayText}
              onChange={(e) => {
                voice.setCommittedText(e.target.value);
                if (voice.isSpeaking) voice.stopSpeaking();
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                voice.isListening
                  ? 'Speak now…'
                  : 'Describe your symptoms or ask a health question...'
              }
              rows={1}
              disabled={isSendingMessage || voice.isProcessing}
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none focus:outline-none min-h-[24px] max-h-36 disabled:opacity-60 py-1"
              style={{ scrollbarWidth: 'none' }}
            />

            <div className="flex items-center gap-1.5 flex-shrink-0 pb-0.5">
              <button
                id="send-message-btn"
                onClick={() => handleSend()}
                disabled={!voice.displayText.trim() || isSendingMessage || voice.isProcessing}
                className="w-8 h-8 rounded-xl bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600 text-center mt-1.5">
            ArogyaAI is not a substitute for professional medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
