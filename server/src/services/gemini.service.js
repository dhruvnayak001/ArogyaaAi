/**
 * services/gemini.service.js
 * Core Gemini AI integration service
 *
 * MODEL FALLBACK STRATEGY:
 *  - Iterates through MODEL_CHAIN on quota (429) or unavailability (404) errors
 *  - On transient errors (5xx, network) — retries same model with backoff
 *  - On hard daily quota — immediately moves to next model in chain
 *  - Safety blocks — throws immediately, no retry
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────
   NOTE on rate limiting:
   We do NOT implement a client-side time-gate here because:
   1. chatStore.js already has isSendingMessage guard (one request at a time)
   2. The Gemini API tells us the exact retry delay via RetryInfo in 429 errors
   3. A hard 2-second throw would block voice auto-send which fires legitimately fast
   Instead we rely on the API's own rate-limit signals and per-model fallback.
───────────────────────────────────────────────────────────────────────── */

const {
  MODEL_CHAIN,
  getChatModel,
  getSummaryModel,
  getEmergencyModel,
  HEALTHCARE_SYSTEM_INSTRUCTION,
  SAFETY_SETTINGS,
  genAI,
} = require('../config/gemini');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');

/* ── Error classification helpers ── */
const isSafetyErr = (msg) => msg.includes('SAFETY');
const isQuotaErr = (msg, status) =>
  status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too Many Requests');

/**
 * Hard daily quota: the quotaId contains "PerDay" OR the error says limit: 0
 * (Google returns limit: 0 for accounts with no free-tier quota on that model).
 * Per-minute quota: quotaId contains "PerMinute" — these are recoverable with a short wait.
 * We must NOT skip the model for per-minute limits; we should wait and retry it.
 */
const isHardDailyQuota = (msg) =>
  msg.includes('PerDay') ||
  msg.includes('GenerateRequestsPerDayPerProject') ||
  msg.includes('limit: 0');  // account has zero quota on this model

const isModelNotFound = (msg, status) =>
  status === 404 || msg.includes('not found');
const isTransient = (msg, status) =>
  [500, 502, 503, 504].includes(status) || msg.includes('INTERNAL') || msg.includes('timeout');

/**
 * Wraps a promise with a hard timeout. Rejects with AppError(503) when exceeded.
 */
const withTimeout = (promise, ms, label) => {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new AppError(`${label} timed out after ${ms / 1000}s. Please try again.`, 503));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Extract server-suggested retry delay from Gemini error details.
 * Returns milliseconds.
 */
const extractRetryDelay = (err) => {
  const retryInfo = err.errorDetails?.find?.((d) => d['@type']?.includes('RetryInfo'));
  if (retryInfo?.retryDelay) {
    const seconds = parseFloat(retryInfo.retryDelay);
    if (!isNaN(seconds)) return Math.ceil(seconds * 1000) + 500;
  }
  return null;
};

/* ══════════════════════════════════════════════════════════════
   MODEL EXHAUSTION CACHE
   ══════════════════════════════════════════════════════════════
   When a model hits a hard daily quota (429 + PerDay), we cache
   it as exhausted until the Google quota reset time:
     → midnight US Pacific Time = 12:30 AM IST (next day)

   This means we NEVER waste an API call trying a known-dead model.
   The cache is in-process memory (resets on server restart or on
   the daily quota reset — whichever comes first).
══════════════════════════════════════════════════════════════ */
const _exhaustedUntil = {}; // { modelName: resetTimestampMs }

/**
 * Returns the timestamp (ms) when Google's daily quota resets.
 * Google resets at midnight US Pacific Time.
 * In IST: midnight PDT (UTC-7) = 07:00 UTC = 12:30 PM IST.
 *         midnight PST (UTC-8) = 08:00 UTC = 01:30 PM IST.
 * We conservatively use the LATER of the two (13:30 IST = 08:00 UTC).
 */
const _getQuotaResetMs = () => {
  const now = new Date();
  const reset = new Date();
  reset.setUTCHours(8, 0, 0, 0); // 08:00 UTC = midnight PST
  if (reset <= now) reset.setUTCDate(reset.getUTCDate() + 1); // next day if already passed
  return reset.getTime();
};

/** Mark a model as exhausted for the rest of today's quota window. */
const _markExhausted = (modelName) => {
  const resetMs = _getQuotaResetMs();
  _exhaustedUntil[modelName] = resetMs;
  const resetIST = new Date(resetMs).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  logger.warn(`[GeminiService] 🔴 ${modelName} marked exhausted until ${resetIST} IST — will skip all calls until then`);
};

