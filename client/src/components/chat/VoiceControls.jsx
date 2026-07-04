/**
 * components/chat/VoiceControls.jsx
 * Voice interaction controls for the AI chat interface.
 *
 * Features:
 *  - Microphone toggle with animated glow when recording
 *  - Waveform visualization while listening
 *  - Mute toggle
 *  - Stop listening button
 *  - TTS controls (speak / stop / replay)
 *  - Speaking pulse animation
 *  - Transcript preview bubble
 *  - Accessibility (keyboard, aria-labels)
 *  - Fallback for unsupported browsers
 */

import React, { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Square, Volume2, VolumeX,
  RotateCcw, X, AlertCircle,
} from 'lucide-react';
import WaveformVisualizer from './WaveformVisualizer';

/**
 * @param {object}  props
 * @param {boolean} props.isListening        - Currently recording
 * @param {boolean} props.isMuted            - Mic muted (recognition running but ignoring)
 * @param {boolean} props.isSpeaking         - TTS currently playing
 * @param {boolean} props.isSupported        - Browser supports speech APIs
 * @param {string}  props.permissionState    - 'granted' | 'denied' | 'prompt'
 * @param {string}  props.interimTranscript  - Live partial transcript
 * @param {string}  props.transcript         - Accumulated final transcript
 * @param {string}  [props.error]            - Current error message
 * @param {function} props.onToggleListening - Start/stop recording
 * @param {function} props.onToggleMute      - Mute/unmute mic
 * @param {function} props.onStopListening   - Force stop listening
 * @param {function} props.onClearTranscript - Clear current transcript
 * @param {function} props.onStopSpeaking    - Cancel TTS playback
 * @param {function} props.onReplay          - Replay last AI TTS response
 * @param {function} props.onUseTranscript   - Insert transcript into chat input
 * @param {boolean} [props.hasLastSpoken]    - Whether there's a replayable response
 */
function VoiceControls({
  isListening,
  isMuted,
  isSpeaking,
  isSupported,
  permissionState,
  interimTranscript,
  transcript,
  error,
  onToggleListening,
  onToggleMute,
  onStopListening,
  onClearTranscript,
  onStopSpeaking,
  onReplay,
  onUseTranscript,
  hasLastSpoken = false,
}) {
  const handleMicClick = useCallback(() => {
    if (!isSupported) return;
    onToggleListening();
  }, [isSupported, onToggleListening]);

  /* ── Unsupported browser fallback ── */
  if (!isSupported) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          className="p-2 text-slate-600 cursor-not-allowed"
          disabled
          title="Voice input not supported in this browser"
          aria-label="Voice input not supported"
        >
          <MicOff className="w-4 h-4" />
        </button>
      </div>
    );
  }

  /* ── Permission denied state ── */
  if (permissionState === 'denied' && !isListening) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          className="p-2 text-amber-500/70 hover:text-amber-400 transition-colors"
          onClick={handleMicClick}
          title="Microphone permission denied — click to retry"
          aria-label="Microphone permission denied, click to retry"
        >
          <AlertCircle className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── Transcript Preview Bubble ── */}
      <AnimatePresence>
        {isListening && (transcript || interimTranscript) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-0 right-0 mb-2 mx-1"
          >
            <div className="bg-dark-800/95 backdrop-blur-xl border border-primary-500/20
                          rounded-2xl px-4 py-3 shadow-lg shadow-primary-500/5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <WaveformVisualizer active={isListening && !isMuted} size="sm" />
                  <span className="text-[11px] font-medium text-primary-400 uppercase tracking-wider">
                    {isMuted ? 'Muted' : 'Listening…'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {transcript && (
                    <button
                      onClick={onClearTranscript}
                      className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded"
                      aria-label="Clear transcript"
                      title="Clear transcript"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {transcript && <span>{transcript} </span>}
                {interimTranscript && (
                  <span className="text-slate-400 italic">{interimTranscript}</span>
                )}
                {!transcript && !interimTranscript && (
                  <span className="text-slate-500 italic">Speak now…</span>
                )}
              </p>
              {transcript && (
                <button
                  onClick={() => {
                    onUseTranscript?.(transcript);
                    onStopListening();
                  }}
                  className="mt-2 text-xs text-primary-400 hover:text-primary-300
                           font-medium transition-colors"
                  aria-label="Use this transcript"
                >
                  ↵ Use this text
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Speaking indicator ── */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-0 right-0 mb-2 mx-1"
          >
            <div className="bg-dark-800/95 backdrop-blur-xl border border-accent-500/20
                          rounded-2xl px-4 py-2.5 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Volume2 className="w-4 h-4 text-accent-400" />
                </motion.div>
                <span className="text-xs text-accent-400 font-medium">AI Speaking…</span>
              </div>
              <button
                onClick={onStopSpeaking}
                className="p-1 text-slate-400 hover:text-danger-400 transition-colors rounded"
                aria-label="Stop AI speech"
                title="Stop speaking"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Control buttons ── */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Active listening controls */}
        <AnimatePresence mode="wait">
          {isListening && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-0.5 overflow-hidden"
            >
              {/* Mute */}
              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded-lg transition-colors ${
                  isMuted
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Stop */}
              <button
                onClick={onStopListening}
                className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                title="Stop listening"
                aria-label="Stop listening"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main mic button */}
        <motion.button
          id="voice-input-btn"
          onClick={handleMicClick}
          whileTap={{ scale: 0.9 }}
          className={`relative p-2 rounded-xl transition-all duration-200 ${
            isListening
              ? 'text-white bg-primary-500'
              : 'text-slate-500 hover:text-accent-400'
          }`}
          title={isListening ? 'Stop recording' : 'Start voice input'}
          aria-label={isListening ? 'Stop recording' : 'Start voice input'}
          aria-pressed={isListening}
        >
          {/* Animated glow ring */}
          {isListening && (
            <>
              <motion.span
                className="absolute inset-0 rounded-xl bg-primary-500/30"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                className="absolute inset-0 rounded-xl bg-primary-400/20"
                animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              />
            </>
          )}
          <Mic className="w-4 h-4 relative z-10" />
        </motion.button>

        {/* Replay TTS button */}
        <AnimatePresence>
          {hasLastSpoken && !isListening && !isSpeaking && (
            <motion.button
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              onClick={onReplay}
              className="p-1.5 text-slate-500 hover:text-accent-400 transition-colors rounded-lg overflow-hidden"
              title="Replay AI response"
              aria-label="Replay last AI voice response"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default memo(VoiceControls);
