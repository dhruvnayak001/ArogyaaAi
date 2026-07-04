/**
 * services/medicalAnalysis.service.js
 * Full pipeline: text extraction → Gemini structured analysis with confidence scores
 *
 * Extraction flow:
 *  1. PDF  → pdf-parse → text (fast)
 *       ↳  if scanned → OCR fallback
 *  2. Image → OCR directly
 *  3. Extracted text → Gemini → structured JSON analysis WITH confidence scores
 *
 * Output shape (saved to HealthRecord.analysis):
 *  {
 *    summary, detectedConditions, abnormalFindings,
 *    medicines, severity, suggestedFollowUp,
 *    extractedValues, labMetadata, analyzedAt,
 *    patientProfile (with confidence scores),
 *    confidenceScores (field-level)
 *  }
 */

'use strict';

const { extractFromPdf } = require('./pdfParser.service');
const { extractViaOcr }  = require('./ocr.service');
const { getMedicalAnalysisModel } = require('../config/gemini');
const logger              = require('../config/logger');

/* ── MIME helpers ── */
const isPdf   = (m) => m === 'application/pdf';
const isImage = (m) => m?.startsWith('image/');

/* ════════════════════════════════════════
   STEP 1 — Text Extraction
   ════════════════════════════════════════ */

/**
 * extractText
 * Picks the right extraction strategy based on MIME type.
 * Always returns { text, method, confidence }. NEVER throws.
 */
const extractText = async (buffer, mimetype) => {
  try {
    if (isPdf(mimetype)) {
      const pdfResult = await extractFromPdf(buffer);

      if (pdfResult.needsOcr) {
        logger.info('PDF has no/thin text layer — running Gemini Vision OCR fallback');
        try {
          const ocrResult = await extractViaOcr(buffer, mimetype);
          return {
            text:       ocrResult.text || pdfResult.text,
            method:     ['ocr-unavailable', 'ocr-failed'].includes(ocrResult.method) ? 'pdf-parse' : ocrResult.method,
            confidence: ocrResult.confidence,
            pageCount:  pdfResult.pageCount,
          };
        } catch (ocrErr) {
          logger.warn(`OCR fallback error: ${ocrErr.message} — using partial pdf-parse text`);
          return { text: pdfResult.text || '', method: 'pdf-parse', confidence: 60, pageCount: pdfResult.pageCount };
        }
      }

      return {
        text:       pdfResult.text,
        method:     pdfResult.method,
        confidence: 100,
        pageCount:  pdfResult.pageCount,
      };
    }

    if (isImage(mimetype)) {
      try {
        const ocrResult = await extractViaOcr(buffer, mimetype);
        return {
          text:       ocrResult.text,
          method:     ocrResult.method,
          confidence: ocrResult.confidence,
          pageCount:  1,
        };
      } catch (ocrErr) {
        logger.warn(`Image OCR failed: ${ocrErr.message}`);
        return { text: '', method: 'ocr-failed', confidence: 0, pageCount: 1 };
      }
    }

    return { text: '', method: 'unsupported', confidence: 0, pageCount: 0 };
  } catch (err) {
    logger.error(`extractText top-level error: ${err.message}`);
    return { text: '', method: 'extraction-failed', confidence: 0, pageCount: 0 };
  }
};

/* ════════════════════════════════════════
   STEP 2 — Gemini Structured Analysis WITH Confidence Scores
   ════════════════════════════════════════ */

