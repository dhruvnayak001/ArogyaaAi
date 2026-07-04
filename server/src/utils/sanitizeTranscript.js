/**
 * utils/sanitizeTranscript.js
 * Sanitize and normalize voice transcript text before processing.
 *
 * Responsibilities:
 *  - Strip dangerous input patterns (XSS, injection)
 *  - Normalize whitespace and punctuation
 *  - Clean common speech-recognition artifacts
 *  - Enforce max length
 */

'use strict';

/** Maximum allowed transcript length (characters) */
const MAX_TRANSCRIPT_LENGTH = 5000;

/**
 * Patterns that should be stripped from transcript text.
 * Covers XSS vectors, SQL injection fragments, NoSQL operators,
 * and common command-injection characters.
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,   // <script> tags
  /<\/?[a-z][^>]*>/gi,                       // HTML tags
  /javascript\s*:/gi,                        // javascript: URIs
  /on\w+\s*=\s*["'][^"']*["']/gi,           // inline event handlers
  /\b(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+set)\b/gi, // SQL
  /\$(\{|gt|lt|ne|eq|regex|where|or|and)/gi, // NoSQL operators
  /[;&|`$]/g,                                // shell metacharacters
  /\.\.\//g,                                 // path traversal
];

/**
 * Filler words that speech recognition commonly captures.
 * We collapse them but don't remove single occurrences
 * because they may be intentional.
 */
const FILLER_PATTERN = /\b(um+|uh+|hmm+|ah+|er+)\b(?:\s+\1)+/gi;

/**
 * Sanitize a raw transcript string.
 *
 * @param {string} raw - Raw transcript from speech recognition
 * @param {object} [options]
 * @param {number} [options.maxLength] - Override max length
 * @returns {{ sanitized: string, wasTruncated: boolean, originalLength: number }}
 */
function sanitizeTranscript(raw, options = {}) {
  const maxLen = options.maxLength ?? MAX_TRANSCRIPT_LENGTH;

  if (typeof raw !== 'string') {
    return { sanitized: '', wasTruncated: false, originalLength: 0 };
  }

  const originalLength = raw.length;
  let text = raw;

  // 1. Strip dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    text = text.replace(pattern, '');
  }

  // 2. Remove control characters (keep newlines & tabs)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. Collapse repeated filler words → single occurrence
  text = text.replace(FILLER_PATTERN, '$1');

  // 4. Collapse repeated words (speech stutter: "I I I want" → "I want")
  text = text.replace(/\b(\w+)(\s+\1){2,}\b/gi, '$1');

  // 5. Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  // 6. Truncate
  const wasTruncated = text.length > maxLen;
  if (wasTruncated) {
    text = text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
  }

  return { sanitized: text, wasTruncated, originalLength };
}

/**
 * Quick validation — is the transcript usable?
 * @param {string} text - Sanitized transcript
 * @returns {boolean}
 */
function isValidTranscript(text) {
  if (!text || typeof text !== 'string') return false;
  const cleaned = text.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.length >= 2; // at least 2 alphanumeric chars
}

module.exports = { sanitizeTranscript, isValidTranscript, MAX_TRANSCRIPT_LENGTH };
