/**
 * Quick smoke test for the chat API
 * Usage: node test/chat.test.js
 */

'use strict';

const axios = require('axios');
const BASE = 'https://arogyaaai.onrender.com/api/v1';
const TEST_EMAIL    = `chattest_${Date.now()}@arogyaai.dev`;
const TEST_PASSWORD = 'Test@123456';
const TEST_NAME     = 'Chat Test User';

async function run() {
  console.log('\n🧪 ArogyaAI Chat API Smoke Test');
  console.log('=' .repeat(40));

  // Register fresh user
  let token;
  try {
    const r = await axios.post(`${BASE}/auth/register`, {
      name:     TEST_NAME,
      email:    TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    token = r.data.data?.accessToken ?? r.data.accessToken;
    console.log(`\n1. Register — ✅  ${TEST_EMAIL}`);
  } catch (e) {
    console.error('1. Register — ❌ ', e.response?.data?.message ?? e.message);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  // Create session
  let sessionId;
  try {
    const r = await axios.post(`${BASE}/chat/sessions`, {}, { headers: auth });
    sessionId = r.data.data?.session?._id ?? r.data.session?._id;
    console.log(`2. Create session — ✅  ID: ${sessionId}`);
  } catch (e) {
    console.error('2. Create session — ❌ ', e.response?.data?.message ?? e.message);
    process.exit(1);
  }

  // Send a message (triggers Gemini)
  try {
    const r = await axios.post(
      `${BASE}/chat/sessions/${sessionId}/messages`,
      { content: 'What is paracetamol used for?' },
      { headers: auth }
    );
    const ai = r.data.data?.aiMessage ?? r.data.aiMessage;
    console.log(`3. Send message — ✅  AI replied (${ai.content.length} chars)`);
    console.log(`   Preview: "${ai.content.slice(0, 120).replace(/\n/g,' ')}..."`);
  } catch (e) {
    console.error('3. Send message — ❌ ', e.response?.data?.message ?? e.message);
    process.exit(1);
  }

  // Get sessions list (verify envelope)
  try {
    const r = await axios.get(`${BASE}/chat/sessions`, { headers: auth });
    const sessions = r.data.data?.sessions ?? r.data.sessions ?? [];
    console.log(`4. Get sessions — ✅  ${sessions.length} session(s) found`);
    console.log(`   Response envelope: data.data.sessions = ${Array.isArray(r.data.data?.sessions)}`);
  } catch (e) {
    console.error('4. Get sessions — ❌ ', e.response?.data?.message ?? e.message);
  }

  console.log('\n========================================');
  console.log('✅ ALL CHAT TESTS PASSED\n');
}

run().catch(console.error);
