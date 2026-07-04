/**
 * hooks/useSpeechSynthesis.js
 * Text-to-Speech hook using the Web Speech API (SpeechSynthesis).
 *
 * Features:
 *  - Speak any text with play/pause/resume/stop
 *  - Speaking state indicator
 *  - Cancel current speech when starting new one
 *  - Voice selection
 *  - Rate / pitch control
 *  - Queue management
 *  - Browser support detection
 *  - Proper cleanup on unmount
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

/**
 * @typedef {object} UseSpeechSynthesisOptions
 * @property {string}  [lang='en-IN']  - BCP-47 language code
 * @property {number}  [rate=1]        - Speech rate (0.1–10)
 * @property {number}  [pitch=1]       - Speech pitch (0–2)
 * @property {string}  [voiceName]     - Preferred voice name
 * @property {function} [onEnd]        - Called when speaking finishes
 * @property {function} [onError]      - Called on error
 */

/**
 * @param {UseSpeechSynthesisOptions} options
 */
export function useSpeechSynthesis({
  lang = 'en-IN',
  rate = 1,
  pitch = 1,
  voiceName,
  onEnd,
  onError,
} = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused]     = useState(false);
  const [isSupported]               = useState(!!synth);
  const [voices, setVoices]         = useState([]);

  const utteranceRef    = useRef(null);
  const lastSpokenRef   = useRef('');
  const onEndRef        = useRef(onEnd);
  const onErrorRef      = useRef(onError);

  useEffect(() => { onEndRef.current  = onEnd; },  [onEnd]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  /* ── Load available voices ── */
  useEffect(() => {
    if (!synth) return;

    const loadVoices = () => {
      const available = synth.getVoices();
      setVoices(available);
    };

    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    return () => synth.removeEventListener('voiceschanged', loadVoices);
  }, []);

  /* ── Find best matching voice ── */
  const getVoice = useCallback(() => {
    if (!voices.length) return null;

    // Prefer explicit voiceName
    if (voiceName) {
      const exact = voices.find((v) => v.name === voiceName);
      if (exact) return exact;
    }

    // Prefer voices matching the language
    const langVoices = voices.filter((v) => v.lang.startsWith(lang.split('-')[0]));

    // Prefer non-local (higher quality) voices
    const premium = langVoices.find((v) => !v.localService);
    if (premium) return premium;

    // Fallback to any matching language
    if (langVoices.length) return langVoices[0];

    // Fallback to any English voice
    const englishVoice = voices.find((v) => v.lang.startsWith('en'));
    if (englishVoice) return englishVoice;

    // Ultimate fallback — first available voice
    return voices[0];
  }, [voices, lang, voiceName]);

  /* ── Speak text ── */
  const speak = useCallback((text) => {
    if (!synth || !text?.trim()) return;

    // Cancel any current speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    const voice = getVoice();
    if (voice) utterance.voice = voice;
    utterance.lang  = lang;
    utterance.rate  = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      onEndRef.current?.();
    };

    utterance.onerror = (event) => {
      // 'interrupted' and 'canceled' are normal when we call cancel()
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.warn('SpeechSynthesis error:', event.error);
        onErrorRef.current?.(event);
      }
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    lastSpokenRef.current = text.trim();
    synth.speak(utterance);
  }, [getVoice, lang, rate, pitch]);

  /* ── Stop speaking ── */
  const stop = useCallback(() => {
    if (!synth) return;
    synth.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  /* ── Pause ── */
  const pause = useCallback(() => {
    if (!synth || !isSpeaking) return;
    synth.pause();
    setIsPaused(true);
  }, [isSpeaking]);

  /* ── Resume ── */
  const resume = useCallback(() => {
    if (!synth || !isPaused) return;
    synth.resume();
    setIsPaused(false);
  }, [isPaused]);

  /* ── Toggle pause/resume ── */
  const togglePause = useCallback(() => {
    if (isPaused) {
      resume();
    } else if (isSpeaking) {
      pause();
    }
  }, [isPaused, isSpeaking, pause, resume]);

  /* ── Replay last spoken text ── */
  const replay = useCallback(() => {
    if (lastSpokenRef.current) {
      speak(lastSpokenRef.current);
    }
  }, [speak]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (synth) synth.cancel();
    };
  }, []);

  return {
    // State
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    lastSpokenText: lastSpokenRef.current,

    // Actions
    speak,
    stop,
    pause,
    resume,
    togglePause,
    replay,
  };
}
