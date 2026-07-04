/**
 * generate_feature_pdf.js
 * Generates a styled PDF of ArogyaAI feature list using PDFKit
 * Run: node generate_feature_pdf.js
 */

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUTPUT = path.join(__dirname, 'ArogyaAI_Feature_List.pdf');

const doc = new PDFDocument({
  size:    'A4',
  margins: { top: 50, bottom: 50, left: 55, right: 55 },
  info: {
    Title:   'ArogyaAI — Feature List',
    Author:  'ArogyaAI',
    Subject: 'Complete feature list for patients and doctors',
  },
});

doc.pipe(fs.createWriteStream(OUTPUT));

/* ── Colours ── */
const C = {
  bg:        '#0f172a',
  primary:   '#0694a2',
  accent:    '#7c3aed',
  white:     '#f8fafc',
  slate:     '#94a3b8',
  slate2:    '#64748b',
  emerald:   '#10b981',
  amber:     '#f59e0b',
  danger:    '#ef4444',
  border:    '#1e293b',
};

/* ════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════ */

function pageWidth()  { return doc.page.width  - doc.page.margins.left - doc.page.margins.right; }

function gradientRect(x, y, w, h, c1, c2) {
  const grad = doc.linearGradient(x, y, x + w, y);
  grad.stop(0, c1).stop(1, c2);
  doc.rect(x, y, w, h).fill(grad);
}

function sectionTitle(text, color = C.primary) {
  doc.moveDown(0.6);
  const y = doc.y;
  const w = pageWidth();
  // Left accent bar
  doc.rect(doc.page.margins.left, y, 4, 22).fill(color);
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold')
     .text(text, doc.page.margins.left + 12, y + 4, { width: w - 12 });
  doc.moveDown(0.5);
}

function featureRow(emoji, label, value, rowIndex) {
  const x = doc.page.margins.left;
  const w = pageWidth();
  const y = doc.y;
  const rowH = 22;

  // Alternating row background
  if (rowIndex % 2 === 0) {
    doc.rect(x, y, w, rowH).fill('#ffffff08');
  }

  doc.fillColor(C.slate).fontSize(10).font('Helvetica')
     .text(`${emoji}  ${label}`, x + 8, y + 5, { width: w * 0.38, continued: false });

  doc.fillColor(C.white).fontSize(9.5).font('Helvetica')
     .text(value, x + w * 0.42, y + 5, { width: w * 0.58 });

  doc.moveDown(0.05);
  if (doc.y < y + rowH) doc.y = y + rowH;
}

function bulletRow(text, index) {
  const x    = doc.page.margins.left;
  const w    = pageWidth();
  const y    = doc.y;
  const rowH = 20;

  if (index % 2 === 0) doc.rect(x, y, w, rowH).fill('#ffffff06');

  // Dot
  doc.circle(x + 14, y + 10, 2.5).fill(C.primary);

  doc.fillColor(C.white).fontSize(9.5).font('Helvetica')
     .text(text, x + 24, y + 4, { width: w - 30 });

  doc.moveDown(0.05);
  if (doc.y < y + rowH) doc.y = y + rowH;
}

function summaryCard(label, value, color) {
  const x  = doc.page.margins.left;
  const w  = pageWidth();
  const y  = doc.y;
  doc.rect(x, y, w, 28).fill('#1e293b');
  doc.rect(x, y, 4, 28).fill(color);
  doc.fillColor(C.slate).fontSize(8).font('Helvetica')
     .text(label.toUpperCase(), x + 14, y + 6, { width: w * 0.55 });
  doc.fillColor(color).fontSize(14).font('Helvetica-Bold')
     .text(value, x + 14, y + 14, { width: w * 0.55 });
  doc.moveDown(0.1);
  if (doc.y < y + 32) doc.y = y + 32;
}

/* ════════════════════════════════════════
   PAGE BACKGROUND
   ════════════════════════════════════════ */
function fillBackground() {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
}

doc.on('pageAdded', fillBackground);
fillBackground();

/* ════════════════════════════════════════
   HEADER BANNER
   ════════════════════════════════════════ */
const bannerH = 100;
gradientRect(0, 0, doc.page.width, bannerH, C.primary, C.accent);

doc.fillColor(C.white).fontSize(28).font('Helvetica-Bold')
   .text('ArogyaAI', doc.page.margins.left, 22, { align: 'left' });

doc.fillColor('#ffffffcc').fontSize(11).font('Helvetica')
   .text('Complete Feature List', doc.page.margins.left, 56, { align: 'left' });

// Stack tag top-right
doc.fillColor('#ffffffaa').fontSize(8.5).font('Helvetica')
   .text('React + Node.js + MongoDB + Google Gemini AI', 0, 38, {
     align: 'right', width: doc.page.width - doc.page.margins.right,
   });

doc.y = bannerH + 20;

/* ════════════════════════════════════════
   PATIENT SECTION
   ════════════════════════════════════════ */
