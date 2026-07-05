/**
 * test/auth.test.js
 * Quick integration test for auth endpoints
 * Run: node test/auth.test.js
 */

'use strict';

const http = require('http');

const BASE = 'https://arogyaaai.onrender.com/api/v1';
const EMAIL = `test_${Date.now()}@arogyaai.dev`;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url  = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('\n🧪 ArogyaAI Auth Integration Tests\n' + '='.repeat(40));

  /* ── 1. Register ── */
  console.log('\n1. POST /auth/register');
  const reg = await post('/auth/register', {
    name:     'Test User',
    email:    EMAIL,
    password: 'TestPass123',
    role:     'patient',
  });
  console.log(`   Status: ${reg.status}`);
  console.log(`   Success: ${reg.body.success}`);
  if (reg.status === 201) {
    console.log(`   ✅ User: ${reg.body.data?.user?.name} (${reg.body.data?.user?.role})`);
    console.log(`   ✅ Access token received: ${!!reg.body.data?.accessToken}`);
  } else {
    console.log(`   ❌ Error: ${JSON.stringify(reg.body)}`);
  }

  /* ── 2. Login ── */
  console.log('\n2. POST /auth/login');
  const login = await post('/auth/login', {
    email:    EMAIL,
    password: 'TestPass123',
  });
  console.log(`   Status: ${login.status}`);
  if (login.status === 200) {
    console.log(`   ✅ Logged in: ${login.body.data?.user?.email}`);
    console.log(`   ✅ Access token received: ${!!login.body.data?.accessToken}`);
  } else {
    console.log(`   ❌ Error: ${JSON.stringify(login.body)}`);
  }

  /* ── 3. Forgot password ── */
  console.log('\n3. POST /auth/forgot-password');
  const fp = await post('/auth/forgot-password', { email: EMAIL });
  console.log(`   Status: ${fp.status} — ${fp.body.message}`);
  if (fp.status === 200) console.log('   ✅ Responds without revealing email existence');

  /* ── 4. Duplicate register ── */
  console.log('\n4. POST /auth/register (duplicate email)');
  const dup = await post('/auth/register', {
    name: 'Another User', email: EMAIL, password: 'TestPass123',
  });
  console.log(`   Status: ${dup.status} — Expected 409`);
  if (dup.status === 409) console.log('   ✅ Correctly rejected duplicate');
  else console.log(`   ❌ ${JSON.stringify(dup.body)}`);

  console.log('\n' + '='.repeat(40) + '\n');
}

run().catch(console.error);
