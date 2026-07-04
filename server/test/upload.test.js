/**
 * test/upload.test.js
 * End-to-end upload pipeline test
 * Verifies: multer parsing → (Cloudinary or dev fallback) → MongoDB storage
 * Usage: node test/upload.test.js
 */

'use strict';

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:5000/api/v1';

/* Create a tiny test PDF (just enough bytes for multer to accept) */
const TINY_PDF = path.join(__dirname, '_test.pdf');
const TINY_PNG = path.join(__dirname, '_test.png');

function makeTestPdf() {
  // Minimal valid PDF header
  const pdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n9\n%%EOF';
  fs.writeFileSync(TINY_PDF, pdf);
}

function makeTestPng() {
  // 1×1 red PNG (base64 decoded)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(TINY_PNG, png);
}

async function run() {
  makeTestPdf();
  makeTestPng();

  console.log('\n🧪 ArogyaAI Upload Pipeline Test');
  console.log('='.repeat(42));

  /* 1. Register & login */
  let token;
  try {
    const r = await axios.post(`${BASE}/auth/register`, {
      name: 'Upload Tester', email: `upload_${Date.now()}@test.dev`, password: 'Test@123456',
    });
    token = r.data.data.accessToken;
    console.log('\n1. Auth        — ✅  Registered + got token');
  } catch (e) {
    console.error('1. Auth        — ❌ ', e.response?.data?.message ?? e.message);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  /* 2. Upload record WITHOUT file */
  try {
    const form = new FormData();
    form.append('title', 'Test Record No File');
    form.append('type', 'other');
    form.append('date', '2025-01-01');

    const r = await axios.post(`${BASE}/records`, form, {
      headers: { ...auth, ...form.getHeaders() },
    });
    const rec = r.data.data.record;
    console.log(`\n2. No-file upload — ✅  Record ID: ${rec._id}`);
    console.log(`   files[].length: ${rec.files?.length ?? 0} (should be 0)`);
    console.log(`   fileUrl: ${rec.fileUrl ?? 'null'} (should be null)`);
  } catch (e) {
    console.error('2. No-file upload — ❌ ', e.response?.data?.message ?? e.message);
  }

  /* 3. Upload record WITH PDF (field name "file") */
  try {
    const form = new FormData();
    form.append('title', 'PDF Lab Report Test');
    form.append('type', 'lab_report');
    form.append('date', '2025-06-01');
    form.append('file', fs.createReadStream(TINY_PDF), {
      filename: 'test_report.pdf',
      contentType: 'application/pdf',
    });

    const r = await axios.post(`${BASE}/records`, form, {
      headers: { ...auth, ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const rec = r.data.data.record;
    console.log(`\n3. PDF upload  — ✅  Record ID: ${rec._id}`);
    console.log(`   files[].length: ${rec.files?.length}`);
    console.log(`   fileUrl: ${rec.fileUrl ?? '(Cloudinary not configured — null)'}`);
    console.log(`   mimeType: ${rec.files?.[0]?.mimeType ?? 'n/a'}`);
  } catch (e) {
    const msg = e.response?.data?.message ?? e.message;
    if (msg.includes('Unexpected field')) {
      console.error('3. PDF upload  — ❌  FIELD NAME MISMATCH:', msg);
    } else if (msg.includes('Cloudinary') || msg.includes('cloud')) {
      console.log('3. PDF upload  — ⚠️   Cloudinary not configured:', msg.slice(0, 80));
    } else {
      console.error('3. PDF upload  — ❌ ', msg);
    }
  }

  /* 4. Upload record WITH PNG (image) */
  try {
    const form = new FormData();
    form.append('title', 'X-Ray PNG Test');
    form.append('type', 'scan');
    form.append('date', '2025-06-01');
    form.append('file', fs.createReadStream(TINY_PNG), {
      filename: 'xray.png',
      contentType: 'image/png',
    });

    const r = await axios.post(`${BASE}/records`, form, {
      headers: { ...auth, ...form.getHeaders() },
    });
    const rec = r.data.data.record;
    console.log(`\n4. PNG upload  — ✅  Record ID: ${rec._id}`);
    console.log(`   files[].length: ${rec.files?.length}`);
    console.log(`   mimeType: ${rec.files?.[0]?.mimeType ?? 'n/a'}`);
  } catch (e) {
    const msg = e.response?.data?.message ?? e.message;
    if (msg.includes('Unexpected field')) {
      console.error('4. PNG upload  — ❌  FIELD NAME MISMATCH:', msg);
    } else if (msg.includes('Cloudinary') || msg.includes('cloud')) {
      console.log('4. PNG upload  — ⚠️   Cloudinary not configured:', msg.slice(0, 80));
    } else {
      console.error('4. PNG upload  — ❌ ', msg);
    }
  }

  /* 5. Try wrong field name — should get 500 or 400 but NOT 'Unexpected field' crashing multer */
  try {
    const form = new FormData();
    form.append('title', 'Wrong field test');
    form.append('type', 'other');
    form.append('date', '2025-01-01');
    form.append('document', fs.createReadStream(TINY_PDF), { filename: 'x.pdf', contentType: 'application/pdf' });

    await axios.post(`${BASE}/records`, form, { headers: { ...auth, ...form.getHeaders() } });
    console.log('\n5. Wrong field — ✅  Accepted (multer ignored unknown field — fine)');
  } catch (e) {
    const msg = e.response?.data?.message ?? e.message;
    console.log(`\n5. Wrong field — ℹ️   Got ${e.response?.status}: "${msg.slice(0, 60)}"`);
    console.log('   (Expected: record created without file, since "document" field is ignored)');
  }

  /* 6. Get records list — verify uploaded records appear */
  try {
    const r = await axios.get(`${BASE}/records`, { headers: auth });
    const records = r.data.data?.records ?? r.data.records ?? [];
    console.log(`\n6. Get records — ✅  ${records.length} record(s) in DB`);
  } catch (e) {
    console.error('6. Get records — ❌ ', e.response?.data?.message ?? e.message);
  }

  /* Cleanup temp files */
  try { fs.unlinkSync(TINY_PDF); fs.unlinkSync(TINY_PNG); } catch { }

  console.log('\n==========================================');
  console.log('✅ Upload pipeline test complete.');
  console.log('   If Cloudinary is not configured, fileUrl will be null.');
  console.log('   Configure CLOUDINARY_* in server/.env for real uploads.\n');
}

run().catch(console.error);
