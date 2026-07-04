/**
 * services/voice.service.js
 * Frontend voice utility service.
 *
 * Provides helper functions for:
 *  - Checking browser support for Speech APIs
 *  - Requesting microphone permissions
 *  - Cleaning transcript text for display
 *  - Stripping markdown for TTS readability
 */

/**
 * Check if the browser supports the Web Speech Recognition API.
 * @returns {boolean}
 */
export function isSpeechRecognitionSupported() {
  return !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

/**
 * Check if the browser supports the Speech Synthesis API.
 * @returns {boolean}
 */
export function isSpeechSynthesisSupported() {
  return !!(typeof window !== 'undefined' && window.speechSynthesis);
}

/**
 * Request microphone permission explicitly.
 * Returns the permission state after the request.
 *
 * @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>}
 */
export async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately release the stream — we only needed permission
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'denied';
    }
    if (err.name === 'NotFoundError') {
      return 'unsupported'; // No microphone hardware
    }
    return 'denied';
  }
}

/**
 * Strip markdown formatting from AI response text for cleaner TTS output.
 * Preserves natural sentence flow while removing visual formatting.
 *
 * @param {string} markdown - Markdown-formatted text
 * @returns {string} Plain text suitable for speech synthesis
 */
export function stripMarkdownForTTS(markdown) {
  if (!markdown) return '';

  return (
    markdown
      // Remove code blocks (``` ... ```)
      .replace(/```[\s\S]*?```/g, ' code block omitted ')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove headers (## Header → Header)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold (**text** or __text__)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      // Remove italic (*text* or _text_)
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
      // Remove links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove bullet points
      .replace(/^[\s]*[-*+]\s+/gm, '')
      // Remove numbered lists prefix
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Collapse multiple newlines
      .replace(/\n{2,}/g, '. ')
      // Collapse multiple spaces
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/**
 * Clean a transcript for display purposes.
 * Capitalizes first letter, ensures ending punctuation.
 *
 * @param {string} text - Raw transcript text
 * @returns {string} Cleaned text
 */
export function cleanTranscriptForDisplay(text) {
  if (!text?.trim()) return '';

  let cleaned = text.trim();

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Add period if no ending punctuation
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}