/** Returns true if this model is currently in the exhaustion cache. */
const _isExhausted = (modelName) => {
  const until = _exhaustedUntil[modelName];
  if (!until) return false;
  if (Date.now() >= until) {
    delete _exhaustedUntil[modelName]; // cache expired — quota reset
    logger.info(`[GeminiService] 🟢 ${modelName} quota cache expired — model available again`);
    return false;
  }
  return true;
};

/**
 * sendChatMessage
 *
 * Sends a message to Gemini using the MODEL_CHAIN fallback strategy:
 *  1. Try primary model (gemini-2.0-flash-lite)
 *  2. On hard quota or 404 → try next model in chain
 *  3. On transient errors → retry same model up to 2 times with backoff
 *
 * @param {Array}  history  - Gemini-format chat history [{role, parts}]
 * @param {string} message  - New user message
 * @returns {{ aiText, updatedHistory, tokenCount }}
 */

const _sendChatMessageInner = async (history = [], message) => {
  // Note: isSendingMessage in chatStore.js already prevents duplicate concurrent calls.
  // No local time-gate needed here — it would break voice auto-sends.

  const TRANSIENT_RETRIES = 2; // max retries per model for transient errors

  for (let modelIdx = 0; modelIdx < MODEL_CHAIN.length; modelIdx++) {
    const modelName = MODEL_CHAIN[modelIdx];

    // ── Skip models known to be exhausted today ──
    if (_isExhausted(modelName)) {
      logger.warn(`[GeminiService] ⚡ Skipping ${modelName} — daily quota exhausted (cached)`);
      continue;
    }

    let transientAttempt = 0;

    while (transientAttempt <= TRANSIENT_RETRIES) {
      try {
        logger.info(
          `[GeminiService] sendChat — model: ${modelName}, attempt: ${transientAttempt + 1}, ` +
          `history: ${history.length} turns, msg len: ${message.length}`
        );

        const model = getChatModel(modelName);
        const chat = model.startChat({ history });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const aiText = response.text() || '(No response)';

        const updatedHistory = [
          ...history,
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: aiText }] },
        ];

        const tokenCount = response.usageMetadata?.totalTokenCount || 0;
        logger.info(`[GeminiService] Success — model: ${modelName}, tokens: ${tokenCount}`);

        return { aiText, updatedHistory, tokenCount };

      } catch (err) {
        const status = err.status || err.statusCode || 0;
        const msg = err.message || '';

        logger.error(
          `[GeminiService] Error — model: ${modelName}, ` +
          `status: ${status}, attempt: ${transientAttempt + 1}/${TRANSIENT_RETRIES + 1}\n` +
          `  message: ${msg.slice(0, 300)}`
        );

        // ── Hard stops: never retry these ──
        if (isSafetyErr(msg)) {
          throw new AppError('Your message was blocked by safety filters. Please rephrase.', 400);
        }

        // ── Quota / model unavailable: cache it and move to next model in chain ──
        if (isHardDailyQuota(msg) || isModelNotFound(msg, status)) {
          if (isHardDailyQuota(msg)) _markExhausted(modelName);
          const reason = isHardDailyQuota(msg) ? 'daily quota exhausted' : 'model not found';
          logger.warn(`[GeminiService] ${modelName} — ${reason}, trying next model...`);
          break; // exit inner while → advance modelIdx
        }

        // ── Per-minute rate limit: wait server-suggested delay then retry same model ──
        if (isQuotaErr(msg, status) && !isHardDailyQuota(msg)) {
          transientAttempt++;
          if (transientAttempt > TRANSIENT_RETRIES) {
            logger.warn(`[GeminiService] ${modelName} rate-limited after ${TRANSIENT_RETRIES} retries, trying next model...`);
            break;
          }
          const waitMs = extractRetryDelay(err) ?? 15000;
          logger.warn(`[GeminiService] Rate limited — waiting ${waitMs}ms before retry...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        // ── Transient (5xx / network): exponential backoff, same model ──
        if (isTransient(msg, status)) {
          transientAttempt++;
          if (transientAttempt > TRANSIENT_RETRIES) {
            logger.warn(`[GeminiService] ${modelName} transient failure, trying next model...`);
            break;
          }
          const waitMs = transientAttempt * 1500;
          logger.warn(`[GeminiService] Transient error — retrying in ${waitMs}ms...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        // ── Unknown error: try next model ──
        logger.warn(`[GeminiService] Unknown error from ${modelName}, trying next model...`);
        break;
      }
    }
  }

  // All models exhausted
  throw new AppError(
    'All AI models are currently unavailable. Please try again in a few minutes.',
    503
  );
};