sectionTitle('👤  PATIENT FEATURES', C.primary);

const patientFeatures = [
  // Auth
  ['🔐', 'OTP Email Verification',    'Register → receive 6-digit OTP → verify account'],
  ['🔐', 'Secure Login / Logout',      'JWT access token + httpOnly refresh cookie'],
  ['🔐', 'Forgot / Reset Password',    'Secure reset link sent to email (30 min expiry)'],
  ['🔐', 'Profile Management',         'Name, avatar, blood group, chronic conditions'],

  // AI Chat
  ['🤖', 'AI Health Chat',             'Conversational chat with Google Gemini AI'],
  ['🎙️', 'Voice Input',               'Speak queries — AI responds in text'],
  ['💬', 'Chat History',              'Multiple sessions, full message history'],
  ['🧠', 'Medical AI Analysis',        'AI analyses uploaded health records'],
  ['📋', 'AI Pre-consultation Summary','AI summary generated before appointments'],

  // Appointments
  ['📅', 'Browse Doctors',             'Search doctors by specialization'],
  ['🕐', 'View Available Slots',        'See open time slots for any doctor on any date'],
  ['➕', 'Book Appointment',           'In-person / video / phone consultation'],
  ['❌', 'Cancel Appointment',         'Cancel with reason — doctor notified instantly'],
  ['📜', 'Appointment History',        'View all past and upcoming appointments'],

  // Records
  ['📁', 'Upload Health Records',      'PDF, JPG, PNG documents'],
  ['🔍', 'OCR Text Extraction',        'Extract text from scanned/image documents'],
  ['📄', 'PDF Parsing',               'Parse structured data from PDF reports'],
  ['🧬', 'AI Health Analysis',         'Get AI insights from your health records'],

  // Notifications
  ['🔔', 'Notification Bell',          'Real-time bell with animated unread count badge'],
  ['📬', 'Notification Dropdown',      'Latest 10 notifications with type icons'],
  ['📑', 'Notifications Page',         'Full center with filters (All / Unread / by type)'],
  ['⏰', 'Reminder Banner (1h)',       'Floating amber banner before upcoming appointments'],

  // Emails
  ['📧', 'Welcome Email',             'Sent on successful registration'],
  ['📧', 'OTP Email',                 'Branded 6-digit code for verification'],
  ['📧', 'Password Reset Email',       'Secure link with 30-minute expiry'],
  ['📧', 'Appointment Confirmed Email','Sent when doctor confirms booking'],
  ['📧', 'Cancellation Email',         'Sent if doctor cancels your appointment'],
  ['📧', 'Self-cancel Confirmation',   'Sent when patient cancels their own appointment'],
  ['📧', '24h Reminder Email',         'Sent automatically 24 hours before appointment'],
  ['📧', '1h Reminder Email',          'Sent automatically 1 hour before appointment'],

  // Emergency
  ['🚨', 'Emergency Page',            'Quick-access emergency alerts and contacts'],
];

patientFeatures.forEach(([emoji, label, value], i) => featureRow(emoji, label, value, i));

/* ════════════════════════════════════════
   DOCTOR SECTION
   ════════════════════════════════════════ */
doc.moveDown(1);
sectionTitle('🩺  DOCTOR FEATURES', C.emerald);

const doctorFeatures = [
  ['🔐', 'Doctor Registration',        'Register with specialization, fees, availability'],
  ['⚙️', 'Availability Settings',     'Set start/end time and slot duration'],
  ['💰', 'Consultation Fee',           'Set your consultation fee on profile'],

  ['📅', 'View All Appointments',      'Dashboard with complete appointment list'],
  ['✅', 'Confirm Appointment',        'Approve pending patient bookings'],
  ['🏁', 'Complete Appointment',       'Mark appointment as completed'],
  ['❌', 'Cancel Appointment',         'Cancel with reason — patient notified + email sent'],
  ['📝', 'Add Doctor Notes',           'Attach clinical notes to any appointment'],

  ['🔔', 'Notification Bell',          'Real-time bell with unread badge'],
  ['📅', 'New Booking Alert',          'Instant notification when patient books'],
  ['❌', 'Cancellation Alert',         'Notification when patient cancels'],
  ['⏰', 'Reminder Banner (1h)',       'Floating banner for upcoming appointments'],

  ['📧', 'New Booking Email',          'Styled email with patient name, date, time, reason'],
  ['📧', 'Patient Cancellation Email', 'Email when a patient cancels their booking'],
  ['📧', '24h Reminder Email',         'Auto-sent 24 hours before each appointment'],
  ['📧', '1h Reminder Email',          'Auto-sent 1 hour before each appointment'],
];

doctorFeatures.forEach(([emoji, label, value], i) => featureRow(emoji, label, value, i));

/* ════════════════════════════════════════
   SYSTEM / AUTOMATION
   ════════════════════════════════════════ */
doc.addPage();
fillBackground();
doc.y = 30;

