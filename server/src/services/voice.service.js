/**
 * services/voice.service.js
 * Voice AI service — provider-based abstraction layer.
 *
 * Currently uses browser-native Web Speech API (no server processing needed).
 * Architecture prepared for future integration with:
 *   - OpenAI Whisper (STT)
 *   - ElevenLabs (TTS)
 *   - Deepgram (real-time STT)
 *   - Gemini Voice
 *
 * The backend currently handles:
 *   - Transcript sanitization & validation
 *   - Provider configuration management
 *   - Future: audio buffer processing, streaming endpoints
 */

'use strict';

const { sanitizeTranscript, isValidTranscript } = require('../utils/sanitizeTranscript');
const logger = require('../config/logger');

/* ════════════════════════════════════════
   PROVIDER REGISTRY
   ════════════════════════════════════════ */

/**
 * Supported voice providers and their capabilities.
 * Each provider can support STT, TTS, or both.
 */
const PROVIDERS = {
  webspeech: {
    name:        'Web Speech API',
    type:        'browser-native',
    stt:         true,
    tts:         true,
    streaming:   false,
    requiresKey: false,
    status:      'active',
  },
  whisper: {
    name:        'OpenAI Whisper',
    type:        'cloud',
    stt:         true,
    tts:         false,
    streaming:   false,
    requiresKey: true,
    status:      'stub',
  },
  elevenlabs: {
    name:        'ElevenLabs',
    type:        'cloud',
    stt:         false,
    tts:         true,
    streaming:   true,
    requiresKey: true,
    status:      'stub',
  },
  deepgram: {
    name:        'Deepgram',
    type:        'cloud',
    stt:         true,
    tts:         false,
    streaming:   true,
    requiresKey: true,
    status:      'stub',
  },
  gemini: {
    name:        'Gemini Voice',
    type:        'cloud',
    stt:         true,
    tts:         true,
    streaming:   true,
    requiresKey: true,
    status:      'stub',
  },
};

/** Currently active provider (configurable via env in future) */
const activeSTTProvider = process.env.VOICE_STT_PROVIDER || 'webspeech';
const activeTTSProvider = process.env.VOICE_TTS_PROVIDER || 'webspeech';

/* ════════════════════════════════════════
   TRANSCRIPT PROCESSING
   ════════════════════════════════════════ */

/**
 * Process a raw voice transcript:
 *  1. Sanitize (strip dangerous content)
 *  2. Validate (enough content to be useful)
 *  3. Return cleaned text ready for AI chat
 *
 * @param {string} rawTranscript - Raw text from speech recognition
 * @param {object} [options]
 * @param {string} [options.language] - Language code (e.g., 'en-IN')
 * @param {string} [options.provider] - Provider that generated the transcript
 * @returns {{ text: string, isValid: boolean, meta: object }}
 */
const processTranscript = (rawTranscript, options = {}) => {
  const { language = 'en-IN', provider = activeSTTProvider } = options;

  const { sanitized, wasTruncated, originalLength } = sanitizeTranscript(rawTranscript);
  const valid = isValidTranscript(sanitized);

  if (wasTruncated) {
    logger.warn(`Voice transcript truncated: ${originalLength} → ${sanitized.length} chars`);
  }

  return {
    text:    sanitized,
    isValid: valid,
    meta: {
      provider,
      language,
      originalLength,
      sanitizedLength: sanitized.length,
      wasTruncated,
    },
  };
};

/* ════════════════════════════════════════
   PROVIDER MANAGEMENT
   ════════════════════════════════════════ */

/**
 * Get available providers and their status.
 * Useful for frontend to know which providers are available.
 */
const getProviders = () => ({
  stt: {
    active:    activeSTTProvider,
    available: Object.entries(PROVIDERS)
      .filter(([, p]) => p.stt)
      .map(([key, p]) => ({ id: key, name: p.name, status: p.status })),
  },
  tts: {
    active:    activeTTSProvider,
    available: Object.entries(PROVIDERS)
      .filter(([, p]) => p.tts)
      .map(([key, p]) => ({ id: key, name: p.name, status: p.status })),
  },
});

/**
 * Get provider capabilities.
 * @param {string} providerId
 * @returns {object|null}
 */
const getProviderInfo = (providerId) => PROVIDERS[providerId] || null;

/**
 * Check if a specific provider is available and active.
 * @param {string} providerId
 * @returns {boolean}
 */
const isProviderActive = (providerId) => {
  const provider = PROVIDERS[providerId];
  return provider?.status === 'active';
};

/* ════════════════════════════════════════
   FUTURE: AUDIO PROCESSING STUBS
   ════════════════════════════════════════ */

/**
 * [STUB] Process audio buffer through cloud STT provider.
 * Will be implemented when cloud providers are integrated.
 *
 * @param {Buffer} _audioBuffer - Audio data
 * @param {object} _options - Provider-specific options
 * @returns {Promise<{ text: string, confidence: number }>}
 */
const transcribeAudio = async (_audioBuffer, _options = {}) => {
  throw new Error(
    'Cloud STT not implemented. Currently using browser-native Web Speech API.'
  );
};

/**
 * [STUB] Synthesize speech from text through cloud TTS provider.
 * Will be implemented when cloud providers are integrated.
 *
 * @param {string} _text - Text to synthesize
 * @param {object} _options - Voice, speed, format options
 * @returns {Promise<Buffer>}
 */
const synthesizeSpeech = async (_text, _options = {}) => {
  throw new Error(
    'Cloud TTS not implemented. Currently using browser-native Web Speech API.'
  );
};

module.exports = {
  processTranscript,
  getProviders,
  getProviderInfo,
  isProviderActive,
  transcribeAudio,
  synthesizeSpeech,
};
