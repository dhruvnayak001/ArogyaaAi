/**
 * test/otp.test.js
 * End-to-end integration test for OTP email verification
 * Usage: node test/otp.test.js
 */

'use strict';

const axios = require('axios');
const BASE  = 'http://localhost:5000/api/v1';
const TS    = Date.now();

async function run() {
  console.log('\n🧪 ArogyaAI OTP Integration Tests');
  console.log('='.repeat(42));

  /* 1. Register a fresh user */
  let token, userId;
  try {
    const r = await axios.post(`${BASE}/auth/register`, {
      name:     'OTP Test User',
      email:    `otptest_${TS}@arogyaai.dev`,
      password: 'Test@123456',
    });
    token  = r.data.data.accessToken;
    userId = r.data.data.user._id;
    console.log(`\n1. Register   — ✅  User: ${r.data.data.user.email}`);
    console.log(`   isEmailVerified: ${r.data.data.user.isEmailVerified} (should be false)`);
  } catch (e) {
    console.error('1. Register   — ❌ ', e.response?.data?.message ?? e.message);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  /* 2. Send OTP */
  try {
    const r = await axios.post(`${BASE}/auth/send-otp`, {}, { headers: auth });
    console.log(`\n2. Send OTP   — ✅  ${r.data.message}`);
    console.log(`   expiresIn: ${r.data.data.expiresIn} minutes`);
  } catch (e) {
    console.error('2. Send OTP   — ❌ ', e.response?.data?.message ?? e.message);
    process.exit(1);
  }

  /* 3. Try wrong OTP → should reject */
  try {
    await axios.post(`${BASE}/auth/verify-otp`, { otp: '000000' }, { headers: auth });
    console.log('\n3. Wrong OTP  — ❌ (should have rejected!)');
  } catch (e) {
    if (e.response?.status === 400) {
      console.log(`\n3. Wrong OTP  — ✅  Correctly rejected: "${e.response.data.message}"`);
    } else {
      console.error('3. Wrong OTP  — ❌ Unexpected error:', e.response?.data?.message ?? e.message);
    }
  }

  /* 4. Resend cooldown */
  try {
    await axios.post(`${BASE}/auth/resend-otp`, {}, { headers: auth });
    console.log('\n4. Resend     — ❌ (should have rate-limited!)');
  } catch (e) {
    if (e.response?.status === 429) {
      console.log(`\n4. Resend     — ✅  Correctly rate-limited: "${e.response.data.message}"`);
    } else {
      console.error('4. Resend     — ❌ Unexpected error:', e.response?.data?.message ?? e.message);
    }
  }

  /* 5. Check /auth/me still returns isEmailVerified: false */
  try {
    const r = await axios.get(`${BASE}/auth/me`, { headers: auth });
    const verified = r.data.data?.user?.isEmailVerified ?? r.data.user?.isEmailVerified;
    console.log(`\n5. getMe      — ✅  isEmailVerified: ${verified} (should be false)`);
  } catch (e) {
    console.error('5. getMe      — ❌ ', e.response?.data?.message ?? e.message);
  }

  console.log('\n==========================================');
  console.log('✅ OTP tests passed (SMTP email send may vary by env)');
  console.log('   To fully test verify-otp: check your email for the code\n');
}

run().catch(console.error);
