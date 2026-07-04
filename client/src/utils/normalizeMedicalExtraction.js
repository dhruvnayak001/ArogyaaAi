/**
 * utils/normalizeMedicalExtraction.js
 *
 * Production-grade medical OCR normalization pipeline.
 *
 * Pipeline:
 *   rawOCRText ──► CLEAN ──► EXTRACT ──► MERGE WITH AI ──► STRUCTURED DATA
 *
 * Handles:
 *   • Merged-word OCR artefacts  "Male13.5"  →  "Male 13.5"
 *   • Context-based patient name  (line before Age/Sex/PID)
 *   • Line-by-line lab table parsing  (Drlogy, Dr Lal, SRL, Metropolis)
 *   • Regex fallback for non-table formats
 *   • AI confidence-based merge  (AI wins ≥ 0.55, regex fills gaps)
 *   • Condition inference from abnormal lab values
 */

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 ── OCR TEXT CLEANING
   ═══════════════════════════════════════════════════════════════ */

/**
 * cleanOCRText
 * Multi-pass cleaning of raw OCR output.
 * Returns a human-readable string suitable for display AND parsing.
 */
export function cleanOCRText(raw = '') {
  let t = raw;

  // ── 1. Normalise line endings & non-printable chars ──────────
  t = t.replace(/\r\n|\r/g, '\n');
  t = t.replace(/\u00a0/g, ' ');   // non-breaking space
  t = t.replace(/\t/g, '  ');      // tab → 2 spaces
  t = t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''); // control chars

  // ── 2. Fix merged CamelCase words (critical for Indian reports) ──
  //   "PatelAge"  → "Patel Age"     (proper-name + word)
  //   "MaleNormal"→ "Male Normal"
  //   "g/dLLow"  → "g/dL Low"
  //   Avoid breaking: "HbA1c", "WBCCount" (handled by next step)
  t = t.replace(/([a-z])([A-Z][a-z])/g, '$1 $2');

  // ── 3. Fix merged lowercase + digit ──
  //   "Male13.5"  → "Male 13.5"
  //   "Low13"     → "Low 13"
  t = t.replace(/([a-z])(\d)/g, '$1 $2');

  // ── 4. Fix merged digit + uppercase ──
  //   "12.5Low"   → "12.5 Low"
  //   "17.5G"     → "17.5 G"  (unit restoration comes next)
  t = t.replace(/(\d)([A-Z])/g, '$1 $2');

  // ── 5. Restore medical units that the above rules may have split ──
  const unitFixes = [
    [/g\s*\/\s*d\s*[lL]\b/g,          'g/dL'],
    [/m\s*g\s*\/\s*d\s*[lL]\b/g,      'mg/dL'],
    [/m\s*[Ee]\s*q\s*\/\s*[lL]\b/g,   'mEq/L'],
    [/m\s*m\s*[Hh]\s*g\b/g,           'mmHg'],
    [/[×x]\s*10\s*[³3]\s*\/\s*µ\s*[lL]/g, '×10³/µL'],
    [/x\s*10\s*[³3]\s*\/\s*u\s*[lL]/g,    '×10³/µL'],
    [/\/\s*µ\s*[lL]\b/g,              '/µL'],
    [/\/\s*u\s*[lL]\b/g,              '/µL'],
    [/\/\s*m\s*m\s*[³3]\b/g,          '/mm³'],
    [/n\s*g\s*\/\s*m\s*[lL]\b/g,      'ng/mL'],
    [/µ\s*g\s*\/\s*d\s*[lL]\b/g,      'µg/dL'],
    [/I\s*U\s*\/\s*[lL]\b/g,          'IU/L'],
    [/U\s*\/\s*[lL]\b/g,              'U/L'],
  ];
  for (const [re, rep] of unitFixes) t = t.replace(re, rep);

  // ── 6. Remove page-counter noise ──
  t = t.replace(/\bpage\s+\d+\s+of\s+\d+\b/gi, '');
  t = t.replace(/\bpg\s*\.\s*\d+\b/gi, '');
  t = t.replace(/\(\s*Cont(?:inued)?\s*\.\s*\)/gi, '');

  // ── 7. Remove bare URL / email lines ──
  t = t.replace(/^https?:\/\/\S+\s*$/gm, '');
  t = t.replace(/^www\.\S+\s*$/gm, '');
  t = t.replace(/^[\w.-]+@[\w.-]+\.\w+\s*$/gm, '');

  // ── 8. Collapse runs of dashes/equals (table separators) to one ──
  t = t.replace(/[-=_]{4,}/g, '───');

  // ── 9. Normalise multiple spaces (but keep newlines) ──
  t = t.replace(/[ \t]{2,}/g, ' ');

  // ── 10. Trim every line ──
  t = t.split('\n').map((l) => l.trim()).join('\n');

  // ── 11. Remove duplicate consecutive lines ──
  const lines = t.split('\n');
  t = lines.filter((l, i) => i === 0 || l !== lines[i - 1]).join('\n');

  // ── 12. Collapse 3+ blank lines to max 2 ──
  t = t.replace(/\n{3,}/g, '\n\n');

  return t.trim();
}


