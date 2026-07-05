/**
 * utils/extractionToken.js
 * Signs the result of an AI document extraction (POST /records/extract-preview)
 * so that POST /records/confirm-save can verify it actually came from a real
 * server-side Gemini/OCR run, rather than trusting a client-supplied
 * `extractedData` blob at face value.
 *
 * Without this, a client could call /records/confirm-save directly with a
 * hand-crafted `extractedData` object — bypassing extraction entirely and
 * fabricating (or hiding) medical findings that flow straight into a
 * doctor-facing AI summary (see medicalAnalysis.service.js DOCTOR_SUMMARY_PROMPT).
 *
 * Token shape: `${base64url(payloadJson)}.${hmacHex}`
 * - Stateless (no server-side session store needed).
 * - Bound to the requesting user via `userId`.
 * - Short TTL so a leaked/replayed token has a narrow window.
 */

'use strict';

const crypto = require('crypto');

const TTL_MS = 30 * 60 * 1000; // 30 minutes — long enough to review + confirm

const getSecret = () => {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) throw new Error('COOKIE_SECRET is not configured — cannot sign extraction tokens.');
  return secret;
};

const base64urlEncode = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

const base64urlDecode = (str) =>
  JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));

const sign = (payload) => {
  const body = { ...payload, iat: Date.now(), exp: Date.now() + TTL_MS };
  const encoded = base64urlEncode(body);
  const hmac = crypto.createHmac('sha256', getSecret()).update(encoded).digest('hex');
  return `${encoded}.${hmac}`;
};

/**
 * verify
 * @param {string} token
 * @param {string} expectedUserId - the requesting user's ID; the token must
 *   have been issued to this same user (prevents replaying another user's
 *   extraction token against your own confirm-save call).
 * @returns {object|null} the original payload (minus iat/exp) or null if
 *   invalid/expired/mismatched.
 */
const verify = (token, expectedUserId) => {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, hmac] = token.split('.');
  if (!encoded || !hmac) return null;

  const expectedHmac = crypto.createHmac('sha256', getSecret()).update(encoded).digest('hex');
  const expectedBuf = Buffer.from(expectedHmac, 'utf8');
  const givenBuf     = Buffer.from(hmac, 'utf8');
  if (expectedBuf.length !== givenBuf.length || !crypto.timingSafeEqual(expectedBuf, givenBuf)) {
    return null;
  }

  let payload;
  try {
    payload = base64urlDecode(encoded);
  } catch {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;
  if (String(payload.userId) !== String(expectedUserId)) return null;

  const { iat, exp, userId, ...rest } = payload;
  return rest;
};

module.exports = { sign, verify };