/**
 * sendChatMessage — public wrapper with 30s hard timeout.
 * Prevents long-running model fallback chains from blocking the event loop.
 */
const sendChatMessage = (history = [], message) =>
  withTimeout(
    _sendChatMessageInner(history, message),
    60_000,
    'AI chat request'
  );

/**
 * generateMedicalSummary
 */
const generateMedicalSummary = async (recordsText, patientInfo) => {
  const prompt = `
Generate a comprehensive medical summary for the following patient:

**Patient Information:**
- Name: ${patientInfo.name}
- Age: ${patientInfo.age ?? 'Unknown'}
- Blood Group: ${patientInfo.bloodGroup ?? 'Unknown'}
- Known Conditions: ${patientInfo.chronicConditions?.join(', ') || 'None documented'}
- Allergies: ${patientInfo.allergies?.join(', ') || 'None documented'}

**Health Records:**
${recordsText}

Please provide:
1. **Overview** — Brief health status summary
2. **Key Findings** — Important results from records
3. **Medications** — Any mentioned medications
4. **Recommendations** — Suggested follow-up or areas of concern
5. **Disclaimer** — Note that this is AI-generated

Be concise, clinically accurate, and use plain language.
  `.trim();

  for (const modelName of MODEL_CHAIN) {
    if (_isExhausted(modelName)) { logger.warn(`[GeminiService] ⚡ Skipping ${modelName} (exhausted cache)`); continue; }
    try {
      const model = getSummaryModel(modelName);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      const msg = err.message || '';
      const status = err.status || 0;
      if (isSafetyErr(msg)) throw new AppError('Summary blocked by safety filters.', 400);
      if (isHardDailyQuota(msg) || isModelNotFound(msg, status)) {
        if (isHardDailyQuota(msg)) _markExhausted(modelName);
        logger.warn(`[GeminiService] Summary: ${modelName} unavailable, trying next...`);
        continue;
      }
      logger.error(`[GeminiService] Summary error (${modelName}):`, msg);
      throw new AppError('Failed to generate AI medical summary.', 502);
    }
  }
  throw new AppError('All AI models unavailable for summary generation.', 503);
};

/**
 * analyzeEmergency
 */
const analyzeEmergency = async (symptoms, context = {}) => {
  const prompt = `
Emergency Triage Request:

Symptoms: ${symptoms}
${context.age ? `Patient Age: ${context.age}` : ''}
${context.conditions ? `Known Conditions: ${context.conditions}` : ''}
${context.vitals ? `Vitals: ${context.vitals}` : ''}

Respond with a JSON object in this exact format (no markdown):
{
  "severity": "CRITICAL|HIGH|MODERATE|LOW",
  "callEmergency": true|false,
  "recommendation": "Immediate action to take",
  "reasoning": "Brief clinical reasoning",
  "keywords": ["key symptom 1", "key symptom 2"]
}
  `.trim();

  for (const modelName of MODEL_CHAIN) {
    if (_isExhausted(modelName)) { logger.warn(`[GeminiService] ⚡ Skipping ${modelName} (exhausted cache)`); continue; }
    try {
      const model = getEmergencyModel(modelName);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      try {
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
        return {
          severity: parsed.severity || 'MODERATE',
          callEmergency: parsed.callEmergency ?? false,
          recommendation: parsed.recommendation || 'Seek medical attention',
          reasoning: parsed.reasoning || '',
          keywords: parsed.keywords || [],
        };
      } catch {
        return {
          severity: 'HIGH', callEmergency: true,
          recommendation: 'Unable to fully analyze. If in doubt, call 112 immediately.',
          reasoning: text.slice(0, 300), keywords: [],
        };
      }
    } catch (err) {
      const msg = err.message || '';
      const status = err.status || 0;
      if (isHardDailyQuota(msg) || isModelNotFound(msg, status)) {
        if (isHardDailyQuota(msg)) _markExhausted(modelName);
        logger.warn(`[GeminiService] Emergency: ${modelName} unavailable, trying next...`);
        continue;
      }
      logger.error('Gemini emergency analysis error:', msg);
      throw new AppError('Emergency analysis failed. If in immediate danger, call 112.', 502);
    }
  }
  throw new AppError('All AI models unavailable for emergency analysis.', 503);
};

/**
 * generateSessionTitle
 */