/* ═══════════════════════════════════════════════════════════════
   SECTION 2 ── HELPERS
   ═══════════════════════════════════════════════════════════════ */

/** Try a list of regex patterns, return first captured group trimmed */
const tryPatterns = (text, patterns) => {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim().replace(/\s+/g, ' ');
  }
  return null;
};

/**
 * Heuristic: does this string look like a person's name?
 *  - 2–6 words, each word starts with uppercase or is an initial
 *  - No digits, colons, brackets
 *  - 3–60 chars
 */
function isNameLike(str) {
  if (!str) return false;
  const s = str.trim();
  if (s.length < 3 || s.length > 60) return false;
  if (/[\d:|\[\]{}<>]/.test(s)) return false;   // digits or special chars → not a name
  if (/^(test|result|normal|abnormal|unit|range|date|page|lab|report|sample|ref)/i.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  const connectors = new Set(['of', 'de', 'van', 'el', 'al', 'bin', 'binti', 'kumar', 'singh', 'shah']);
  return words.every(
    (w) =>
      connectors.has(w.toLowerCase()) ||
      /^[A-Z][a-z.'-]{0,20}$/.test(w) ||   // proper word
      /^[A-Z]{1,2}\.?$/.test(w)             // initial: "M." or "M"
  );
}

/** Safely extract value from { value, confidence } or plain string, with min confidence */
export const safeAiVal = (fieldData, minConf = 0.5) => {
  if (!fieldData) return null;
  if (typeof fieldData === 'string') return fieldData.trim() || null;
  if (typeof fieldData === 'object') {
    const { value, confidence } = fieldData;
    if (!value || value === 'null' || value === 'undefined') return null;
    if (confidence !== undefined && confidence !== null && confidence < minConf) return null;
    return String(value).trim() || null;
  }
  return null;
};

/** Pull raw value ignoring confidence (for display in EditableMedicalField aiValue prop) */
export const extractValue = (fieldData) => {
  if (!fieldData) return null;
  if (typeof fieldData === 'string') return fieldData || null;
  return fieldData?.value ?? null;
};

/** Pull confidence from { value, confidence } */
export const extractConfidence = (fieldData) => {
  if (!fieldData || typeof fieldData !== 'object') return null;
  return fieldData.confidence ?? null;
};


/* ═══════════════════════════════════════════════════════════════
   SECTION 3 ── PATIENT INFO EXTRACTION
   ═══════════════════════════════════════════════════════════════ */

/**
 * extractPatientNameRobust
 *
 * Strategy 1 — Explicit label:  "Patient Name: Yash M. Patel"
 * Strategy 2 — Context (line before "Age :" / "Sex :" / "PID :"):
 *               Yash M. Patel       ← this line
 *               Age : 21 Y
 * Strategy 3 — Same line (after cleaning): "Yash M. Patel Age : 21"
 * Strategy 4 — Prefix: "Mr. Yash M. Patel"
 */
export function extractPatientNameRobust(text) {
  // ── Strategy 1: explicit label ──────────────────────────────
  const labeled = tryPatterns(text, [
    /patient\s*name\s*[:\|]\s*([A-Za-z][A-Za-z\s.'-]{2,50}?)(?=\s*(?:\n|\r|,|\s{2,}|age\b|sex\b|pid\b|ref\b|dob\b))/i,
    /(?:^|\n)\s*name\s*[:\|]\s*([A-Za-z][A-Za-z\s.'-]{2,50}?)(?=\s*(?:\n|,|\s{2,}|age\b))/im,
    /patient\s*[:\|]\s*([A-Za-z][A-Za-z\s.'-]{2,50}?)(?=\s*(?:\n|,|\s{2,}))/i,
  ]);
  if (labeled) return labeled.trim();

  // ── Strategy 2: line BEFORE "Age" / "Age/Sex" / "PID" ──────
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 1; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];
    if (
      /^age\s*[:\|\/]/i.test(line) ||
      /^age\s*\/\s*sex/i.test(line) ||
      /^sex\s*[:\|]/i.test(line) ||
      /^(?:pid|patient\s*id|p\.?i\.?d\.?)\s*[:\|]/i.test(line)
    ) {
      // Walk backwards to find the closest non-label name-like line
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        if (isNameLike(lines[j])) return lines[j];
      }
    }
  }

  // ── Strategy 3: name before Age on SAME line (post-clean) ───
  const sameLineMatch = text.match(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z.]+){1,4})\s+(?=age\s*[:\|\/])/i
  );
  if (sameLineMatch && isNameLike(sameLineMatch[1])) return sameLineMatch[1].trim();

  // ── Strategy 4: title prefix ────────────────────────────────
  const prefixMatch = text.match(
    /(?:^|\n)\s*((?:Mr|Mrs|Ms|Shri|Smt)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z.]+){0,4})/m
  );
  if (prefixMatch && isNameLike(prefixMatch[1])) return prefixMatch[1].trim();

  return null;
}

