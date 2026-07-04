// Quick check of middleware and medicalAnalysis service
process.chdir(require('path').join(__dirname, '..'));
const m = require('./src/middleware/upload.middleware');
console.log('uploadFile steps:', m.uploadFile.length, '(should be 3)');

// Test pdf-parse directly with a known PDF
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Create test PDF with actual readable text using a proper PDF structure
async function test() {
  // Use a buffer containing real text via pdf-parse's test fixture
  // First verify pdf-parse loads
  console.log('pdf-parse loaded:', typeof pdfParse === 'function');
  
  // Test medicalAnalysis service loads
  const med = require('./src/services/medicalAnalysis.service');
  console.log('medicalAnalysis exports:', Object.keys(med));
  
  // Test ocr service loads
  const ocr = require('./src/services/ocr.service');
  console.log('ocr exports:', Object.keys(ocr));
  
  // Test pdfParser service
  const pdf = require('./src/services/pdfParser.service');
  console.log('pdfParser exports:', Object.keys(pdf));
  
  console.log('\nAll services load OK.');
}
test().catch(console.error);
