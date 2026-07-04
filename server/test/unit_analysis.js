/**
 * test/unit_analysis.js
 * Direct unit test for medicalAnalysis service (no HTTP, no server needed)
 * Usage: node test/unit_analysis.js
 */

'use strict';

// Load env
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const medicalSvc = require('../src/services/medicalAnalysis.service');
const pdfParser  = require('../src/services/pdfParser.service');

/* Simulate a text-layer PDF by calling analyzeWithGemini directly with known text */
const SAMPLE_LAB_TEXT = `
PATHOLOGY LABORATORY REPORT
Patient: John Doe    Age: 45 Years    Date: 15-Jan-2025
Doctor: Dr. Priya Sharma    Lab: HealthPath Diagnostics

COMPLETE BLOOD COUNT
Hemoglobin: 8.2 g/dL          Reference: 12.0-17.5 g/dL    RESULT: LOW
WBC: 12500 cells/uL            Reference: 4000-11000         RESULT: HIGH
Platelets: 450000 /uL          Reference: 150000-400000      RESULT: HIGH

BLOOD GLUCOSE
Fasting Glucose: 185 mg/dL    Reference: 70-100 mg/dL       RESULT: HIGH
HbA1c: 8.2%                   Reference: Below 5.7%         RESULT: HIGH

LIPID PROFILE
Total Cholesterol: 285 mg/dL   Reference: Below 200          RESULT: HIGH
LDL: 180 mg/dL                 Reference: Below 100          RESULT: HIGH
HDL: 32 mg/dL                  Reference: Above 40           RESULT: LOW
Triglycerides: 310 mg/dL       Reference: Below 150          RESULT: HIGH

BLOOD PRESSURE: 158/96 mmHg

IMPRESSION: Anemia, uncontrolled diabetes mellitus type 2, dyslipidemia, hypertension
MEDICINES: Metformin 500mg BD, Atorvastatin 40mg OD, Amlodipine 5mg OD
ADVICE: Consult physician immediately. Follow-up in 4 weeks.
`.trim();

async function run() {
  console.log('\n🔬 Unit Test: Medical Analysis Service');
  console.log('='.repeat(42));

  /* Test 1: cleanText */
  const cleaned = pdfParser.cleanText('  hello\r\n\r\n\r\nworld  \n');
  console.log('\n1. cleanText      —', cleaned === 'hello\n\nworld' ? '✅' : '❌', `"${cleaned}"`);

  /* Test 2: Gemini analysis with known text */
  console.log('\n2. Gemini analysis with sample lab text...');
  console.log('   (May take 5-15 seconds)\n');

  try {
    const analysis = await medicalSvc.analyzeWithGemini(SAMPLE_LAB_TEXT, 'lab_report');

    console.log('   Summary:         ', analysis.summary?.slice(0, 80));
    console.log('   Severity:        ', analysis.severity);
    console.log('   Conditions:      ', analysis.detectedConditions?.join(', ') || 'none');
    console.log('   Abnormal count:  ', analysis.abnormalFindings?.length ?? 0);
    console.log('   Medicines:       ', analysis.medicines?.join(', ') || 'none');
    console.log('   Follow-up:       ', analysis.suggestedFollowUp?.slice(0, 60));

    console.log('\n   Extracted Values:');
    const ev = analysis.extractedValues || {};
    Object.entries(ev).forEach(([k, v]) => {
      if (v && v !== 'null') console.log(`     ${k.padEnd(16)}: ${v}`);
    });

    console.log('\n   Abnormal Findings:');
    (analysis.abnormalFindings || []).forEach((f) =>
      console.log(`     [${(f.severity || '?').toUpperCase().padEnd(8)}] ${f.parameter}: ${f.value}`)
    );

    const ok =
      analysis.severity &&
      Array.isArray(analysis.detectedConditions) &&
      Array.isArray(analysis.abnormalFindings) &&
      typeof analysis.summary === 'string';

    console.log('\n   Result:          ', ok ? '✅  All fields present' : '⚠️  Some fields missing');

  } catch (e) {
    console.error('   Result:           ❌ ', e.message);
  }

  /* Test 3: Short text fallback */
  console.log('\n3. Short text fallback...');
  const fallback = await medicalSvc.analyzeWithGemini('hi', 'other');
  console.log('   Fallback summary:', fallback.summary);
  console.log('   Result:          ', fallback.severity === 'normal' ? '✅' : '⚠️');

  console.log('\n============================================');
  console.log('✅ Unit tests complete.\n');
}

run().catch(console.error);