export const extractAge = (text) =>
  tryPatterns(text, [
    /age\s*[\/\-:\s]\s*sex\s*[:\-]\s*(\d{1,3})\s*(?:y(?:ears?|rs?)?)?\s*[\/\-]/i,
    /age\s*[:\-]\s*(\d{1,3})\s*(?:y(?:ears?|rs?)?\b)/i,
    /age\s*[:\-]\s*(\d{1,3})\b/i,
    /(\d{1,3})\s*(?:years?|yrs?)\s*[\/|]\s*(?:male|female|m\b|f\b)/i,
  ]);

export const extractGender = (text) => {
  const raw = tryPatterns(text, [
    /sex\s*[:\-]\s*(male|female|m\b|f\b)/i,
    /gender\s*[:\-]\s*(male|female)/i,
    /age[\/\-\s]sex\s*[:\-]\s*\d+\s*(?:\w+\s*)?[\/\-]\s*(male|female|m\b|f\b)/i,
  ]);
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r === 'm') return 'Male';
  if (r === 'f') return 'Female';
  return r.charAt(0).toUpperCase() + r.slice(1);
};

export const extractDoctorName = (text) => {
  const labeled = tryPatterns(text, [
    /(?:ref(?:erred)?\s*(?:by|through)?|referring\s*(?:doctor|physician)|physician|consultant|doctor\s*name|ref\s*by)\s*[:\-]\s*(?:Dr\.?\s*)?([A-Za-z][A-Za-z\s.]{2,45}?)(?=\s*(?:\n|,|\s{3,}))/i,
    /(?:attending|ordering)\s*(?:doctor|physician)\s*[:\-]\s*(?:Dr\.?\s*)?([A-Za-z][A-Za-z\s.]{2,45}?)(?=\s*(?:\n|,))/i,
  ]);
  if (labeled) {
    const name = labeled.trim();
    return name.startsWith('Dr') ? name : `Dr. ${name}`;
  }
  const drMatch = text.match(/\bDr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z.]+){0,3})/);
  if (drMatch) return `Dr. ${drMatch[1].trim()}`;
  return null;
};

