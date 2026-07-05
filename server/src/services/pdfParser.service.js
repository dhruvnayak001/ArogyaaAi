/**
 * services/pdfParser.service.js
 * Extracts raw text from PDF buffers using pdf-parse v1.1.1
 *
 * Import pattern (official CJS-compatible):
 *   const pdfParseModule = require('pdf-parse');
 *   const pdfParse = pdfParseModule.default || pdfParseModule;
 *
 * Extraction flow:
 *  1. Call pdfParse(buffer) → get text layer
 *  2. If < 50 chars/page → signal OCR needed (scanned PDF)
 *  3. Return { text, pageCount, method, needsOcr }
 *
 * NO deep imports (e.g. pdf-parse/lib/...) — they are blocked by modern
 * package.json "exports" fields.
 */

'use strict';

const logger = require('../config/logger');

/* ── Official CJS import pattern ── */
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;

/* Hard timeout for PDF parsing. A crafted PDF with deeply nested objects or
   heavy compression can cause pdf-parse to block the event loop for 10+ seconds.
   If parsing takes longer than this, it's safer to fall back to Gemini Vision
   OCR than to block all other users' requests. */
const PDF_PARSE_TIMEOUT_MS = 15000; // 15 seconds max per PDF

/* Verify at load time that we have a callable function */
if (typeof pdfParse !== 'function') {
  logger.error(
    `pdf-parse did not export a callable function. ` +
    `Got: ${typeof pdfParse}. Keys: ${Object.keys(pdfParseModule || {}).join(', ')}. ` +
    `All PDFs will be routed through Gemini Vision OCR.`
  );
}

/* ════════════════════════════════════════
   Text cleaning
   ════════════════════════════════════════ */
const cleanText = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, '')
    .trim();
};

/* ════════════════════════════════════════
   Main extraction function
   ════════════════════════════════════════ */

/**
 * Extract text from a PDF buffer using pdf-parse.
 * @param {Buffer} buffer - Raw PDF bytes from multer memoryStorage
 * @returns {{ text, pageCount, method, needsOcr }}
 */
const extractFromPdf = async (buffer) => {
  /* If pdf-parse is not a callable function, skip to OCR immediately */
  if (typeof pdfParse !== 'function') {
    /* No PHI here — just operational state */
    logger.warn('[pdfParser] pdf-parse not callable — routing to Gemini Vision');
    return { text: '', pageCount: 0, method: 'pdf-parse-unavailable', needsOcr: true };
  }

  try {
    const tStartParse = performance.now();

    /* Race the parse against a hard timeout. pdf-parse is CPU-bound and can
       block the event loop for 10+ seconds on a crafted/pathological PDF.
       If it exceeds this threshold, we bail to OCR rather than blocking all
       other users. Note: the background parse still runs, but at least this
       request's user doesn't wait. */
    const parsePromise = pdfParse(buffer, { max: 100 });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`PDF parse timeout after ${PDF_PARSE_TIMEOUT_MS}ms`)), PDF_PARSE_TIMEOUT_MS)
    );

    const data = await Promise.race([parsePromise, timeoutPromise]);
    const tEndParse = performance.now();

    const raw       = data.text || '';
    const pageCount = data.numpages || 1;

    /* Yield to the event loop before running heavy regex cleaning on large texts */
    await new Promise(resolve => setImmediate(resolve));

    const tStartClean = performance.now();
    const text      = cleanText(raw);
    const tEndClean = performance.now();

    /* Operational metrics only — NO extracted text content logged (PHI risk).
       logger.debug is suppressed at 'info' log level in production. */
    logger.debug(`[pdfParser] parse=${(tEndParse - tStartParse).toFixed(2)}ms clean=${(tEndClean - tStartClean).toFixed(2)}ms`);
    logger.debug(`[pdfParser] pages=${pageCount} chars=${text.length} method=pdf-parse`);

    /* Heuristic: < 50 chars/page → likely a scanned PDF with no text layer */
    const avgCharsPerPage = text.length / Math.max(pageCount, 1);
    const needsOcr = avgCharsPerPage < 50;

    if (needsOcr) {
      logger.debug(`[pdfParser] needsOcr=true avgCPP=${avgCharsPerPage.toFixed(1)} — routing to Gemini Vision`);
    }

    logger.info(
      `pdf-parse: pages=${pageCount}, chars=${text.length}, ` +
      `avgCPP=${avgCharsPerPage.toFixed(0)}, needsOcr=${needsOcr}`
    );

    return { text, pageCount, method: 'pdf-parse', needsOcr };
  } catch (err) {
    const msg = err.message || '';
    const isTimeout = msg.includes('timeout');
    const logLevel = isTimeout ? 'warn' : 'warn';
    logger.warn(
      `pdf-parse ${isTimeout ? 'timeout' : 'error'}: ${msg} — routing to Gemini Vision OCR`
    );
    return { text: '', pageCount: 0, method: isTimeout ? 'pdf-parse-timeout' : 'pdf-parse-failed', needsOcr: true };
  }
};

module.exports = { extractFromPdf, cleanText };
