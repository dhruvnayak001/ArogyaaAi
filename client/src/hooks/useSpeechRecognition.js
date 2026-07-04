/**
 * hooks/useSpeechRecognition.js
 * Production-grade Web Speech API hook for voice-to-text.
 *
 * NOTE: This hook is a standalone, self-contained implementation.
 * ChatPage uses useVoiceOrchestrator instead — this hook is available
 * for simpler use-cases (e.g., a single-field voice input).
 *
 * Features:
 *  - Continuous listening mode
 *  - Interim (live) transcript preview
 *  - Final transcript accumulation
 *  - Microphone permission handling
 *  - Auto-restart on unexpected stops
 *  - Browser support detection
 *  - Proper cleanup on unmount
 *  - Error recovery
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/* ── Browser API detection ── */
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/**
 * @typedef {object} UseSpeechRecognitionOptions
 * @property {string}   [lang='en-IN']       - BCP-47 language code
 * @property {boolean}  [continuous=true]     - Keep listening after pauses
 * @property {boolean}  [interimResults=true] - Show live partial transcripts
 * @property {function} [onResult]            - Called with final transcript text
 * @property {function} [onError]             - Called with error event
 * @property {function} [onInterim]           - Called with interim transcript text
 * @property {number}   [silenceTimeoutMs]    - Stop recording after MS of silence
 * @property {function} [onSilence]           - Called when silence timeout triggers
 */

/**
 * @param {UseSpeechRecognitionOptions} options
 */
export function useSpeechRecognition({
  lang = 'en-IN',
  continuous = true,
  interimResults = true,
  onResult,
  onError,
  onInterim,
  silenceTimeoutMs = 0,
  onSilence,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported] = useState(!!SpeechRecognition);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [error, setError] = useState(null);

  const recognitionRef     = useRef(null);
  const isListeningRef     = useRef(false);   // sync ref for event handlers
  const shouldRestartRef   = useRef(false);   // for continuous mode auto-restart
  const finalTranscriptRef = useRef('');      // accumulated final transcript
  const isMutedRef         = useRef(false);
  const silenceTimerRef    = useRef(null);

  /* ── Keep refs in sync ── */
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  /* ── Store latest callbacks in refs to avoid recognition re-init ── */
  const onResultRef  = useRef(onResult);
  const onErrorRef   = useRef(onError);
  const onInterimRef = useRef(onInterim);
  const onSilenceRef = useRef(onSilence);

  useEffect(() => { onResultRef.current  = onResult;  }, [onResult]);
  useEffect(() => { onErrorRef.current   = onError;   }, [onError]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onSilenceRef.current = onSilence; }, [onSilence]);

  /* ── Check microphone permission ──
     NOTE: use addEventListener instead of .onchange to allow proper cleanup */
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
      .catch(() => { /* permissions API not supported — that's fine */ });

    return () => {
      if (permStatus) permStatus.removeEventListener('change', handleChange);
    };
  }, []);

  /* ── Silence timer helpers ── */
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback((recognition) => {
    clearSilenceTimer();
    if (silenceTimeoutMs > 0) {
      silenceTimerRef.current = setTimeout(() => {
        onSilenceRef.current?.();
        try { recognition.stop(); } catch { /* noop */ }
        setIsListening(false);
        isListeningRef.current = false;
      }, silenceTimeoutMs);
    }
  }, [clearSilenceTimer, silenceTimeoutMs]);

  /* ── Initialize recognition instance ── */
  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous     = continuous;
    recognition.interimResults = interimResults;
    recognition.lang           = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      if (isMutedRef.current) return;

      let interim = '';
      let final   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        const trimmed = final.trim();
        finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + trimmed;
        setTranscript(finalTranscriptRef.current);
        onResultRef.current?.(trimmed);
      }

      setInterimTranscript(interim);
      if (interim) onInterimRef.current?.(interim);

      /* Reset silence timer on any speech activity */
      armSilenceTimer(recognition);
    };

    recognition.onerror = (event) => {
      const errorMsg = event.error;
      console.warn('SpeechRecognition error:', errorMsg);
      setError(errorMsg);

      if (errorMsg === 'not-allowed' || errorMsg === 'service-not-allowed') {
        setPermissionState('denied');
        setIsListening(false);
        isListeningRef.current = false;
        shouldRestartRef.current = false;
      } else if (errorMsg === 'aborted') {
        // User or programmatic abort — don't restart
        setIsListening(false);
        isListeningRef.current = false;
      } else if (errorMsg === 'no-speech') {
        // Silence timeout — restart if in continuous mode
        if (shouldRestartRef.current && continuous) {
          try { recognition.start(); } catch { /* already running */ }
        }
      } else {
        // network, audio-capture, etc. — stop listening
        setIsListening(false);
        isListeningRef.current = false;
        shouldRestartRef.current = false;
      }

      onErrorRef.current?.(event);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      isListeningRef.current = false;

      if (shouldRestartRef.current) {
        /* Safe restart with delay to avoid rapid-fire errors */
        setTimeout(() => {
          if (!shouldRestartRef.current) return;
          try {
            recognition.start();
            setIsListening(true);
            isListeningRef.current = true;
          } catch {
            setIsListening(false);
            setError('Failed to restart microphone');
          }
        }, 250);
        return;
      }

      setIsListening(false);
    };

    recognition.onsoundstart = () => setError(null);

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      isListeningRef.current   = false;
      clearSilenceTimer();
      try { recognition.abort(); } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, continuous, interimResults]);  // intentionally exclude callbacks — they use refs

  /* ── Start listening ── */
  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) return;
    setError(null);
    setInterimTranscript('');
    finalTranscriptRef.current = '';
    setTranscript('');
    setIsMuted(false);
    shouldRestartRef.current = true;

    try {
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch (err) {
      // Already started — ignore
      if (err.name === 'InvalidStateError') {
        setIsListening(true);
        isListeningRef.current = true;
      }
    }
  }, [isSupported]);

  /* ── Stop listening ── */
  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    isListeningRef.current   = false;
    clearSilenceTimer();
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setIsListening(false);
    setInterimTranscript('');
  }, [clearSilenceTimer]);

  /* ── Abort listening (discard results) ── */
  const abortListening = useCallback(() => {
    shouldRestartRef.current = false;
    isListeningRef.current   = false;
    clearSilenceTimer();
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    setIsListening(false);
    setInterimTranscript('');
  }, [clearSilenceTimer]);

  /* ── Toggle mute (keeps recognition running but ignores results) ── */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  /* ── Toggle listening ── */
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  /* ── Clear accumulated transcript ── */
  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    // State
    isListening,
    isMuted,
    transcript,
    interimTranscript,
    isSupported,
    permissionState,
    error,

    // Actions
    startListening,
    stopListening,
    abortListening,
    toggleListening,
    toggleMute,
    clearTranscript,
  };
}
