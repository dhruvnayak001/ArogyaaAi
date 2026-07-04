/**
 * hooks/useVoiceInput.js
 * Web Speech API hook for voice-to-text input
 * Used by the chat interface and emergency page
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export function useVoiceInput({ onResult, lang = 'en-IN' } = {}) {
  const [isListening,  setIsListening]  = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [isSupported,  setIsSupported]  = useState(!!SpeechRecognition);
  const recognitionRef                  = useRef(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = lang;

    recognition.onresult = (event) => {
      const current = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setTranscript(current);
      if (event.results[0].isFinal) {
        onResult?.(current);
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      toast.error(
        event.error === 'not-allowed'
          ? 'Microphone permission denied'
          : 'Voice recognition error'
      );
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [lang, onResult]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error('Voice input not supported in this browser');
      return;
    }
    try {
      recognitionRef.current?.start();
      setIsListening(true);
      setTranscript('');
    } catch {
      setIsListening(false);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    isListening ? stopListening() : startListening();
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
