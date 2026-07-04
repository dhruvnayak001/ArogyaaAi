/**
 * hooks/useVoiceOrchestrator.js
 *
 * Google Voice Search–style voice UX.
 *
 * Architecture:
 *  - continuous = true  → browser manages the audio session; zero restart gap
 *  - All recognition helpers (flush, armTimer, etc.) live INSIDE the useEffect
 *    so there are zero stale-closure risks from external useCallback references
 *  - Single 500ms silence timer — the only timer in the system
 *  - silenceMsRef / onAutoSendRef — always-current refs for values used inside the effect
 *  - Flat useState (no useReducer) — minimal render overhead
 *
 * Public API identical to previous version — ChatPage requires no changes.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/* ─────────────────────────────────────────────
   Browser API detection
───────────────────────────────────────────── */
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const synthAPI = typeof window !== 'undefined' ? window.speechSynthesis : null;

/* ─────────────────────────────────────────────
   Voice status constants (kept for API compat)
───────────────────────────────────────────── */
const VOICE_STATES = Object.freeze({
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  ERROR: 'error',
});

/* ─────────────────────────────────────────────
   Main hook
───────────────────────────────────────────── */

/**
 * @param {object}   options
 * @param {string}   [options.lang='en-IN']
 * @param {number}   [options.silenceMs=2000] - ms of silence before auto-send
 * @param {function} [options.onAutoSend]     - called with the full text to send
 * @param {boolean}  [options.autoSpeak=true] - speak AI responses automatically
 */
