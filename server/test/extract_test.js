/**
 * Quick extraction test — run BEFORE starting server
 * node test/extract_test.js
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PDFDoc = require('pdfkit');
const fs     = require('fs');
const path   = require('path');

async function makePdf() {
  return new Promise((resolve, reject) => {
    const out = path.join(__dirname, '_quick_test.pdf');
    const doc = new PDFDoc({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(out);
    doc.pipe(stream);
    doc.fontSize(12).text('Patient: John Doe  Lab: HealthPath Diagnostics');
    doc.text('Hemoglobin: 8.2 g/dL   Reference: 12.0-17.5   LOW');
    doc.text('Fasting Glucose: 185 mg/dL   Reference: 70-100   HIGH');
    doc.text('Total Cholesterol: 285 mg/dL   Reference: <200   HIGH');
    doc.text('HbA1c: 8.2%   Reference: <5.7%   HIGH');
    doc.text('BP: 158/96 mmHg   HYPERTENSION STAGE 2');
    doc.text('Medicines: Metformin 500mg, Atorvastatin 40mg, Amlodipine 5mg');
    doc.end();
    stream.on('finish', () => resolve(out));
    stream.on('error', reject);
  });
}

async function run() {
  console.log('\n=== Quick Extraction Test ===\n');

  const pdfPath = await makePdf();
  const buffer  = fs.readFileSync(pdfPath);
  console.log('PDF size:', buffer.length, 'bytes');

  const { extractFromPdf } = require('../src/services/pdfParser.service');

  const result = await extractFromPdf(buffer);
  console.log('\n--- extractFromPdf result ---');
  console.log('method:', result.method);
  console.log('pageCount:', result.pageCount);
  console.log('needsOcr:', result.needsOcr);
  console.log('text.length:', result.text.length);
  console.log('text preview:\n', result.text.slice(0, 300));

  if (result.text.length > 50) {
    console.log('\n✅ PDF text extraction: WORKING');
  } else if (result.needsOcr) {
    console.log('\n⚠️  PDF needs OCR — will use Gemini Vision');
    // Test Gemini Vision
    const { extractViaOcr } = require('../src/services/ocr.service');
    console.log('\nTesting Gemini Vision OCR...');
    const ocr = await extractViaOcr(buffer, 'application/pdf');
    console.log('OCR method:', ocr.method);
    console.log('OCR confidence:', ocr.confidence);
    console.log('OCR text length:', ocr.text.length);
    if (ocr.text.length > 50) {
      console.log('\n✅ Gemini Vision OCR: WORKING');
    } else {
      console.log('\n❌ Gemini Vision OCR: returned no text');
    }
  } else {
    console.log('\n❌ Extraction failed');
  }

  // Test full pipeline
  console.log('\n--- Full analyzeDocument pipeline ---');
  const { analyzeDocument } = require('../src/services/medicalAnalysis.service');
  const fullResult = await analyzeDocument(buffer, 'application/pdf', 'lab_report');
  console.log('extractionMethod:', fullResult.extractionMethod);
  console.log('extractedText length:', fullResult.extractedText?.length ?? 0);
  console.log('analysis.severity:', fullResult.analysis?.severity ?? 'none');
  console.log('analysis.abnormalFindings:', fullResult.analysis?.abnormalFindings?.length ?? 0);

  if (fullResult.analysis?.severity && fullResult.extractedText?.length > 0) {
    console.log('\n✅ FULL PIPELINE: WORKING\n');
  } else {
    console.log('\n⚠️  Full pipeline partial result\n');
  }

  fs.unlinkSync(pdfPath);
}

run().catch(console.error);
