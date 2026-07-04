/**
 * utils/emergencyKeywords.js
 *
 * Fast, synchronous pre-check for emergency symptom keywords across
 * English, Hindi (Devanagari + transliterated), and Marathi.
 *
 * Purpose:
 *   Gemini already performs multilingual triage, but this module provides
 *   an instant (sub-millisecond) signal BEFORE the Gemini round-trip.
 *   It is used to:
 *     1. Log a high-priority alert immediately on any emergency request.
 *     2. Pass a `localDetected` hint to the Gemini prompt so the model
 *        understands a keyword match was already found.
 *     3. Allow future middleware to bypass rate-limiting for CRITICAL signals.
 *
 * This module NEVER replaces Gemini's analysis — it supplements it.
 */

'use strict';

/* ── English emergency keywords ── */
const EN_CRITICAL = [
  'chest pain', 'heart attack', 'cardiac arrest', 'stroke', 'can\'t breathe',
  'difficulty breathing', 'shortness of breath', 'severe bleeding', 'unconscious',
  'not breathing', 'no pulse', 'seizure', 'paralysis', 'collapsed', 'overdose',
  'poisoning', 'anaphylaxis', 'allergic reaction', 'choking', 'drowning',
];

/* ── Hindi — Devanagari script ── */
const HI_CRITICAL = [
  'सीने में दर्द',   // chest pain
  'दिल का दौरा',    // heart attack
  'सांस नहीं आ रही', // can't breathe
  'बेहोश',          // unconscious
  'लकवा',           // paralysis
  'दौरा',           // seizure / attack
  'खून बह रहा है',  // severe bleeding
  'जहर',            // poison
  'गला घोंटना',     // choking
  'ज़्यादा दवाई',   // overdose
];

/* ── Hindi — common romanised / transliterated forms ── */
const HI_ROMAN = [
  'seene mein dard', 'dil ka daura', 'sans nahi', 'behosh',
  'lakwa', 'daura', 'khoon', 'zeher', 'gala ghotna',
];

/* ── Marathi — Devanagari script ── */
const MR_CRITICAL = [
  'छातीत दुखणे',   // chest pain
  'हृदयविकाराचा झटका', // heart attack
  'श्वास घेता येत नाही', // can't breathe
  'बेशुद्ध',        // unconscious
  'अर्धांगवायू',    // paralysis
  'झटका',           // seizure
  'रक्तस्राव',      // bleeding
  'विष',            // poison
  'गुदमरणे',        // choking
];

/* ── Marathi — common romanised forms ── */
const MR_ROMAN = [
  'chhatit dukhe', 'hrudayavikar', 'shvas gheta yet nahi',
  'beshudh', 'ardhanvaayu', 'jhatka', 'raktasraav', 'vish', 'gudamarne',
];

/* Flatten all keyword lists into one normalised array */
const ALL_KEYWORDS = [
  ...EN_CRITICAL,
  ...HI_CRITICAL,
  ...HI_ROMAN,
  ...MR_CRITICAL,
  ...MR_ROMAN,
].map((k) => k.toLowerCase());

/**
 * detectEmergencyKeywords
 *
 * Synchronously checks whether `text` contains any emergency keyword
 * from the multilingual keyword set.
 *
 * @param {string} text  - Raw symptom text from the user (any language/script)
 * @returns {{ detected: boolean, matchedKeyword: string|null }}
 */
const detectEmergencyKeywords = (text) => {
  if (!text || typeof text !== 'string') return { detected: false, matchedKeyword: null };

  const lower = text.toLowerCase();

  for (const kw of ALL_KEYWORDS) {
    if (lower.includes(kw)) {
      return { detected: true, matchedKeyword: kw };
    }
  }

  return { detected: false, matchedKeyword: null };
};

module.exports = { detectEmergencyKeywords };