const generateSessionTitle = async (firstMessage) => {
  for (const modelName of MODEL_CHAIN) {
    if (_isExhausted(modelName)) continue; // silent skip for non-critical title gen
    try {
      const model = getChatModel(modelName);
      const prompt = `Generate a very short title (max 5 words, no quotes) for a medical chat session that starts with: "${firstMessage.slice(0, 100)}"`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim().replace(/['"]/g, '').slice(0, 50);
    } catch (err) {
      const msg = err.message || '';
      const status = err.status || 0;
      if (isHardDailyQuota(msg) || isModelNotFound(msg, status)) {
        if (isHardDailyQuota(msg)) _markExhausted(modelName);
        continue;
      }
      // Non-critical — fallback to truncated message
      break;
    }
  }
  return firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
};

/**
 * generateConsultationBrief
 *
 * Generates a structured AI Pre-Consultation Copilot brief for a doctor.
 * Accepts multilingual symptom input (Hindi, Marathi, English, mixed).
 *
 * @param {object} params
 * @param {string}   params.symptomText      - Raw symptom text (any language)
 * @param {string}   params.symptomTranscript - Voice transcript (may differ from cleaned)
 * @param {Array}    params.reportAnalyses   - Array of { analysis, summary } from health records
 * @param {object}   params.patientInfo      - { name, age, gender, bloodGroup, chronicConditions }
 * @returns {object} Structured consultation brief
 */
const generateConsultationBrief = async ({
  symptomText = '',
  symptomTranscript = '',
  reportAnalyses = [],
  patientInfo = {},
}) => {
  /* Slim each report to only the fields the AI actually needs.
     Full JSON.stringify of an analysis object can be 5-10 KB per report;
     with 10 attached reports that blows the Gemini context budget.
     We keep only the clinically-relevant summary fields. */
  const reportContext = reportAnalyses.length > 0
    ? reportAnalyses.map((r, i) => {
        const slim = {
          summary:            r.summary            || null,
          severity:           r.severity           || null,
          abnormalFindings:   (r.abnormalFindings   || []).slice(0, 5),
          detectedConditions: (r.detectedConditions || []).slice(0, 5),
          medicines:          (r.medicines          || []).slice(0, 5),
        };
        return `Report ${i + 1}:\n${JSON.stringify(slim)}`;
      }).join('\n\n').slice(0, 8000)  // hard cap — prevent context overflow
    : 'No reports uploaded.';

  const prompt = `
You are an advanced clinical AI assistant generating a pre-consultation brief for a doctor.

PATIENT INFORMATION:
- Name: ${patientInfo.name || 'Unknown'}
- Age: ${patientInfo.age || 'Unknown'}
- Gender: ${patientInfo.gender || 'Unknown'}
- Blood Group: ${patientInfo.bloodGroup || 'Unknown'}
- Known Conditions: ${(patientInfo.chronicConditions || []).join(', ') || 'None documented'}

PATIENT-REPORTED SYMPTOMS (may be in Hindi, Marathi, English, or mixed):
"${symptomText || symptomTranscript || 'No symptoms provided'}"

UPLOADED HEALTH REPORTS:
${reportContext}

INSTRUCTIONS:
1. If symptoms are in Hindi/Marathi/mixed language, translate and normalize them to clinical English terms.
2. Extract symptom duration if mentioned (e.g., "3 दिन से" = "3 days").
3. Combine symptom data with report findings to generate a comprehensive brief.
4. Assign urgency based on: CRITICAL (immediate emergency), HIGH (severe/urgent), MEDIUM (concerning but not urgent), LOW (routine).
5. Emergency keywords that trigger HIGH/CRITICAL: chest pain, heart attack, stroke, breathing difficulty, severe bleeding, unconscious, paralysis.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "summaryText": "2-3 sentence clinical summary of the patient's situation for the doctor",
  "symptoms": ["normalized symptom 1 in English", "symptom 2"],
  "symptomTimeline": "e.g. '3 days' or 'Unknown'",
  "findings": ["key finding from reports", "another finding"],
  "conditions": ["possible condition 1", "possible condition 2"],
  "urgencyLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "suggestedFocusAreas": ["what doctor should assess 1", "area 2"],
  "recommendedSpecialty": "e.g. General Physician, Cardiologist",
  "abnormalValues": [
    { "parameter": "Hemoglobin", "value": "8.5 g/dL", "normalRange": "12.0-17.5 g/dL", "severity": "high" }
  ],
  "recommendation": "Brief clinical recommendation for the doctor",
  "aiConfidence": 82,
  "disclaimer": "AI-assisted clinical preparation summary. Not a medical diagnosis."
}

Rules:
- Return ONLY valid JSON
- symptoms must be in English regardless of input language
- urgencyLevel must be exactly: LOW, MEDIUM, HIGH, or CRITICAL
- aiConfidence is 0-100 integer
- If no reports uploaded, findings = []
- If no abnormal values, abnormalValues = []
`.trim();

  /* Wrap the entire chain in a 25-second hard timeout */
  const runBrief = async () => {
    for (const modelName of MODEL_CHAIN) {
      /* ── Skip models known to be exhausted today ── */
      if (_isExhausted(modelName)) {
        logger.warn(`[GeminiService] ⚡ Skipping ${modelName} (exhausted cache) for consultationBrief`);
        continue;
      }

      try {
        logger.info(`[GeminiService] consultationBrief — model: ${modelName}`);
        const model = getSummaryModel(modelName);

        /* Per-model hard timeout: 15s — if a model hangs we skip fast */
        const result = await withTimeout(
          model.generateContent(prompt),
          15_000,
          `consultationBrief[${modelName}]`
        );
        const response = await result.response;
        const raw = response.text().trim();

        const cleaned = raw
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();

        const parsed = JSON.parse(cleaned);
        logger.info(`[GeminiService] consultationBrief generated — urgency: ${parsed.urgencyLevel}, confidence: ${parsed.aiConfidence}`);

        return {
          summaryText:          parsed.summaryText || 'AI analysis complete.',
          symptoms:             Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
          symptomTimeline:      parsed.symptomTimeline || 'Unknown',
          findings:             Array.isArray(parsed.findings) ? parsed.findings : [],
          conditions:           Array.isArray(parsed.conditions) ? parsed.conditions : [],
          urgencyLevel:         ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.urgencyLevel) ? parsed.urgencyLevel : 'LOW',
          suggestedFocusAreas:  Array.isArray(parsed.suggestedFocusAreas) ? parsed.suggestedFocusAreas : [],
          recommendedSpecialty: parsed.recommendedSpecialty || 'General Physician',
          abnormalValues:       Array.isArray(parsed.abnormalValues) ? parsed.abnormalValues : [],
          recommendation:       parsed.recommendation || null,
          aiConfidence:         typeof parsed.aiConfidence === 'number' ? parsed.aiConfidence : 75,
          disclaimer:           parsed.disclaimer || 'AI-assisted clinical preparation summary. Not a medical diagnosis.',
          generatedAt:          new Date(),
        };

      } catch (err) {
        const msg    = err.message || '';
        const status = err.status || err.statusCode || 0;

        /* ── Safety block: never retry ── */
        if (isSafetyErr(msg)) {
          throw new AppError('Consultation brief blocked by safety filters.', 400);
        }

        /* ── Hard daily quota: cache exhausted, skip to next model ── */
        if (isHardDailyQuota(msg)) {
          _markExhausted(modelName);
          logger.warn(`[GeminiService] consultationBrief: ${modelName} daily quota exhausted, trying next model...`);
          continue;
        }

        /* ── 404 model not found: skip to next ── */
        if (isModelNotFound(msg, status)) {
          logger.warn(`[GeminiService] consultationBrief: ${modelName} not found (404), trying next model...`);
          continue;
        }

        /* ── Per-minute quota / rate limit: try next model (non-blocking) ── */
        if (isQuotaErr(msg, status)) {
          logger.warn(`[GeminiService] consultationBrief: ${modelName} rate-limited, trying next model...`);
          continue;
        }

        /* ── Transient 5xx: try next model ── */
        if (isTransient(msg, status)) {
          logger.warn(`[GeminiService] consultationBrief: ${modelName} transient error (${status}), trying next model...`);
          continue;
        }

        /* ── Per-model timeout: skip to next ── */
        if (msg.includes('timed out')) {
          logger.warn(`[GeminiService] consultationBrief: ${modelName} per-model timeout, trying next model...`);
          continue;
        }

        /* ── JSON parse failure: try next model (model returned garbled JSON) ── */
        if (err instanceof SyntaxError) {
          logger.warn(`[GeminiService] consultationBrief: ${modelName} returned invalid JSON, trying next model...`);
          continue;
        }

        /* ── Unknown error: log and try next model ── */
        logger.error(
          `[GeminiService] consultationBrief error (${modelName}): ` +
          `status=${status} msg="${msg.slice(0, 300)}" ` +
          `type=${err.constructor?.name || 'unknown'}`
        );
        continue; // try next model instead of throwing immediately
      }
    }

    /* All models exhausted */
    throw new AppError('Failed to generate AI consultation brief. All models unavailable.', 502);
  }; // end runBrief

  return withTimeout(runBrief(), 60_000, 'AI consultation brief');
};

module.exports = {
  sendChatMessage,
  generateMedicalSummary,
  analyzeEmergency,
  generateSessionTitle,
  generateConsultationBrief,
};