export const extractLabName = (text) => {
  // All-caps lab name at very start of text
  const topLines = text.split('\n').slice(0, 6).map((l) => l.trim());
  for (const line of topLines) {
    if (
      /\b(pathology|laboratory|lab|diagnostic[s]?|hospital|clinic|health|centre|center)\b/i.test(line) &&
      line.length > 4 &&
      line.length < 80 &&
      !/^(test|result|normal|ref|patient|age|sex)/i.test(line)
    ) {
      return line.replace(/\s+/g, ' ').trim();
    }
  }
  return tryPatterns(text, [
    /(?:lab(?:oratory)?|pathology|diagnostic[s]?)\s*name\s*[:\-]\s*([A-Za-z][A-Za-z\s&.,]{3,60}?)(?=\s*(?:\n|,))/i,
    /(?:from|at|by)\s*[:\-]?\s*([A-Z][A-Z\s&.]{4,60}(?:pathology|laboratory|lab|diagnostic|hospital|labs))\b/i,
  ]);
};

export const extractSampleType = (text) => {
  const result = tryPatterns(text, [
    /(?:sample|specimen)\s*(?:type|collected)?\s*[:\-]\s*(blood|urine|serum|plasma|stool|f[ae]ces|sputum|csf|synovial\s*fluid)/i,
    /(?:material|test\s*type)\s*[:\-]\s*(blood|urine|serum|plasma)/i,
  ]);
  if (result) return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
  if (/\bblood\s*(?:test|report|sample|work)\b/i.test(text)) return 'Blood';
  if (/\burine\s*(?:test|report|sample|analysis)\b/i.test(text)) return 'Urine';
  return null;
};

export const extractReportDate = (text) =>
  tryPatterns(text, [
    /(?:report\s*date|collection\s*date|sample\s*(?:date|time)|date\s*of\s*(?:report|collection|test))\s*[:\-]\s*([\d]{1,2}[\s\/\-.][A-Za-z0-9]{1,3}[\s\/\-.][\d]{2,4})/i,
    /(?:report\s*date|date)\s*[:\-]\s*([\d]{1,2}[\s\/\-.][\d]{1,2}[\s\/\-.][\d]{2,4})/i,
    /(?:date)\s*[:\-]\s*(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4})/i,
    /([\d]{1,2}[\-\/][\d]{1,2}[\-\/][\d]{2,4})/,
  ]);

export const extractPatientId = (text) =>
  tryPatterns(text, [
    /(?:patient\s*(?:id|no\.?|number)|pid|p\.?i\.?d\.?|reg(?:istration)?\s*(?:no\.?|id)|uhid|lab\s*no)\s*[:\-]\s*([A-Za-z0-9\-\/]{1,20})/i,
    /(?:cr\s*no\.?|sample\s*id|barcode)\s*[:\-]\s*([A-Za-z0-9\-\/]{1,20})/i,
  ]);

export const extractBloodPressure = (text) => {
  const m = text.match(
    /(?:b\.?p\.?|blood\s*pressure)\s*[:\-]?\s*(\d{2,3}\s*\/\s*\d{2,3})\s*(?:mm\s*hg)?/i
  );
  if (m) return `${m[1].replace(/\s/g, '')} mmHg`;
  return null;
};


/* ═══════════════════════════════════════════════════════════════
   SECTION 4 ── LAB VALUE EXTRACTION
   ═══════════════════════════════════════════════════════════════ */

/**
 * LAB_BOUNDS — per-test configuration
 *   linePattern : regex to identify test in a line
 *   min / max   : sanity bounds for the numeric value (in display units)
 *   scaleIf     : if raw value > scaleIf, divide by scaleDivisor
 *   scaleDivisor: see above (WBC /µL → ×10³/µL)
 *   unit        : display unit string
 *   regexFallback: whole-text regex to find the value
 */
