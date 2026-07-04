/**
 * components/appointments/VoiceSymptomInput.jsx
 *
 * Premium voice + text symptom input for the booking wizard.
 * Designed to feel like Google Voice Search / ChatGPT Voice Mode.
 *
 * Features:
 *  - Animated mic button with ripple while recording
 *  - Live transcript appears INSTANTLY as user speaks
 *  - Transcript NEVER disappears mid-session
 *  - Language switcher (English / Hindi / Marathi)
 *  - Quick-pick symptom tags
 *  - Character count
 *  - Permission denied helpful message
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, RotateCcw, Globe } from 'lucide-react';
import { useVoiceSymptoms, SYMPTOM_LANGUAGES } from '@hooks/useVoiceSymptoms';

/* ── Common symptom quick-picks ── */
const QUICK_SYMPTOMS = [
  'Fever', 'Headache', 'Cough', 'Fatigue', 'Chest pain',
  'Dizziness', 'Nausea', 'Back pain', 'Shortness of breath',
  'Joint pain', 'Weakness', 'Loss of appetite',
];

/* ── Urgency keywords — highlight in red chip ── */
const URGENT_KEYWORDS = ['chest pain', 'shortness of breath', 'breathing difficulty', 'stroke', 'unconscious'];

function isUrgent(text) {
  const lower = text.toLowerCase();
  return URGENT_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * @param {{
 *   value: string,
 *   onChange: (text: string) => void,
 *   symptomTags: string[],
 *   onTagsChange: (tags: string[]) => void,
 * }} props
 */
export function VoiceSymptomInput({ value, onChange, symptomTags = [], onTagsChange }) {
  const {
    language, liveText, isListening, isSupported, permissionState, error,
    toggleListening, setManualText, resetTranscript, switchLanguage, languages,
  } = useVoiceSymptoms({
    onTranscriptChange: useCallback((text) => onChange(text), [onChange]),
  });

  const handleTextChange = (e) => {
    setManualText(e.target.value);
    onChange(e.target.value);
  };

  const handleQuickPick = (symptom) => {
    const lower = symptom.toLowerCase();
    if (symptomTags.includes(lower)) {
      onTagsChange(symptomTags.filter((t) => t !== lower));
    } else {
      onTagsChange([...symptomTags, lower]);
    }
  };

  const handleReset = () => {
    resetTranscript();
    onChange('');
    onTagsChange([]);
  };

  /* Use live voice text when listening, otherwise use the external `value` prop */
  const displayText = isListening ? liveText : value;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Describe Your Symptoms</h2>
        <p className="text-sm text-slate-400">
          Speak naturally or type — in any language. AI will understand.
        </p>
      </div>

      {/* Language Switcher */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              id={`lang-${lang.code}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                language === lang.code
                  ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                  : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
              }`}
            >
              <span>{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Voice Input Area */}
      <div className="relative">
        {/* Textarea */}
        <textarea
          id="symptom-textarea"
          value={displayText}
          onChange={handleTextChange}
          placeholder={
            isListening
              ? 'Listening… speak your symptoms…'
              : 'Describe your symptoms here, or tap the mic to speak…\n\nExamples:\n• "मुझे 3 दिन से बुखार और सिरदर्द है"\n• "I have chest pain and breathlessness"\n• "मला ताप आणि अशक्तपणा जाणवतोय"'
          }
          rows={6}
          className={`w-full bg-white/5 border rounded-2xl px-4 py-4 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-2 transition-all font-sans leading-relaxed ${
            isListening
              ? 'border-primary-500/70 focus:ring-primary-500/40 ring-2 ring-primary-500/30'
              : 'border-white/10 focus:ring-primary-500/30 focus:border-primary-500/50'
          }`}
          style={{ caretColor: '#6366f1' }}
        />

        {/* Live recording indicator inside textarea */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-primary-600/90 px-2.5 py-1 rounded-full"
            >
              {/* Animated dot */}
              <motion.div
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-1.5 h-1.5 rounded-full bg-white"
              />
              <span className="text-xs text-white font-medium">Listening</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Character count */}
        {displayText && (
          <div className="absolute top-3 right-3 text-xs text-slate-600">
            {displayText.length}/5000
          </div>
        )}
      </div>

      {/* Mic Controls Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Main mic button */}
          <div className="relative">
            {/* Ripple rings when listening */}
            {isListening && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full bg-primary-500"
                />
                <motion.div
                  animate={{ scale: [1, 2.4], opacity: [0.25, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.3, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full bg-primary-500"
                />
              </>
            )}
            <button
              id="voice-mic-btn"
              onClick={isSupported ? toggleListening : undefined}
              disabled={!isSupported || permissionState === 'denied'}
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                !isSupported || permissionState === 'denied'
                  ? 'bg-slate-700/50 text-slate-600 cursor-not-allowed'
                  : isListening
                  ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/30'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white border border-white/15'
              }`}
            >
              {isListening ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
          </div>

          <div>
            <p className="text-sm font-medium text-white">
              {!isSupported
                ? 'Voice not supported in this browser'
                : permissionState === 'denied'
                ? 'Microphone access denied'
                : isListening
                ? 'Tap to stop recording'
                : 'Tap mic to speak'}
            </p>
            {error && error !== 'no-speech' && (
              <p className="text-xs text-danger-400 mt-0.5">{error}</p>
            )}
            {permissionState === 'denied' && (
              <p className="text-xs text-slate-500 mt-0.5">
                Enable mic in browser settings to use voice input.
              </p>
            )}
          </div>
        </div>

        {/* Reset button */}
        {(displayText || symptomTags.length > 0) && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Urgency warning */}
      <AnimatePresence>
        {displayText && isUrgent(displayText) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 px-4 py-3 rounded-xl bg-danger-500/10 border border-danger-500/30"
          >
            <span className="text-danger-400 text-sm">⚠️</span>
            <p className="text-xs text-danger-400">
              <span className="font-semibold">Urgent symptoms detected.</span>{' '}
              If this is an emergency, please call 112 immediately.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick symptom tags */}
      <div>
        <p className="text-xs text-slate-500 mb-2.5 font-medium uppercase tracking-wider">Quick Add Symptoms</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_SYMPTOMS.map((symptom) => {
            const key = symptom.toLowerCase();
            const selected = symptomTags.includes(key);
            return (
              <button
                key={symptom}
                id={`symptom-tag-${key.replace(/\s/g, '-')}`}
                onClick={() => handleQuickPick(symptom)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selected
                    ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                    : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                }`}
              >
                {selected && <span className="mr-1">✓</span>}
                {symptom}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected tags summary */}
      {symptomTags.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs text-slate-500 mt-0.5">Selected:</span>
          {symptomTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary-500/15 text-primary-300 border border-primary-500/30"
            >
              {tag}
              <button
                onClick={() => onTagsChange(symptomTags.filter((t) => t !== tag))}
                className="ml-0.5 text-primary-400 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default VoiceSymptomInput;