export function useVoiceOrchestrator({
  lang = 'en-IN',
  silenceMs = 500,
  onAutoSend,
  autoSpeak = true,
} = {}) {

  /* ── Flat state ── */
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [displayText, setDisplayText] = useState('');
  const [permissionState, setPermissionState] = useState('prompt');

  /* ── Support detection ── */
  const isSTTSupported = !!SpeechRecognitionAPI;
  const isTTSSupported = !!synthAPI;

  /* ──────────────────────────────────────────
     Refs — always-current values for use inside event handlers
  ────────────────────────────────────────── */
  const committedTextRef = useRef('');    // finalized text (speech + typed)
  const interimTextRef = useRef('');    // live in-progress segment
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const watchdogRef = useRef(null);
  const shouldRestartRef = useRef(false); // true while mic should stay active
  const pendingAutoSendRef = useRef(false); // set by silence timer, consumed in onend
  const isListeningRef = useRef(false); // sync mirror of isListening state
  const lastSpokenRef = useRef('');

  /* ── Always-current prop refs (safe to read inside useEffect closures) ── */
  const langRef = useRef(lang);
  const silenceMsRef = useRef(silenceMs);
  const onAutoSendRef = useRef(onAutoSend);
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { silenceMsRef.current = silenceMs; }, [silenceMs]);
  useEffect(() => { onAutoSendRef.current = onAutoSend; }, [onAutoSend]);

  const startListeningRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const armTimer = useCallback((recognition) => {
    clearTimer();
    silenceTimerRef.current = setTimeout(() => {
      console.log('[Voice] silence timeout — queuing auto-send');
      pendingAutoSendRef.current = true;
      shouldRestartRef.current = false;
      try { recognition.stop(); } catch { /* noop */ }
    }, silenceMsRef.current);
  }, [clearTimer]);

  const doAutoSend = useCallback(() => {
    const interim = interimTextRef.current.trim();
    if (interim) {
      const sep = committedTextRef.current && !committedTextRef.current.endsWith(' ') ? ' ' : '';
      committedTextRef.current += sep + interim;
      interimTextRef.current = '';
    }
    const text = committedTextRef.current.trim();
    // Minimum gate: require at least 2 words to avoid noise or accidental "Hmm" triggers
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    console.log('[Voice] auto-send check:', JSON.stringify(text), `(${wordCount} words)`);
    if (wordCount >= 2) {
      onAutoSendRef.current?.(text);
    } else {
      console.log('[Voice] auto-send skipped: too short');
    }
  }, []);

  const createRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI) return null;

    const r = new SpeechRecognitionAPI();
    r.continuous = true;
    r.interimResults = true;
    r.lang = langRef.current; // Use the configured language (defaults to 'en-IN') to properly support English/Hinglish without forcing Hindi
    r.maxAlternatives = 1;

    const logEvent = (name, extra = '') => {
      console.log(`[Voice][${new Date().toISOString()}] ${name} ${extra}`);
    };

    r.onaudiostart = () => logEvent('onaudiostart');
    r.onsoundstart = () => { logEvent('onsoundstart'); setVoiceError(null); };
    r.onspeechend = () => logEvent('onspeechend');
    r.onsoundend = () => logEvent('onsoundend');
    r.onaudioend = () => logEvent('onaudioend');

    r.onstart = () => {
      logEvent('onstart');
    };

    r.onspeechstart = () => {
      logEvent('onspeechstart');
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        console.warn('[VOICE] watchdog restart: no onresult 4s after onspeechstart');
        try { r.abort(); } catch { }
        startListeningRef.current?.(true);
      }, 4000);
    };

    r.onresult = (event) => {
      clearWatchdog();

      let newFinal = '';
      let newInterim = '';
      let logs = [];
      // IMPORTANT: start from event.resultIndex, NOT 0.
      // In continuous mode, results before resultIndex are already committed.
      // Starting from 0 causes every word to be duplicated on each new event.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        const confidence = result[0].confidence;

        // Confidence filtering: skip low-confidence noise results
        // (confidence is only reliable on final results; interim is always 0)
        if (result.isFinal && confidence > 0 && confidence < 0.7) {
          console.log(`[Voice] Discarding low-confidence result (${confidence.toFixed(2)}): "${text}"`);
          continue;
        }

        if (result.isFinal) {
          newFinal += text + ' ';
        } else {
          newInterim += text;
        }
        logs.push(`{transcript: "${text}", isFinal: ${result.isFinal}, confidence: ${confidence?.toFixed(2)}}`);
      }

      // Ignore empty events
      if (!newFinal && !newInterim) return;

      if (newFinal) {
        // Minimum word gate: discard single-character noise bursts
        const wordCount = newFinal.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount === 0) return;

        const c = committedTextRef.current;
        const sep = c && !c.endsWith(' ') && !newFinal.startsWith(' ') ? ' ' : '';
        const cleanedFinal = newFinal.trim();

        if (cleanedFinal.length > 0) {
          committedTextRef.current = (
            committedTextRef.current +
            ' ' +
            cleanedFinal
          ).trim();
        }
      }

      // ALWAYS update interimTextRef.current to the absolute latest interim speech
      interimTextRef.current = newInterim.trim();

      const committed = committedTextRef.current;
      const interim = interimTextRef.current;
      const sep = committed && interim && !committed.endsWith(' ') ? ' ' : '';
      const newDisplay = committed + sep + interim;

      // DIRECT IMMEDIATE RENDERING
      setDisplayText(newDisplay);

      logEvent('onresult', `events: [${logs.join(', ')}] | committedText: "${committed}" | interimText: "${interim}" | displayText: "${newDisplay}"`);

      armTimer(r);
    };

    r.onend = () => {
      logEvent('onend', `| shouldRestart: ${shouldRestartRef.current} | pendingAutoSend: ${pendingAutoSendRef.current}`);
      clearTimer();
      clearWatchdog();
      isListeningRef.current = false;

      if (pendingAutoSendRef.current) {
        pendingAutoSendRef.current = false;
        shouldRestartRef.current = false;
        setIsListening(false);
        doAutoSend();
        return;
      }

      if (shouldRestartRef.current) {
        console.log('[Voice] seamless restart — fresh instance');
        try {
          startListeningRef.current?.(true);
          return;
        } catch (e) {
          console.warn('[Voice] seamless restart failed:', e.message);
        }
      }

      setIsListening(false);
    };

    r.onerror = (event) => {
      clearWatchdog();
      const { error } = event;
      logEvent('onerror', error);

      if (error === 'aborted' || error === 'no-speech') return;

      if (error === 'not-allowed' || error === 'service-not-allowed') {
        setPermissionState('denied');
        shouldRestartRef.current = false;
        setIsListening(false);
        isListeningRef.current = false;
        setVoiceError('Microphone permission denied');
        return;
      }

      console.warn('[Voice] STT error:', error);
      shouldRestartRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      setVoiceError(error);
    };

    console.log('[Voice] fresh instance created, lang:', r.lang);
    return r;
  }, [armTimer, clearTimer, clearWatchdog, doAutoSend]);

  useEffect(() => {
    return () => {
      console.log('[Voice] effect cleanup');
      shouldRestartRef.current = false;
      isListeningRef.current = false;
      clearTimer();
      clearWatchdog();
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      recognitionRef.current = null;
    };
  }, [clearTimer, clearWatchdog]);

  /* ── Permission check ── */
  useEffect(() => {
    if (!navigator.permissions) return;
    let permStatus = null;
    const handleChange = () => {
      if (permStatus) setPermissionState(permStatus.state);
    };
    navigator.permissions.query({ name: 'microphone' })
      .then((status) => {
        permStatus = status;
        setPermissionState(status.state);
        status.addEventListener('change', handleChange);
      })
      .catch(() => { });
    return () => {
      if (permStatus) permStatus.removeEventListener('change', handleChange);
    };
  }, []);

  /* ──────────────────────────────────────────
     Public API
  ────────────────────────────────────────── */

  const startListening = useCallback((isRestart = false) => {
    if (!isSTTSupported) return;

    console.log('[Voice] startListening — new session, isRestart:', isRestart);

    if (synthAPI) synthAPI.cancel();
    setIsSpeaking(false);

    if (isRestart !== true) {
      committedTextRef.current = '';
      interimTextRef.current = '';
      pendingAutoSendRef.current = false;
      setDisplayText('');
      setVoiceError(null);
    }

    clearTimer();
    clearWatchdog();

    try {
      recognitionRef.current?.abort();
    } catch { }
    recognitionRef.current = null;

    const recognition = createRecognition();
    if (!recognition) {
      console.warn('[Voice] startListening — createRecognition returned null');
      return;
    }

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    isListeningRef.current = true;

    try {
      recognition.start();
      setIsListening(true);
      console.log('[Voice] recognition.start() OK');
    } catch (err) {
      console.warn('[Voice] recognition.start() failed:', err.name, err.message);
      isListeningRef.current = false;
      shouldRestartRef.current = false;
    }
  }, [isSTTSupported, clearTimer, clearWatchdog, createRecognition]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    console.log('[Voice] stopListening');
    shouldRestartRef.current = false;
    pendingAutoSendRef.current = false;
    isListeningRef.current = false;
    clearTimer();
    clearWatchdog();

    // Preserve interim text if mic stops abruptly
    if (interimTextRef.current) {
      const sep = committedTextRef.current && !committedTextRef.current.endsWith(' ') ? ' ' : '';
      committedTextRef.current += sep + interimTextRef.current.trim();
      interimTextRef.current = '';
    }

    setDisplayText(committedTextRef.current);
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
  }, [clearTimer, clearWatchdog]);

  const abortListening = useCallback(() => {
    console.log('[Voice] abortListening');
    shouldRestartRef.current = false;
    pendingAutoSendRef.current = false;
    isListeningRef.current = false;
    clearTimer();
    clearWatchdog();

    // Preserve interim text if mic aborts abruptly
    if (interimTextRef.current) {
      const sep = committedTextRef.current && !committedTextRef.current.endsWith(' ') ? ' ' : '';
      committedTextRef.current += sep + interimTextRef.current.trim();
      interimTextRef.current = '';
    }

    setDisplayText(committedTextRef.current);
    setIsListening(false);
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
  }, [clearTimer, clearWatchdog]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  /**
   * Called by ChatPage when user types manually.
   * Writes directly to committedTextRef — no render loop.
   */
  const setCommittedText = useCallback((text) => {
    committedTextRef.current = text;
    if (isListeningRef.current && interimTextRef.current) {
      interimTextRef.current = '';
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      shouldRestartRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      clearWatchdog();
    }
    setDisplayText(text);
  }, [clearWatchdog]);

  /** Read current full text (committed + interim) — no render triggered */
  const getFullText = useCallback(() => {
    const committed = committedTextRef.current;
    const interim = interimTextRef.current.trim();
    if (!interim) return committed;
    const sep = committed && !committed.endsWith(' ') ? ' ' : '';
    return committed + sep + interim;
  }, []);

  /** Called by ChatPage after a successful send */
  const clearAfterSend = useCallback(() => {
    committedTextRef.current = '';
    interimTextRef.current = '';
    pendingAutoSendRef.current = false;
    setDisplayText('');
    clearWatchdog();
  }, [clearWatchdog]);

  /** Mark AI request in flight */
  const setProcessing = useCallback((isProc) => {
    setIsProcessing(isProc);
  }, []);

  /* ── Synthesize voiceStatus string for API compat ── */
  const voiceStatus =
    isProcessing ? VOICE_STATES.PROCESSING :
      isSpeaking ? VOICE_STATES.SPEAKING :
        isListening ? VOICE_STATES.LISTENING :
          voiceError ? VOICE_STATES.ERROR :
            VOICE_STATES.IDLE;

  /* ── TTS ── */
  const stopSpeaking = useCallback(() => {
    if (synthAPI) synthAPI.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text) => {
    if (!synthAPI || !text?.trim()) return;
    synthAPI.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;

    const loadAndSpeak = () => {
      const voices = synthAPI.getVoices();
      const preferred =
        voices.find(v => v.lang.startsWith('en') && !v.localService) ??
        voices.find(v => v.lang.startsWith('en')) ??
        voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { utteranceRef.current = null; setIsSpeaking(false); };
      utterance.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[TTS] error:', e.error);
        }
        utteranceRef.current = null;
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      lastSpokenRef.current = text.trim();
      synthAPI.speak(utterance);
    };

    if (synthAPI.getVoices().length > 0) {
      loadAndSpeak();
    } else {
      synthAPI.addEventListener('voiceschanged', loadAndSpeak, { once: true });
    }
  }, [lang]);

  const replaySpeech = useCallback(() => {
    if (lastSpokenRef.current) speak(lastSpokenRef.current);
  }, [speak]);

  return {
    /* State */
    voiceStatus,
    voiceError,
    displayText,
    permissionState,
    isListening,
    isProcessing,
    isSpeaking,
    isIdle: voiceStatus === VOICE_STATES.IDLE,
    isSTTSupported,
    isTTSSupported,
    VOICE_STATES,

    /* Actions */
    startListening,
    stopListening,
    abortListening,
    toggleListening,
    setCommittedText,
    getFullText,
    clearAfterSend,
    setProcessing,
    speak,
    stopSpeaking,
    replaySpeech,
  };
}