const LAB_BOUNDS = {
  hemoglobin: {
    linePattern:   /h[ae]moglobin\b|\bHb\b(?!\s*A1c)/i,
    regexFallback: /h[ae]moglobin\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: 'g/dL', min: 2, max: 25,
  },
  glucose: {
    linePattern:   /(?:(?:blood|fasting|random|pp|post\s*prandial)?\s*(?:blood\s+)?(?:glucose|sugar))\b/i,
    regexFallback: /(?:(?:blood|fasting|pp)?\s*(?:glucose|sugar))\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: 'mg/dL', min: 20, max: 800,
  },
  cholesterol: {
    linePattern:   /(?:total\s*)?cholesterol\b/i,
    regexFallback: /cholesterol\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: 'mg/dL', min: 50, max: 600,
  },
  hba1c: {
    linePattern:   /hb\s*a1c\b|glyc(?:osy?l?a?t?|ated)\s*h[ae]moglobin|glycated\b/i,
    regexFallback: /hb\s*a1c\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: '%', min: 2, max: 20,
  },
  creatinine: {
    linePattern:   /creatinine\b/i,
    regexFallback: /creatinine\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: 'mg/dL', min: 0.1, max: 30,
  },
  sodium: {
    linePattern:   /\bsodium\b/i,
    regexFallback: /\bsodium\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: 'mEq/L', min: 100, max: 200,
  },
  potassium: {
    linePattern:   /\bpotassium\b/i,
    regexFallback: /\bpotassium\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: 'mEq/L', min: 1, max: 10,
  },
  wbc: {
    linePattern:   /(?:wbc|w\.b\.c\.?|white\s*blood\s*(?:cells?|corpuscles?|count))\b/i,
    regexFallback: /(?:wbc|white\s*blood\s*(?:cell|count))\b[^0-9\n\r]{0,50}?(\d+[\d,.]*)/i,
    unit: '×10³/µL', min: 1, max: 100,
    scaleIf: 500, scaleDivisor: 1000,
  },
  platelets: {
    linePattern:   /\bplatelet(?:\s*count)?\b/i,
    regexFallback: /\bplatelet\b[^0-9\n\r]{0,40}?(\d+[\d,.]*)/i,
    unit: '×10³/µL', min: 10, max: 2000,
    scaleIf: 10000, scaleDivisor: 1000,
  },
  triglycerides: {
    linePattern:   /\btriglycerides?\b/i,
    regexFallback: /\btriglycerides?\b[^0-9\n\r]{0,40}?(\d+\.?\d*)/i,
    unit: 'mg/dL', min: 20, max: 1500,
  },
};

/** Format a float nicely (no trailing .0) */
const fmtNum = (n) => (n % 1 === 0 ? String(n) : n.toFixed(1));

/** Apply scale conversion if the raw number is in a different unit */
function applyScale(cfg, raw) {
  if (cfg.scaleIf && raw > cfg.scaleIf) return raw / cfg.scaleDivisor;
  return raw;
}

/** Validate a scaled numeric value against bounds */
function inBounds(cfg, val) {
  return val >= cfg.min && val <= cfg.max;
}

/**
 * extractLabValuesLineByLine
 *
 * Primary extraction strategy: scan each line for known test identifiers.
 * On a matching line, pick the first number that passes sanity bounds.
 * This handles the "tabular" Drlogy/SRL/Metropolis format:
 *   Hemoglobin (Hb)    12.5    Low    13.5 - 17.5    g/dL
 */