const ANALYSIS_PROMPT_WITH_CONFIDENCE = (text, recordType) => `
You are a clinical AI assistant analyzing a ${recordType || 'medical'} document.

DOCUMENT TEXT:
"""
${text.slice(0, 12000)}
"""

Analyze this medical document and return a JSON object with EXACTLY this structure (no markdown, no code blocks):
{
  "summary": "2-3 sentence plain-language summary of the document",
  "detectedConditions": [
    { "value": "condition1", "confidence": 0.95 },
    { "value": "condition2", "confidence": 0.82 }
  ],
  "abnormalFindings": [
    {
      "parameter": "Hemoglobin",
      "value": "8.2 g/dL",
      "normalRange": "12.0-17.5 g/dL",
      "severity": "high",
      "interpretation": "Below normal — possible anemia",
      "confidence": 0.97
    }
  ],
  "medicines": [
    { "value": "Medicine Name 1 Dose", "confidence": 0.90 },
    { "value": "Medicine Name 2", "confidence": 0.85 }
  ],
  "severity": "critical|high|moderate|low|normal",
  "suggestedFollowUp": "Brief follow-up recommendation",
  "extractedValues": {
    "hemoglobin":    { "value": "value with unit or null", "confidence": 0.95 },
    "glucose":       { "value": "value with unit or null", "confidence": 0.88 },
    "cholesterol":   { "value": "value with unit or null", "confidence": 0.90 },
    "systolicBP":    { "value": "value or null", "confidence": 0.92 },
    "diastolicBP":   { "value": "value or null", "confidence": 0.91 },
    "hba1c":         { "value": "value or null", "confidence": 0.85 },
    "creatinine":    { "value": "value or null", "confidence": 0.88 },
    "sodium":        { "value": "value or null", "confidence": 0.87 },
    "potassium":     { "value": "value or null", "confidence": 0.84 },
    "wbc":           { "value": "value or null", "confidence": 0.93 },
    "platelets":     { "value": "value or null", "confidence": 0.91 },
    "triglycerides": { "value": "value or null", "confidence": 0.89 }
  },
  "patientProfile": {
    "patientName":   { "value": "name or null", "confidence": 0.95 },
    "age":           { "value": "age as string or null", "confidence": 0.90 },
    "symptoms":      [
      { "value": "symptom1", "confidence": 0.95 },
      { "value": "symptom2", "confidence": 0.88 }
    ],
    "bloodPressure": { "value": "systolic/diastolic or null", "confidence": 0.93 },
    "diabetes":      { "value": "Normal|Pre-diabetic|High|null", "confidence": 0.85 },
    "allergies":     [
      { "value": "allergen1", "confidence": 0.90 }
    ]
  },
  "labMetadata": {
    "labName":      { "value": "name or null", "confidence": 0.92 },
    "doctorName":   { "value": "name or null", "confidence": 0.88 },
    "patientName":  { "value": "name or null", "confidence": 0.95 },
    "reportDate":   { "value": "date string or null", "confidence": 0.90 },
    "sampleType":   { "value": "blood/urine/etc or null", "confidence": 0.85 }
  },
  "overallConfidence": 0.87
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- confidence values are 0.0 to 1.0 — be honest and accurate
- If a value is not found, set value to null and confidence to 0
- severity must be exactly one of: critical, high, moderate, low, normal
- For abnormalFindings, only include values actually outside normal ranges
- severity in abnormalFindings must be: critical, high, moderate, low
- confidence < 0.7 means the field is uncertain and patient should verify
`.trim();

/* ── Legacy prompt without confidence (for backward compat reanalyze) ── */
const ANALYSIS_PROMPT_LEGACY = (text, recordType) => `
You are a clinical AI assistant analyzing a ${recordType || 'medical'} document.

DOCUMENT TEXT:
"""
${text.slice(0, 12000)}
"""

Analyze this medical document and return a JSON object with this EXACT structure (no markdown, no code blocks):
{
  "summary": "2-3 sentence plain-language summary of the document",
  "detectedConditions": ["condition1", "condition2"],
  "abnormalFindings": [
    {
      "parameter": "Hemoglobin",
      "value": "8.2 g/dL",
      "normalRange": "12.0-17.5 g/dL",
      "severity": "high",
      "interpretation": "Below normal — possible anemia"
    }
  ],
  "medicines": ["Medicine Name 1 Dose", "Medicine Name 2"],
  "severity": "critical|high|moderate|low|normal",
  "suggestedFollowUp": "Brief follow-up recommendation",
  "extractedValues": {
    "hemoglobin": "value with unit or null",
    "glucose": "value with unit or null",
    "cholesterol": "value with unit or null",
    "systolicBP": "value or null",
    "diastolicBP": "value or null",
    "hba1c": "value or null",
    "creatinine": "value or null",
    "sodium": "value or null",
    "potassium": "value or null",
    "wbc": "value or null",
    "platelets": "value or null",
    "triglycerides": "value or null"
  },
  "labMetadata": {
    "labName": "name or null",
    "doctorName": "name or null",
    "patientName": "name or null",
    "reportDate": "date string or null",
    "sampleType": "blood/urine/etc or null"
  }
}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- If a value is not found, use null
- severity must be exactly one of: critical, high, moderate, low, normal
- For abnormalFindings, only include values that are actually outside normal ranges
- severity in abnormalFindings must be: critical, high, moderate, low
`.trim();

/* ════════════════════════════════════════
   DOCTOR SUMMARY PROMPT
   ════════════════════════════════════════ */

