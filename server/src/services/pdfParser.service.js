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
    const data = await pdfParse(buffer, { max: 100 });
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
    logger.warn(`pdf-parse error: ${err.message} — routing to Gemini Vision OCR`);
    return { text: '', pageCount: 0, method: 'pdf-parse-failed', needsOcr: true };
  }
};

module.exports = { extractFromPdf, cleanText };