function extractLabValuesLineByLine(lines) {
  const results = {};

  for (const line of lines) {
    if (line.length < 5) continue;
    if (/^[─\-=_*#]{3,}/.test(line)) continue; // separator lines
    if (/^(?:test|parameter|investigation|analyte)\b/i.test(line)) continue; // header row

    for (const [key, cfg] of Object.entries(LAB_BOUNDS)) {
      if (key in results) continue; // already found
      if (!cfg.linePattern.test(line)) continue;

      // Extract all numeric tokens from the line
      const nums = [...line.matchAll(/\d+\.?\d*/g)].map((m) => parseFloat(m[0]));

      for (const raw of nums) {
        if (isNaN(raw)) continue;
        const val = applyScale(cfg, raw);
        if (inBounds(cfg, val)) {
          results[key] = fmtNum(val);
          break;
        }
      }
    }
  }

  return results;
}

/**
 * extractLabValuesByRegex
 * Fallback: whole-text regex search (handles non-table, prose formats).
 */
function extractLabValuesByRegex(text) {
  const results = {};

  for (const [key, cfg] of Object.entries(LAB_BOUNDS)) {
    const m = text.match(cfg.regexFallback);
    if (!m?.[1]) continue;
    const raw = parseFloat(String(m[1]).replace(/,/g, ''));
    if (isNaN(raw)) continue;
    const val = applyScale(cfg, raw);
    if (inBounds(cfg, val)) results[key] = fmtNum(val);
  }

  return results;
}

/**
 * extractLabValuesRobust
 * Runs both strategies; line-by-line wins (more precise), regex fills gaps.
 */
export function extractLabValuesRobust(text) {
  const lines     = text.split('\n');
  const lineVals  = extractLabValuesLineByLine(lines);
  const regexVals = extractLabValuesByRegex(text);
  return { ...regexVals, ...lineVals }; // line-by-line wins
}


/* ═══════════════════════════════════════════════════════════════
   SECTION 5 ── CONDITION & ABNORMAL FINDING INFERENCE
   ═══════════════════════════════════════════════════════════════ */

const NORMAL_RANGES = {
  hemoglobin:    { min: 12.0, max: 17.5, label: 'Hemoglobin',    unit: 'g/dL',    lowSev: 'moderate', highSev: 'low'      },
  glucose:       { min: 70,   max: 99,   label: 'Blood Glucose', unit: 'mg/dL',   lowSev: 'high',     highSev: 'high'     },
  cholesterol:   { min: 0,    max: 200,  label: 'Cholesterol',   unit: 'mg/dL',   lowSev: 'low',      highSev: 'moderate' },
  hba1c:         { min: 0,    max: 5.7,  label: 'HbA1c',         unit: '%',       lowSev: 'low',      highSev: 'high'     },
  creatinine:    { min: 0.7,  max: 1.3,  label: 'Creatinine',    unit: 'mg/dL',   lowSev: 'low',      highSev: 'moderate' },
  sodium:        { min: 135,  max: 145,  label: 'Sodium',        unit: 'mEq/L',   lowSev: 'moderate', highSev: 'moderate' },
  potassium:     { min: 3.5,  max: 5.0,  label: 'Potassium',     unit: 'mEq/L',   lowSev: 'moderate', highSev: 'moderate' },
  wbc:           { min: 4.5,  max: 11.0, label: 'WBC Count',     unit: '×10³/µL', lowSev: 'moderate', highSev: 'moderate' },
  platelets:     { min: 150,  max: 400,  label: 'Platelets',     unit: '×10³/µL', lowSev: 'moderate', highSev: 'low'      },
  triglycerides: { min: 0,    max: 150,  label: 'Triglycerides', unit: 'mg/dL',   lowSev: 'low',      highSev: 'moderate' },
};

const INTERPRETATIONS = {
  hemoglobin:    { low: 'Possible anemia, iron deficiency, or blood loss.',           high: 'Possible dehydration or polycythemia.' },
  glucose:       { low: 'Hypoglycemia — monitor closely.',                            high: 'Elevated blood sugar. Possible diabetes or impaired glucose tolerance.' },
  cholesterol:   { high: 'Elevated cardiovascular risk. Lifestyle review recommended.' },
  hba1c:         { high: 'Poor long-term blood glucose control. Diabetes management advised.' },
  creatinine:    { high: 'Possible kidney dysfunction or dehydration.' },
  sodium:        { low: 'Hyponatremia — possible dehydration or kidney issue.',       high: 'Hypernatremia — possible dehydration.' },
  potassium:     { low: 'Hypokalemia — risk of cardiac arrhythmia.',                  high: 'Hyperkalemia — requires urgent review.' },
  wbc:           { low: 'Leukopenia — possible infection risk or bone marrow issue.', high: 'Leukocytosis — possible infection or inflammation.' },
  platelets:     { low: 'Thrombocytopenia — monitor for bleeding risk.',              high: 'Thrombocytosis — possible reactive or primary cause.' },
  triglycerides: { high: 'Hypertriglyceridemia — cardiovascular and pancreatic risk.' },
};

export function buildAbnormalFindingsFromLabValues(labValues) {
  const findings = [];
  for (const [key, range] of Object.entries(NORMAL_RANGES)) {
    const valStr = labValues[key];
    if (!valStr) continue;
    const val = parseFloat(valStr);
    if (isNaN(val)) continue;

    const isLow  = range.min > 0 && val < range.min;
    const isHigh = val > range.max;
    if (!isLow && !isHigh) continue;

    const dir   = isLow ? 'low' : 'high';
    const hints = INTERPRETATIONS[key] || {};

    findings.push({
      parameter:      range.label,
      value:          `${val} ${range.unit}`,
      normalRange:    `${range.min > 0 ? range.min : '0'} – ${range.max} ${range.unit}`,
      severity:       isLow ? range.lowSev : range.highSev,
      interpretation: hints[dir] || `${range.label} is ${dir} than the normal range.`,
      confidence:     0.9,
    });
  }
  return findings;
}

export function inferConditionsFromLabValues(labValues) {
  const conds = new Set();
  const hb  = parseFloat(labValues.hemoglobin);
  const glu = parseFloat(labValues.glucose);
  const hba = parseFloat(labValues.hba1c);
  const cho = parseFloat(labValues.cholesterol);
  const tri = parseFloat(labValues.triglycerides);
  const cre = parseFloat(labValues.creatinine);
  const wbc = parseFloat(labValues.wbc);
  const plt = parseFloat(labValues.platelets);

  if (!isNaN(hb))  { if (hb < 8.0) conds.add('severe anemia'); else if (hb < 12.0) conds.add('anemia'); }
  if (!isNaN(glu)) { if (glu >= 126) conds.add('diabetes mellitus'); else if (glu >= 100) conds.add('pre-diabetes'); }
  if (!isNaN(hba)) { if (hba >= 6.5) conds.add('diabetes mellitus'); else if (hba >= 5.7) conds.add('pre-diabetes'); }
  if (!isNaN(cho) && cho > 240)  conds.add('hypercholesterolemia');
  if (!isNaN(tri) && tri > 200)  conds.add('hypertriglyceridemia');
  if (!isNaN(cre) && cre > 1.4)  conds.add('possible renal impairment');
  if (!isNaN(wbc)) { if (wbc > 11) conds.add('leukocytosis'); else if (wbc < 4) conds.add('leukopenia'); }
  if (!isNaN(plt)) { if (plt < 150) conds.add('thrombocytopenia'); }

  return [...conds];
}


/* ═══════════════════════════════════════════════════════════════
   SECTION 6 ── MAIN EXPORT
   ═══════════════════════════════════════════════════════════════ */

/**
 * normalizeMedicalExtraction
 *
 * Merges AI analysis output + regex/line-parsed raw text into a
 * complete, structured, UI-ready object.
 *
 * Priority:
 *   AI value with confidence ≥ 0.55  →  always wins
 *   AI value with confidence  < 0.55  →  regex/line-parse used instead
 *   AI returns null / empty           →  regex/line-parse fills in
 *   Both null                         →  empty string (NOT a placeholder)
 *
 * Returns `cleanedText` — the OCR-cleaned version for display in
 * the Raw Text accordion (formatted, not a noise dump).
 *
 * @param {string} rawText    - Raw OCR / PDF extracted text
 * @param {object} aiAnalysis - Gemini analysis object (may be empty on failure)
 */
export function normalizeMedicalExtraction(rawText = '', aiAnalysis = null) {

  /* ── 1. Clean ─────────────────────────────────────────────── */
  const cleaned = cleanOCRText(rawText);

  /* ── 2. Extract from cleaned text ─────────────────────────── */
  const rx = {
    patientName:   extractPatientNameRobust(cleaned),
    age:           extractAge(cleaned),
    gender:        extractGender(cleaned),
    patientId:     extractPatientId(cleaned),
    doctorName:    extractDoctorName(cleaned),
    labName:       extractLabName(cleaned),
    sampleType:    extractSampleType(cleaned),
    reportDate:    extractReportDate(cleaned),
    bloodPressure: extractBloodPressure(cleaned),
    labValues:     extractLabValuesRobust(cleaned),
  };

  /* ── 3. AI values (only if confident enough) ───────────────── */
  const profile = aiAnalysis?.patientProfile || {};
  const labMeta = aiAnalysis?.labMetadata    || {};

  const ai = {
    patientName:   safeAiVal(profile.patientName, 0.6) || safeAiVal(labMeta.patientName, 0.6),
    age:           safeAiVal(profile.age,           0.6),
    bloodPressure: safeAiVal(profile.bloodPressure, 0.55),
    diabetes:      safeAiVal(profile.diabetes,      0.55),
    doctorName:    safeAiVal(labMeta.doctorName,    0.6),
    labName:       safeAiVal(labMeta.labName,       0.6),
    sampleType:    safeAiVal(labMeta.sampleType,    0.55),
    reportDate:    safeAiVal(labMeta.reportDate,    0.55),
    symptoms:      (profile.symptoms   || []).map((f) => safeAiVal(f, 0.45)).filter(Boolean),
    allergies:     (profile.allergies  || []).map((f) => safeAiVal(f, 0.45)).filter(Boolean),
    conditions:    (aiAnalysis?.detectedConditions || []).map((f) => safeAiVal(f, 0.45)).filter(Boolean),
    medicines:     (aiAnalysis?.medicines          || []).map((f) => safeAiVal(f, 0.45)).filter(Boolean),
  };

  /* ── 4. AI lab values (strip units, keep numeric only) ─────── */
  const aiLabValues = {};
  Object.entries(aiAnalysis?.extractedValues || {}).forEach(([k, v]) => {
    const raw = safeAiVal(v, 0.5);
    if (!raw || raw === 'null') return;
    const numeric = String(raw).replace(/[^\d.]/g, '').trim();
    if (numeric) aiLabValues[k] = numeric;
  });

  /* ── 5. Merge lab values: regex/line wins over AI ──────────── */
  //    (AI extraction is often less reliable for numeric lab values
  //     than direct text parsing; AI wins only when regex finds nothing)
  const mergedLabValues = { ...aiLabValues, ...rx.labValues };

  /* ── 6. Infer conditions & abnormal findings ───────────────── */
  const inferredConditions = inferConditionsFromLabValues(mergedLabValues);
  const regexAbnormal      = buildAbnormalFindingsFromLabValues(mergedLabValues);

  const aiAbnormal     = aiAnalysis?.abnormalFindings || [];
  const aiAbnormalKeys = new Set(aiAbnormal.map((f) => f.parameter?.toLowerCase()));
  const extraAbnormal  = regexAbnormal.filter(
    (f) => !aiAbnormalKeys.has(f.parameter?.toLowerCase())
  );
  const mergedAbnormal = [...aiAbnormal, ...extraAbnormal];

  const allConditions = new Set([
    ...ai.conditions,
    ...(mergedAbnormal.length > 0 ? inferredConditions : []),
  ]);

  /* ── 7. Build final merged object ──────────────────────────── */
  return {
    /* Scalar patient fields: AI (confident) wins, regex fills gaps */
    patientName:   ai.patientName   || rx.patientName   || '',
    age:           ai.age           || rx.age            || '',
    gender:        rx.gender        || '',
    patientId:     rx.patientId     || '',
    bloodPressure: ai.bloodPressure || rx.bloodPressure  || '',
    diabetes:      ai.diabetes      || '',
    doctorName:    ai.doctorName    || rx.doctorName     || '',
    labName:       ai.labName       || rx.labName        || '',
    sampleType:    ai.sampleType    || rx.sampleType     || '',
    reportDate:    ai.reportDate    || rx.reportDate     || '',

    /* Lab values dict */
    labValues: mergedLabValues,

    /* Clinical arrays */
    symptoms:           ai.symptoms,
    allergies:          ai.allergies,
    detectedConditions: [...allConditions],
    medicines:          ai.medicines,

    /* Abnormal & severity */
    abnormalFindings:  mergedAbnormal,
    aiSummary:         aiAnalysis?.summary || null,
    severity:          aiAnalysis?.severity || 'normal',
    suggestedFollowUp: aiAnalysis?.suggestedFollowUp || null,
    overallConfidence: aiAnalysis?.overallConfidence ?? null,

    /* Cleaned text — use this in the accordion instead of raw OCR */
    cleanedText: cleaned,
  };
}

/* ── Re-export confidence helpers (used by store & modal) ── */
export const CONFIDENCE_THRESHOLDS = { HIGH: 0.8, MEDIUM: 0.6, LOW: 0 };

export const classifyConfidence = (c) => {
  if (c === null || c === undefined) return 'unknown';
  if (c >= 0.8) return 'high';
  if (c >= 0.6) return 'medium';
  return 'low';
};