const DOCTOR_SUMMARY_PROMPT = (analysis, patientProfile) => `
You are a clinical AI assistant generating a structured consultation summary for a doctor.

PATIENT PROFILE:
${JSON.stringify(patientProfile, null, 2)}

ANALYSIS DATA:
${JSON.stringify(analysis, null, 2)}

Generate a structured doctor consultation summary in JSON format (no markdown, no code blocks):
{
  "symptoms": ["symptom1", "symptom2"],
  "duration": "estimated duration or unknown",
  "riskLevel": "Critical|High|Medium|Low",
  "possibleConditions": ["condition1", "condition2"],
  "suggestedTests": ["test1", "test2"],
  "clinicalNotes": "2-3 sentence clinical assessment for the doctor",
  "urgentFlags": ["flag1"],
  "aiConfidence": 85,
  "disclaimer": "AI-supported triage — final diagnosis requires clinical evaluation"
}

Rules:
- Return ONLY valid JSON, no markdown
- riskLevel must be exactly: Critical, High, Medium, or Low
- aiConfidence is 0-100 integer
- suggestedTests should be clinically relevant follow-ups
- urgentFlags: list any values that need immediate attention (empty array if none)
`.trim();

/**
 * analyzeWithGeminiConfidence
 * Sends extracted text to Gemini and gets structured medical JSON WITH confidence scores.
 */
const analyzeWithGeminiConfidence = async (extractedText, recordType) => {
  if (!extractedText || extractedText.trim().length < 20) {
    logger.warn('Extracted text too short for meaningful analysis');
    return buildFallbackAnalysisWithConfidence(null);
  }

  try {
    const model  = getMedicalAnalysisModel();
    const prompt = ANALYSIS_PROMPT_WITH_CONFIDENCE(extractedText, recordType);

    const result   = await model.generateContent(prompt);
    const response = await result.response;
    const raw      = response.text().trim();

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,           '')
      .trim();

    const parsed = JSON.parse(cleaned);
    logger.info(`Medical analysis with confidence complete — severity: ${parsed.severity}, overall: ${parsed.overallConfidence}`);
    return normaliseAnalysisWithConfidence(parsed);
  } catch (err) {
    logger.error(`Gemini confidence analysis failed: ${err.message}`);
    return buildFallbackAnalysisWithConfidence(null);
  }
};

/**
 * analyzeWithGemini (legacy — returns flat values, no confidence)
 */
const analyzeWithGemini = async (extractedText, recordType) => {
  if (!extractedText || extractedText.trim().length < 20) {
    logger.warn('Extracted text too short for meaningful analysis');
    return buildFallbackAnalysis(null);
  }

  try {
    const model  = getMedicalAnalysisModel();
    const prompt = ANALYSIS_PROMPT_LEGACY(extractedText, recordType);

    const result   = await model.generateContent(prompt);
    const response = await result.response;
    const raw      = response.text().trim();

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,           '')
      .trim();

    const parsed = JSON.parse(cleaned);
    logger.info(`Medical analysis complete — severity: ${parsed.severity}`);
    return normaliseAnalysis(parsed);
  } catch (err) {
    logger.error(`Gemini medical analysis failed: ${err.message}`);
    return buildFallbackAnalysis(null);
  }
};

/**
 * generateDoctorSummary
 * Generates a clinical AI summary formatted for doctors.
 */
const generateDoctorSummary = async (analysis, patientProfile = {}) => {
  try {
    const model  = getMedicalAnalysisModel();
    const prompt = DOCTOR_SUMMARY_PROMPT(analysis, patientProfile);

    const result   = await model.generateContent(prompt);
    const response = await result.response;
    const raw      = response.text().trim();

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,           '')
      .trim();

    const parsed = JSON.parse(cleaned);
    logger.info(`Doctor summary generated — risk: ${parsed.riskLevel}, confidence: ${parsed.aiConfidence}`);
    return normaliseDoctorSummary(parsed);
  } catch (err) {
    logger.error(`Doctor summary generation failed: ${err.message}`);
    return buildFallbackDoctorSummary();
  }
};

/* ── Normalise functions ── */

const normaliseAnalysisWithConfidence = (raw) => ({
  summary:            raw.summary            || 'Analysis complete.',
  detectedConditions: Array.isArray(raw.detectedConditions) ? raw.detectedConditions : [],
  abnormalFindings:   Array.isArray(raw.abnormalFindings)   ? raw.abnormalFindings   : [],
  medicines:          Array.isArray(raw.medicines)          ? raw.medicines          : [],
  severity:           ['critical','high','moderate','low','normal'].includes(raw.severity)
                        ? raw.severity : 'normal',
  suggestedFollowUp:  raw.suggestedFollowUp  || null,
  extractedValues:    raw.extractedValues    || {},
  patientProfile:     raw.patientProfile     || {},
  labMetadata:        raw.labMetadata        || {},
  overallConfidence:  typeof raw.overallConfidence === 'number' ? raw.overallConfidence : 0.75,
  analyzedAt:         new Date(),
});

