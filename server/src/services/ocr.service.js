/**
 * services/ocr.service.js
 * Optical Character Recognition via Google Gemini Vision API
 *
 * WHY NOT tesseract.js:
 *   tesseract.js v4 is incompatible with Node 24 (Worker thread API changes).
 *   It crashes with "Cannot read properties of null (reading 'SetVariable')".
 *
 * WHY GEMINI VISION:
 *   - Zero external dependencies (no system binary, no native modules)
 *   - Works on Node 24+
 *   - Superior accuracy vs Tesseract for real-world medical documents
 *   - Handles low-quality images, handwriting, stamps, watermarks
 *   - Understands medical context (table parsing, value extraction)
 *
 * For scanned PDFs: pdf-parse fails → this is called with the PDF buffer.
 * For images:       Called directly with the image buffer.
 *
 * Returns: { text, confidence, method }
 */

'use strict';

const logger        = require('../config/logger');
const { cleanText } = require('./pdfParser.service');

/* Reuse the shared Gemini SDK instance from config — avoids a second
   GoogleGenerativeAI instantiation and duplicate connection overhead. */
const { genAI } = require('../config/gemini');

/**
 * Extract text from an image or scanned document using Gemini Vision.
 * @param {Buffer} buffer   - Image/PDF buffer
 * @param {string} mimeType - MIME type of the file
 * @returns {{ text: string, confidence: number, method: string }}
 */
const extractViaOcr = async (buffer, mimeType) => {
  const startMs = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set — OCR via Gemini Vision not available');
    return { text: '', confidence: 0, method: 'ocr-unavailable' };
  }

  try {
    logger.info(`Gemini Vision OCR starting for ${mimeType} (${buffer.length} bytes)...`);

    /* Use gemini-2.0-flash for vision/OCR (gemini-1.5-flash returns 404 on v1beta) */
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature:      0.1,
        maxOutputTokens:  4096,
      },
    });

    /* Determine the inline data MIME type */
    /* For PDFs: Gemini can read the first page as image via pdf inline data */
    const supportedVisionMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const visionMime = supportedVisionMimes.includes(mimeType)
      ? mimeType
      : 'image/png';  // fallback for PDF (first-page rendering)

    const imagePart = {
      inlineData: {
        data:     buffer.toString('base64'),
        mimeType: mimeType === 'application/pdf' ? 'application/pdf' : visionMime,
      },
    };

    const prompt = `Extract ALL text from this medical document image exactly as it appears.
Include:
- All numbers, values, and units
- All parameter names and their results  
- Reference ranges and normal ranges
- Doctor names, lab names, dates
- Medicine names and dosages
- Any annotations, stamps, or headers

Return ONLY the extracted text, preserving the layout as much as possible.
Do not summarize. Do not analyze. Just extract raw text.`;

    const result   = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const rawText  = response.text() || '';
    const text     = cleanText(rawText);

    logger.info(`Gemini Vision OCR done in ${Date.now() - startMs}ms — ${text.length} chars extracted`);

    return {
      text,
      confidence: text.length > 50 ? 90 : 40,  // Heuristic confidence
      method:     'gemini-vision-ocr',
    };

  } catch (err) {
    logger.warn(`Gemini Vision OCR failed: ${err.message?.slice(0, 100)} — skipping OCR`);
    return { text: '', confidence: 0, method: 'ocr-failed' };
  }
};

module.exports = { extractViaOcr };