sectionTitle('⚙️  SYSTEM & AUTOMATION', C.accent);

const systemFeatures = [
  'JWT access tokens (short-lived) + httpOnly refresh cookie for silent renewal',
  'Rate limiting: 300 req/15min global · 20 req/15min on auth routes',
  'NoSQL injection prevention (express-mongo-sanitize)',
  'HTTP parameter pollution protection (hpp)',
  'Security headers via Helmet',
  'CORS with whitelist of allowed frontend origins',
  'OTP codes auto-expire from DB after 10 minutes (MongoDB TTL)',
  'Notifications auto-expire from DB after 90 days (MongoDB TTL)',
  'node-cron: 24h reminder job runs every hour (0 * * * *)',
  'node-cron: 1h reminder job runs every 15 minutes (*/15 * * * *)',
  'Duplicate reminder prevention via reminderSent24h / reminderSent1h flags',
  'Cron logs with [CRON] prefix in server console',
  'Google Gemini AI with model fallback chain for reliability',
  'Tesseract.js OCR — extracts text from images and scanned PDFs',
  'pdf-parse — structured data extraction from PDF documents',
  'Winston structured logging (JSON in production, colorized in dev)',
  'Morgan HTTP request logging',
  'Centralized error handling middleware (AppError class)',
  'Input validation on all API routes (express-validator)',
  'Cloudinary integration for file/image storage',
];

systemFeatures.forEach((text, i) => bulletRow(text, i));

/* ════════════════════════════════════════
   EMAIL TEMPLATES TABLE
   ════════════════════════════════════════ */
doc.moveDown(1);
sectionTitle('📧  EMAIL TEMPLATES', C.amber);

const emails = [
  ['Welcome Email',              'Patient',          'On registration'],
  ['OTP Verification',           'Patient',          'On OTP request'],
  ['Password Reset',             'Patient',          'Forgot password'],
  ['Appointment Booked',         'Doctor',           'Patient books an appointment'],
  ['Appointment Confirmed',      'Patient',          'Doctor confirms'],
  ['Appointment Cancelled',      'Patient / Doctor', 'Either party cancels'],
  ['Self-cancel Confirmation',   'Patient',          'Patient cancels their booking'],
  ['24h Reminder',               'Patient + Doctor', 'Auto — 24h before appointment'],
  ['1h Reminder',                'Patient + Doctor', 'Auto — 1h before appointment'],
];

// Header row
const x  = doc.page.margins.left;
const w  = pageWidth();
const y0 = doc.y;
doc.rect(x, y0, w, 22).fill('#1e293b');
doc.fillColor(C.primary).fontSize(9).font('Helvetica-Bold')
   .text('Template',   x + 8, y0 + 6, { width: w * 0.38 });
doc.text('Recipient',  x + w * 0.4, y0 + 6, { width: w * 0.28 });
doc.text('Trigger',    x + w * 0.7,  y0 + 6, { width: w * 0.3 });
doc.y = y0 + 24;

emails.forEach(([tmpl, recip, trigger], i) => {
  const ry = doc.y;
  if (i % 2 === 0) doc.rect(x, ry, w, 20).fill('#ffffff06');
  doc.fillColor(C.white).fontSize(9).font('Helvetica')
     .text(tmpl,    x + 8, ry + 5, { width: w * 0.36 });
  doc.fillColor(C.slate).fontSize(9)
     .text(recip,   x + w * 0.4, ry + 5, { width: w * 0.28 });
  doc.fillColor(C.slate2).fontSize(9)
     .text(trigger, x + w * 0.7,  ry + 5, { width: w * 0.3 });
  doc.y = ry + 22;
});

/* ════════════════════════════════════════
   SUMMARY CARDS
   ════════════════════════════════════════ */
doc.moveDown(1.5);
sectionTitle('📊  PROJECT SUMMARY', C.primary);
doc.moveDown(0.3);

const summaries = [
  ['Patient Features',  '30+', C.primary],
  ['Doctor Features',   '16',  C.emerald],
  ['API Endpoints',     '35+', C.accent],
  ['Email Templates',   '9',   C.amber],
  ['Cron Jobs',         '2',   C.danger],
  ['AI Services',       '4',   C.primary],
];

summaries.forEach(([label, val, color]) => {
  summaryCard(label, val, color);
  doc.moveDown(0.25);
});

/* ════════════════════════════════════════
   FOOTER
   ════════════════════════════════════════ */
const footerY = doc.page.height - 40;
doc.rect(0, footerY - 1, doc.page.width, 1).fill('#1e293b');
doc.fillColor(C.slate2).fontSize(8).font('Helvetica')
   .text('ArogyaAI Healthcare Platform  ·  Confidential Project Document', 0, footerY + 8, {
     align: 'center', width: doc.page.width,
   });

doc.end();

doc.on('finish', () => {
  console.log(`\n✅  PDF generated: ${OUTPUT}\n`);
});