const normaliseAnalysis = (raw) => ({
  summary:            raw.summary            || 'Analysis complete.',
  detectedConditions: Array.isArray(raw.detectedConditions) ? raw.detectedConditions : [],
  abnormalFindings:   Array.isArray(raw.abnormalFindings)   ? raw.abnormalFindings   : [],
  medicines:          Array.isArray(raw.medicines)          ? raw.medicines          : [],
  severity:           ['critical','high','moderate','low','normal'].includes(raw.severity)
                        ? raw.severity : 'normal',
  suggestedFollowUp:  raw.suggestedFollowUp  || null,
  extractedValues:    raw.extractedValues    || {},
  labMetadata:        raw.labMetadata        || {},
  analyzedAt:         new Date(),
});

const normaliseDoctorSummary = (raw) => ({
  symptoms:           Array.isArray(raw.symptoms)           ? raw.symptoms           : [],
  duration:           raw.duration           || 'Unknown',
  riskLevel:          ['Critical','High','Medium','Low'].includes(raw.riskLevel)
                        ? raw.riskLevel : 'Medium',
  possibleConditions: Array.isArray(raw.possibleConditions) ? raw.possibleConditions : [],
  suggestedTests:     Array.isArray(raw.suggestedTests)     ? raw.suggestedTests     : [],
  clinicalNotes:      raw.clinicalNotes      || null,
  urgentFlags:        Array.isArray(raw.urgentFlags)        ? raw.urgentFlags        : [],
  aiConfidence:       typeof raw.aiConfidence === 'number'  ? raw.aiConfidence       : 75,
  disclaimer:         raw.disclaimer         || 'AI-supported triage — final diagnosis requires clinical evaluation',
  generatedAt:        new Date(),
});

const buildFallbackAnalysisWithConfidence = (reason = null) => ({
  summary:            reason,   // null = don't show anything in UI
  detectedConditions: [],
  abnormalFindings:   [],
  medicines:          [],
  severity:           'normal',
  suggestedFollowUp:  null,
  extractedValues:    {},
  patientProfile:     {},
  labMetadata:        {},
  overallConfidence:  0,
  analyzedAt:         new Date(),
});

const buildFallbackAnalysis = (reason = null) => ({
  summary:            reason,   // null = don't show anything in UI
  detectedConditions: [],
  abnormalFindings:   [],
  medicines:          [],
  severity:           'normal',
  suggestedFollowUp:  null,
  extractedValues:    {},
  labMetadata:        {},
  analyzedAt:         new Date(),
});

const buildFallbackDoctorSummary = () => ({
  symptoms:           [],
  duration:           'Unknown',
  riskLevel:          'Low',
  possibleConditions: [],
  suggestedTests:     [],
  clinicalNotes:      'Unable to generate AI summary. Please review patient records manually.',
  urgentFlags:        [],
  aiConfidence:       0,
  disclaimer:         'AI-supported triage — final diagnosis requires clinical evaluation',
  generatedAt:        new Date(),
});

/* ════════════════════════════════════════
   PUBLIC: Full pipeline (legacy — saves immediately)
   ════════════════════════════════════════ */

/**
 * analyzeDocument
 * Full pipeline: buffer → extraction → Gemini analysis (legacy, flat values)
 */
const analyzeDocument = async (buffer, mimetype, recordType) => {
  logger.info(`Starting document analysis: ${mimetype}, type=${recordType}`);

  const extraction = await extractText(buffer, mimetype);
  const analysis   = await analyzeWithGemini(extraction.text, recordType);

  return {
    extractedText:    extraction.text,
    extractionMethod: extraction.method,
    ocrConfidence:    extraction.confidence,
    pageCount:        extraction.pageCount,
    analysis,
  };
};

/**
 * analyzeDocumentWithConfidence
 * Full pipeline: buffer → extraction → Gemini analysis WITH confidence scores.
 * Used by extract-preview endpoint (does NOT save to DB).
 */
const analyzeDocumentWithConfidence = async (buffer, mimetype, recordType) => {
  logger.info(`Starting confidence extraction: ${mimetype}, type=${recordType}`);

  const extraction = await extractText(buffer, mimetype);
  const analysis   = await analyzeWithGeminiConfidence(extraction.text, recordType);

  return {
    extractedText:    extraction.text,
    extractionMethod: extraction.method,
    ocrConfidence:    extraction.confidence,
    pageCount:        extraction.pageCount,
    analysis,
  };
};

module.exports = {
  analyzeDocument,
  analyzeDocumentWithConfidence,
  extractText,
  analyzeWithGemini,
  analyzeWithGeminiConfidence,
  generateDoctorSummary,
};
