/**
 * hooks/useVoiceSymptoms.js
 *
 * Thin, purpose-built hook for the appointment symptom voice input.
 * Wraps useSpeechRecognition with:
 *  - Multilingual language switching (hi-IN, mr-IN, en-IN)
 *  - Append-mode: new speech appends to existing text (never overwrites)
 *  - Exposes liveText = finalText + interimText for real-time display
 *
 * This hook DOES NOT reset text on language change — the patient keeps
 * what they've said so far and can switch mid-sentence.
 */

import { useState, useCallback, useRef } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';

export const SYMPTOM_LANGUAGES = [
  { code: 'en-IN', label: 'English',  flag: '🇬🇧' },
  { code: 'hi-IN', label: 'Hindi',    flag: '🇮🇳' },
  { code: 'mr-IN', label: 'Marathi',  flag: '🟠' },
];

/**
 * @param {{ onTranscriptChange?: (text: string) => void }} options
 */
export function useVoiceSymptoms({ onTranscriptChange } = {}) {
  const [language, setLanguage]       = useState('en-IN');
  const [baseText, setBaseText]       = useState('');   // confirmed spoken text
  const [interimText, setInterimText] = useState('');   // live, unconfirmed
  const baseTextRef = useRef('');

  /* Called when a final chunk arrives — append to base */
  const handleResult = useCallback((finalChunk) => {
    const trimmed = finalChunk.trim();
    if (!trimmed) return;
    const separator = baseTextRef.current ? ' ' : '';
    baseTextRef.current += separator + trimmed;
    setBaseText(baseTextRef.current);
    onTranscriptChange?.(baseTextRef.current);
  }, [onTranscriptChange]);

  /* Called with live interim text */
  const handleInterim = useCallback((interim) => {
    setInterimText(interim);
  }, []);

  const { isListening, isSupported, permissionState, error,
    startListening, stopListening, toggleListening, clearTranscript } =
    useSpeechRecognition({
      lang:           language,
      continuous:     true,
      interimResults: true,
      onResult:       handleResult,
      onInterim:      handleInterim,
    });

  /* The textarea should always show base + live interim */
  const liveText = baseText + (interimText ? (baseText ? ' ' : '') + interimText : '');

  /* Manual edit: user types directly → update base, discard interim */
  const setManualText = useCallback((text) => {
    baseTextRef.current = text;
    setBaseText(text);
    setInterimText('');
    onTranscriptChange?.(text);
  }, [onTranscriptChange]);

  const resetTranscript = useCallback(() => {
    baseTextRef.current = '';
    setBaseText('');
    setInterimText('');
    clearTranscript();
    onTranscriptChange?.('');
  }, [clearTranscript, onTranscriptChange]);

  /* Switch language — stop current session, user can restart */
  const switchLanguage = useCallback((code) => {
    if (isListening) stopListening();
    setLanguage(code);
    setInterimText('');
    // baseText is preserved — user keeps what they already spoke
  }, [isListening, stopListening]);

  /* Wrap startListening to prevent the base hook from wiping baseText */
  const startListeningWrapped = useCallback(() => {
    setInterimText('');
    startListening();
    // Note: the base hook resets its own finalTranscriptRef on start,
    // but our baseTextRef is independent — so append-mode is preserved.
  }, [startListening]);

  return {
    /* State */
    language,
    liveText,           // use this in textarea value
    baseText,           // confirmed text only
    interimText,        // live unconfirmed
    isListening,
    isSupported,
    permissionState,
    error,

    /* Actions */
    startListening:  startListeningWrapped,
    stopListening,
    toggleListening,
    setManualText,      // for textarea onChange
    resetTranscript,
    switchLanguage,

    /* Language list */
    languages: SYMPTOM_LANGUAGES,
  };
}
