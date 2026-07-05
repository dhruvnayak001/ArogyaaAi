/**
 * test/analysis.test.js
 * E2E test: upload real lab report PDF → verify extraction + AI analysis
 * Usage: node test/analysis.test.js
 */

'use strict';

const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');
const path     = require('path');
const PDFDoc   = require('pdfkit');
const BASE     = 'https://arogyaaai.onrender.com/api/v1';

/* ── Generate a proper PDF with a text layer using pdfkit ── */
function makeLabReportPdf() {
  return new Promise((resolve, reject) => {
    const outPath = path.join(__dirname, '_lab_report_real.pdf');
    const doc = new PDFDoc({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(18).text('PATHOLOGY LABORATORY REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('Patient: John Doe        Age: 45 Years        Date: 15-Jan-2025');
    doc.text('Doctor: Dr. Priya Sharma        Lab: HealthPath Diagnostics, Mumbai');
    doc.moveDown();

    doc.fontSize(12).text('COMPLETE BLOOD COUNT', { underline: true });
    doc.fontSize(10);
    doc.text('Hemoglobin       :  8.2 g/dL         Reference: 12.0–17.5 g/dL    LOW');
    doc.text('WBC              :  12500 cells/uL    Reference: 4000–11000         HIGH');
    doc.text('Platelets        :  450000 /uL        Reference: 150000–400000      HIGH');
    doc.moveDown();

    doc.fontSize(12).text('BLOOD GLUCOSE', { underline: true });
    doc.fontSize(10);
    doc.text('Fasting Glucose  :  185 mg/dL         Reference: 70–100 mg/dL       HIGH');
    doc.text('HbA1c            :  8.2%              Reference: Below 5.7%         HIGH');
    doc.moveDown();

    doc.fontSize(12).text('LIPID PROFILE', { underline: true });
    doc.fontSize(10);
    doc.text('Total Cholesterol:  285 mg/dL         Reference: Below 200 mg/dL    HIGH');
    doc.text('LDL Cholesterol  :  180 mg/dL         Reference: Below 100 mg/dL    HIGH');
    doc.text('HDL Cholesterol  :  32 mg/dL          Reference: Above 40 mg/dL     LOW');
    doc.text('Triglycerides    :  310 mg/dL         Reference: Below 150 mg/dL    HIGH');
    doc.moveDown();

    doc.fontSize(12).text('BLOOD PRESSURE', { underline: true });
    doc.fontSize(10).text('BP: 158/96 mmHg     Status: STAGE 2 HYPERTENSION');
    doc.moveDown();

    doc.fontSize(12).text('IMPRESSION', { underline: true });
    doc.fontSize(10).text('Anemia (microcytic), Uncontrolled Diabetes Mellitus Type 2, Dyslipidemia, Stage 2 Hypertension');
    doc.moveDown();

    doc.fontSize(12).text('MEDICINES PRESCRIBED', { underline: true });
    doc.fontSize(10).text('1. Metformin 500mg — Twice daily with meals');
    doc.text('2. Atorvastatin 40mg — Once daily at bedtime');
    doc.text('3. Amlodipine 5mg — Once daily morning');
    doc.text('4. Iron Sucrose 200mg — IV weekly x 4 doses');
    doc.moveDown();

    doc.text('ADVICE: Consult physician immediately. Follow-up blood work in 4 weeks. Low sugar, low fat diet advised.');

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

async function run() {
  console.log('\n🔬 ArogyaAI Medical Analysis E2E Test');
  console.log('='.repeat(42));

  /* Generate PDF */
  const labPdf = await makeLabReportPdf();
  console.log('\n✅ Lab report PDF generated:', path.basename(labPdf));

  /* Auth */
  let token;
  try {
    const r = await axios.post(`${BASE}/auth/register`, {
      name: 'Analysis Tester', email: `analysis_${Date.now()}@test.dev`, password: 'Test@123456',
    });
    token = r.data.data.accessToken;
    console.log('✅ Auth token acquired');
  } catch (e) {
    console.error('❌ Auth failed:', e.response?.data?.message ?? e.message);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  /* Upload lab report */
  let recordId;
  try {
    const form = new FormData();
    form.append('title', 'CBC + Lipid Panel Jan 2025');
    form.append('type',  'lab_report');
    form.append('date',  '2025-01-15');
    form.append('file',  fs.createReadStream(labPdf), {
      filename:    'lab_report.pdf',
      contentType: 'application/pdf',
    });

    console.log('\n📤 Uploading PDF... (OCR + AI may take 15-45s)\n');

    const r = await axios.post(`${BASE}/records`, form, {
      headers:          { ...auth, ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      timeout:          120_000,
    });

    const rec = r.data.data.record;
    recordId  = rec._id;

    console.log('UPLOAD RESULTS:');
    console.log('  Record ID:         ', recordId);
    console.log('  Cloudinary URL:    ', rec.fileUrl ? '✅' : '❌');
    console.log('  Extraction method: ', rec.extractionMethod  || 'none');
    console.log('  Text chars:        ', rec.extractedText?.length ?? 0);
    console.log('  Page count:        ', rec.pageCount ?? 'n/a');

    const a = rec.analysis;
    if (a?.severity) {
      console.log('\nAI ANALYSIS:');
      console.log('  Severity:         ', a.severity);
      console.log('  Summary:          ', a.summary?.slice(0, 100));
      console.log('  Conditions:       ', a.detectedConditions?.join(', ') || 'none');
      console.log('  Medicines:        ', a.medicines?.slice(0, 3).join(', ') || 'none');
      console.log('  Abnormal count:   ', a.abnormalFindings?.length ?? 0);
      console.log('  Follow-up:        ', a.suggestedFollowUp?.slice(0, 60) || 'none');
      console.log('\n  Key Values:');
      Object.entries(a.extractedValues || {}).forEach(([k, v]) => {
        if (v && v !== 'null') console.log(`    ${k.padEnd(18)}: ${v}`);
      });
      if (a.abnormalFindings?.length) {
        console.log('\n  Abnormal Findings:');
        a.abnormalFindings.forEach((f) =>
          console.log(`    [${(f.severity||'?').toUpperCase().padEnd(8)}] ${f.parameter}: ${f.value} (ref: ${f.normalRange})`)
        );
      }
      console.log('\n✅ ANALYSIS PIPELINE: PASSED');
    } else {
      console.log('\n⚠️  No AI analysis returned. Extraction method:', rec.extractionMethod);
      if (rec.extractedText) console.log('   Extracted text:', rec.extractedText.slice(0, 200));
    }

  } catch (e) {
    console.error('❌ Upload failed:', e.response?.data?.message ?? e.message);
  }

  /* Re-analyze */
  if (recordId) {
    try {
      const r = await axios.post(`${BASE}/records/${recordId}/reanalyze`, {}, {
        headers: auth, timeout: 60_000,
      });
      const upd = r.data.data.record;
      console.log(`\n✅ Re-analyze: severity=${upd.analysis?.severity}`);
    } catch (e) {
      console.error('❌ Re-analyze:', e.response?.data?.message ?? e.message);
    }
  }

  try { fs.unlinkSync(labPdf); } catch {}
  console.log('\n='.repeat(42));
  console.log('Test complete.\n');
}

run().catch(console.error);
