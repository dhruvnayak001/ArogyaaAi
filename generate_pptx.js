const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();

// ── Theme ──
const BG = "0A0E1A";
const SURFACE = "111827";
const SURFACE2 = "1E293B";
const TEXT = "F1F5F9";
const MUTED = "94A3B8";
const DIM = "64748B";
const PRIMARY = "0694A2";
const PRIMARY_L = "14B8A6";
const ACCENT = "7C3AED";
const ACCENT_L = "A78BFA";
const DANGER = "EF4444";
const WARNING = "F59E0B";
const SUCCESS = "10B981";

pptx.author = "ArogyaAI Team";
pptx.title = "ArogyaAI — Hackathon Presentation";
pptx.subject = "AI-Powered Healthcare Platform";
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

// ── Helper ──
function addTag(slide, text, color, x, y) {
  slide.addText(text, {
    x, y, w: 2.8, h: 0.3,
    fontSize: 9, fontFace: "Calibri",
    color: color, bold: true,
    align: "center",
    shape: pptx.ShapeType.roundRect,
    rectRadius: 0.15,
    fill: { color: color, transparency: 88 },
    line: { color: color, width: 1 },
  });
}

function addNote(slide, text) {
  slide.addNotes(text);
}

// ════════════════════════════════════════
// SLIDE 1: TITLE
// ════════════════════════════════════════
let s1 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s1.background = { color: BG };
addTag(s1, "AI-POWERED HEALTHCARE PLATFORM", PRIMARY, 4.2, 1.6);
s1.addText("ArogyaAI", {
  x: 0.5, y: 2.2, w: 12.3, h: 1.3,
  fontSize: 60, fontFace: "Calibri", bold: true,
  color: PRIMARY_L, align: "center",
});
s1.addText("From patient symptoms to doctor-ready clinical briefs —\nin any language, before the consultation begins.", {
  x: 2.5, y: 3.6, w: 8.3, h: 0.9,
  fontSize: 16, fontFace: "Calibri",
  color: MUTED, align: "center", lineSpacingMultiple: 1.4,
});
s1.addText("Team Name  •  Hackathon 2026", {
  x: 3.5, y: 5.0, w: 6.3, h: 0.4,
  fontSize: 11, fontFace: "Calibri",
  color: DIM, align: "center",
});
addNote(s1, "Say the name clearly. Pause. Deliver the subtitle. 10 seconds — set the tone that this is a serious healthcare project.");

// ════════════════════════════════════════
// SLIDE 2: THE PROBLEM — Ramesh's Story
// ════════════════════════════════════════
let s2 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s2.background = { color: BG };
addTag(s2, "THE PROBLEM", DANGER, 0.5, 0.4);
s2.addText("Meet Ramesh", {
  x: 0.5, y: 0.85, w: 7, h: 0.7,
  fontSize: 32, fontFace: "Calibri", bold: true, color: TEXT,
});

// Story card
s2.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.7, w: 7.5, h: 1.6,
  rectRadius: 0.15,
  fill: { color: SURFACE },
  line: { color: DANGER, width: 1, transparency: 70 },
});
s2.addText([
  { text: '"Ramesh is 58. He carried a folder of lab reports to a government hospital.\nHe waited ', options: { color: TEXT, italic: true, fontSize: 13 } },
  { text: '3 hours', options: { color: DANGER, bold: true, italic: true, fontSize: 13 } },
  { text: '. His consultation lasted ', options: { color: TEXT, italic: true, fontSize: 13 } },
  { text: '90 seconds', options: { color: DANGER, bold: true, italic: true, fontSize: 13 } },
  { text: '.\nThe doctor never opened his folder. Ramesh has undiagnosed diabetes."', options: { color: TEXT, italic: true, fontSize: 13 } },
], {
  x: 0.75, y: 1.85, w: 7, h: 1.2,
  lineSpacingMultiple: 1.5,
});
s2.addText("This isn't rare. This is the norm.", {
  x: 0.75, y: 3.0, w: 7, h: 0.3,
  fontSize: 11, color: DIM, italic: true,
});

// Bullet points
const problems = [
  ["⏱️", "Under 2 minutes — average consultation time in India [Irving et al., BMJ Open 2017]"],
  ["📄", "Paper reports ignored — doctors have no time to read unstructured documents"],
  ["🗣️", "Language barrier — most Indians don't speak English, yet health AI is English-only"],
];
problems.forEach((p, i) => {
  s2.addText(p[0], { x: 0.5, y: 3.6 + i * 0.55, w: 0.5, h: 0.4, fontSize: 16 });
  s2.addText(p[1], { x: 1.1, y: 3.6 + i * 0.55, w: 6.9, h: 0.4, fontSize: 11, color: MUTED, fontFace: "Calibri" });
});

// Stat boxes
const stats = [
  ["1:1,457", "Doctor-patient ratio\nWHO recommends 1:1,000"],
  ["~63%", "Out-of-pocket\nhealth spending"],
  ["22", "Official languages\nHealth AI speaks 1"],
];
stats.forEach((st, i) => {
  const sx = 8.5;
  const sy = 1.7 + i * 1.8;
  s2.addShape(pptx.ShapeType.roundRect, {
    x: sx, y: sy, w: 4.2, h: 1.5,
    rectRadius: 0.15, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 },
  });
  s2.addText(st[0], { x: sx, y: sy + 0.15, w: 4.2, h: 0.6, fontSize: 30, bold: true, color: PRIMARY_L, align: "center", fontFace: "Calibri" });
  s2.addText(st[1], { x: sx, y: sy + 0.8, w: 4.2, h: 0.55, fontSize: 10, color: MUTED, align: "center", fontFace: "Calibri", lineSpacingMultiple: 1.3 });
});
addNote(s2, "Tell Ramesh's story. Don't read bullets — narrate. Pause. Let it land. Then move forward.");

// ════════════════════════════════════════
// SLIDE 3: OUR SOLUTION
// ════════════════════════════════════════
let s3 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s3.background = { color: BG };
addTag(s3, "OUR SOLUTION", PRIMARY, 0.5, 0.4);
s3.addText("ArogyaAI — Making Every 2 Minutes Count", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});
s3.addText("An end-to-end AI platform that speaks the patient's language, understands their documents, and prepares the doctor — before the consultation begins.", {
  x: 0.5, y: 1.6, w: 12.3, h: 0.5,
  fontSize: 14, fontFace: "Calibri", color: MUTED, lineSpacingMultiple: 1.4,
});

const pillars = [
  ["🗣️", "Speak Your Language", "Voice input in Hindi, Marathi, English — even mixed Hinglish"],
  ["🧠", "AI Understands Reports", "Lab values extracted with AI reliability indicators you can verify"],
  ["👨‍⚕️", "Doctor Gets a Brief", "Structured clinical copilot with urgency, conditions, and focus areas"],
];
pillars.forEach((p, i) => {
  const px = 0.5 + i * 4.2;
  s3.addShape(pptx.ShapeType.roundRect, {
    x: px, y: 2.4, w: 3.9, h: 2.6,
    rectRadius: 0.15, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 },
  });
  s3.addText(p[0], { x: px, y: 2.6, w: 3.9, h: 0.6, fontSize: 30, align: "center" });
  s3.addText(p[1], { x: px + 0.3, y: 3.3, w: 3.3, h: 0.4, fontSize: 14, bold: true, color: TEXT, align: "center", fontFace: "Calibri" });
  s3.addText(p[2], { x: px + 0.3, y: 3.8, w: 3.3, h: 0.7, fontSize: 11, color: MUTED, align: "center", fontFace: "Calibri", lineSpacingMultiple: 1.4 });
});

// Key insight
s3.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 5.3, w: 12.3, h: 0.7,
  rectRadius: 0.12, fill: { color: PRIMARY, transparency: 88 }, line: { color: PRIMARY, width: 1, transparency: 70 },
});
s3.addText("💡 Key: These aren't separate apps. It's one integrated pipeline — symptoms → documents → booking → AI copilot brief → doctor.", {
  x: 0.7, y: 5.3, w: 11.9, h: 0.7,
  fontSize: 12, color: PRIMARY_L, align: "center", fontFace: "Calibri",
});
addNote(s3, "Transition: 'What if Ramesh could describe his symptoms in Hindi? What if the AI could read his lab report AND tell the doctor what's wrong — before Ramesh walks in?'");

// ════════════════════════════════════════
// SLIDE 4: PATIENT JOURNEY
// ════════════════════════════════════════
let s4 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s4.background = { color: BG };
addTag(s4, "HOW IT WORKS", PRIMARY, 0.5, 0.4);
s4.addText("The Patient Journey — End to End", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});

const journey = [
  ["🗣️", "Describe\nSymptoms", "Voice or text\nHindi / Marathi / EN"],
  ["📄", "Upload\nReports", "PDF / image\nLab reports"],
  ["🤖", "AI\nAnalyzes", "OCR + Gemini\nQuality indicators"],
  ["✅", "Patient\nVerifies", "Review & correct\nHuman-in-the-loop"],
  ["👨‍⚕️", "Doctor Gets\nBrief", "AI Copilot output\nUrgency + conditions"],
];
journey.forEach((j, i) => {
  const jx = 0.5 + i * 2.5;
  s4.addShape(pptx.ShapeType.roundRect, {
    x: jx, y: 1.9, w: 2.2, h: 2.8,
    rectRadius: 0.12, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 },
  });
  s4.addText(j[0], { x: jx, y: 2.1, w: 2.2, h: 0.5, fontSize: 24, align: "center" });
  s4.addText(j[1], { x: jx + 0.15, y: 2.7, w: 1.9, h: 0.6, fontSize: 11, bold: true, color: TEXT, align: "center", fontFace: "Calibri", lineSpacingMultiple: 1.2 });
  s4.addText(j[2], { x: jx + 0.15, y: 3.4, w: 1.9, h: 0.8, fontSize: 9, color: DIM, align: "center", fontFace: "Calibri", lineSpacingMultiple: 1.3 });
  // Arrow
  if (i < 4) {
    s4.addText("→", { x: jx + 2.05, y: 2.8, w: 0.5, h: 0.5, fontSize: 18, color: PRIMARY, bold: true, align: "center" });
  }
});

// Screenshot placeholders
s4.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 5.2, w: 6, h: 1.8, rectRadius: 0.12, fill: { color: SURFACE2 }, line: { color: DIM, width: 1, dashType: "dash" } });
s4.addText("📱 Screenshot: Patient Dashboard\nCapture from /dashboard", { x: 0.5, y: 5.5, w: 6, h: 1, fontSize: 11, color: DIM, align: "center", fontFace: "Calibri" });
s4.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 5.2, w: 6, h: 1.8, rectRadius: 0.12, fill: { color: SURFACE2 }, line: { color: DIM, width: 1, dashType: "dash" } });
s4.addText("👨‍⚕️ Screenshot: Doctor Dashboard\nCapture from /doctor/dashboard", { x: 6.8, y: 5.5, w: 6, h: 1, fontSize: 11, color: DIM, align: "center", fontFace: "Calibri" });
addNote(s4, "Walk through each step. Emphasize that every stage feeds the next. Key line: 'The doctor never starts a consultation cold.'");

// ════════════════════════════════════════
// SLIDE 5: AI PRE-CONSULTATION COPILOT ⭐
// ════════════════════════════════════════
let s5 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s5.background = { color: BG };
addTag(s5, "⭐ KEY INNOVATION #1", ACCENT, 0.5, 0.4);
s5.addText("AI Pre-Consultation Copilot", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});
s5.addText("Before the appointment, AI synthesizes symptoms + reports into a structured clinical brief the doctor reviews before the patient walks in.", {
  x: 0.5, y: 1.55, w: 6, h: 0.5,
  fontSize: 12, fontFace: "Calibri", color: MUTED, lineSpacingMultiple: 1.4,
});

const features5 = [
  "🗣️  Accepts symptoms in Hindi, Marathi, English",
  "📊  Correlates with uploaded report data",
  "🚨  Assigns urgency: LOW → CRITICAL",
  "🎯  Suggests focus areas + recommended specialty",
  "🔬  Flags abnormal lab values with normal ranges",
  "📈  Analysis reliability indicator (HIGH / MEDIUM / LOW)",
];
features5.forEach((f, i) => {
  s5.addText(f, { x: 0.5, y: 2.2 + i * 0.4, w: 6, h: 0.35, fontSize: 11, color: MUTED, fontFace: "Calibri" });
});
s5.addText("⚠️ Advisory output only — not a clinical diagnosis. Always reviewed by the consulting physician.", {
  x: 0.5, y: 4.7, w: 6, h: 0.35, fontSize: 9, color: DIM, fontFace: "Calibri",
});

// JSON block
s5.addShape(pptx.ShapeType.roundRect, {
  x: 6.8, y: 1.55, w: 5.9, h: 5.0,
  rectRadius: 0.12, fill: { color: "0D1117" }, line: { color: SURFACE2, width: 1 },
});
const jsonText = `{
  "summaryText": "Patient reports fever and
    headache for 3 days. Lab reports
    indicate low hemoglobin.",
  "symptoms": ["fever", "headache", "fatigue"],
  "symptomTimeline": "3 days",

  "urgencyLevel": "MEDIUM",
  "conditions": ["Anemia", "Viral fever"],

  "suggestedFocusAreas": [
    "Complete blood count",
    "Iron studies"
  ],
  "abnormalValues": [{
    "parameter": "Hemoglobin",
    "value": "8.2 g/dL",
    "normalRange": "12.0–17.5 g/dL"
  }],
  "analysisReliability": "HIGH",
  "recommendedSpecialty": "General Physician"
}`;
s5.addText(jsonText, {
  x: 7.0, y: 1.7, w: 5.5, h: 4.7,
  fontSize: 9.5, fontFace: "Consolas", color: "C9D1D9",
  lineSpacingMultiple: 1.25, valign: "top",
});
addNote(s5, "THIS IS YOUR STAR SLIDE. Spend 60+ seconds here. Point to the JSON. Read key fields aloud. Pause. Then: 'No consumer health app does this today.'");

// ════════════════════════════════════════
// SLIDE 6: MEDICAL DOCUMENT INTELLIGENCE ⭐
// ════════════════════════════════════════
let s6 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s6.background = { color: BG };
addTag(s6, "⭐ KEY INNOVATION #2", ACCENT, 0.5, 0.4);
s6.addText("Medical Document Intelligence", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});

// Pipeline
const docPipe = [
  ["📄", "Upload", "PDF / Image"],
  ["📝", "Extract", "pdf-parse →\nGemini Vision"],
  ["🧠", "AI Analysis", "Structured JSON +\nquality indicators"],
  ["✅", "Verify", "🟢🟡🔴 cues\nEdit & correct"],
  ["👨‍⚕️", "Doctor Summary", "Auto-generated\nclinical summary"],
];
docPipe.forEach((d, i) => {
  const dx = 0.5 + i * 2.5;
  s6.addShape(pptx.ShapeType.roundRect, {
    x: dx, y: 1.8, w: 2.2, h: 1.8,
    rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 },
  });
  s6.addText(d[0], { x: dx, y: 1.9, w: 2.2, h: 0.4, fontSize: 20, align: "center" });
  s6.addText(d[1], { x: dx + 0.1, y: 2.3, w: 2, h: 0.3, fontSize: 10, bold: true, color: TEXT, align: "center", fontFace: "Calibri" });
  s6.addText(d[2], { x: dx + 0.1, y: 2.65, w: 2, h: 0.6, fontSize: 8, color: DIM, align: "center", fontFace: "Calibri", lineSpacingMultiple: 1.2 });
  if (i < 4) s6.addText("→", { x: dx + 2.05, y: 2.3, w: 0.5, h: 0.4, fontSize: 16, color: PRIMARY, bold: true, align: "center" });
});

// Confidence cards
const confCards = [
  ["🟢 HIGH", "AI Self-Assessment", "Score ≥ 0.8 — AI reports high extraction certainty", PRIMARY_L],
  ["🟡 MEDIUM", "Verify Recommended", "Score 0.5–0.8 — patient should double-check this value", WARNING],
  ["🔴 LOW", "Manual Check Needed", "Score < 0.5 — patient should enter correct value", DANGER],
];
confCards.forEach((c, i) => {
  const cx = 0.5 + i * 4.2;
  s6.addShape(pptx.ShapeType.roundRect, { x: cx, y: 4.0, w: 3.9, h: 1.3, rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
  s6.addText(c[0] + " — " + c[1], { x: cx + 0.2, y: 4.1, w: 3.5, h: 0.4, fontSize: 11, bold: true, color: c[3], fontFace: "Calibri" });
  s6.addText(c[2], { x: cx + 0.2, y: 4.5, w: 3.5, h: 0.5, fontSize: 9, color: MUTED, fontFace: "Calibri", lineSpacingMultiple: 1.3 });
});

// Honest note
s6.addText("Honest note: These indicators are AI-generated, not clinically validated. They serve as attention signals — helping patients identify which values to double-check. Patient corrections are tracked for future model improvement.", {
  x: 0.5, y: 5.6, w: 12.3, h: 0.6,
  fontSize: 9, color: DIM, fontFace: "Calibri", lineSpacingMultiple: 1.4,
});

// Screenshot placeholder
s6.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 6.4, w: 12.3, h: 0.8, rectRadius: 0.1, fill: { color: SURFACE2 }, line: { color: DIM, width: 1, dashType: "dash" } });
s6.addText("📸 Screenshot: MedicalVerificationModal with green/amber/red indicators", { x: 0.5, y: 6.5, w: 12.3, h: 0.5, fontSize: 10, color: DIM, align: "center", fontFace: "Calibri" });
addNote(s6, "Walk through the pipeline. Say 'AI self-assessment indicators' NOT 'confidence scores.' Green = confident, Amber = double-check, Red = verify manually. Do NOT say RLHF.");

// ════════════════════════════════════════
// SLIDE 7: MULTILINGUAL VOICE INPUT ⭐
// ════════════════════════════════════════
let s7 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s7.background = { color: BG };
addTag(s7, "⭐ KEY INNOVATION #3", ACCENT, 0.5, 0.4);
s7.addText("Multilingual Voice-First Input", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});
s7.addText("Patients describe symptoms by speaking naturally — in their own language.", {
  x: 0.5, y: 1.55, w: 6.5, h: 0.4,
  fontSize: 13, fontFace: "Calibri", color: MUTED,
});

// Language tags
["🇬🇧 English", "🇮🇳 हिंदी", "🇮🇳 मराठी"].forEach((lang, i) => {
  addTag(s7, lang, [PRIMARY, ACCENT, SUCCESS][i], 0.5 + i * 1.8, 2.1);
});

// Features
const voiceFeats = [
  "🎤  Real-time live transcription (browser-native speech recognition)",
  "🔄  AI mirrors input language in responses",
  "⚠️  Urgency keywords (chest pain, breathlessness) trigger instant alerts",
  "🏷️  Quick-pick symptom tags for common conditions",
  "🌐  Hinglish (mixed Hindi-English) handled naturally",
];
voiceFeats.forEach((f, i) => {
  s7.addText(f, { x: 0.5, y: 2.7 + i * 0.42, w: 6.5, h: 0.35, fontSize: 11, color: MUTED, fontFace: "Calibri" });
});

// Demo card
s7.addShape(pptx.ShapeType.roundRect, {
  x: 7.5, y: 1.8, w: 5.3, h: 5.0,
  rectRadius: 0.15, fill: { color: SURFACE }, line: { color: PRIMARY, width: 1, transparency: 70 },
});
s7.addText("🎤", { x: 7.5, y: 2.0, w: 5.3, h: 0.7, fontSize: 36, align: "center" });

// Hindi text
s7.addShape(pptx.ShapeType.roundRect, { x: 7.8, y: 2.9, w: 4.7, h: 1.1, rectRadius: 0.1, fill: { color: "0D1117" } });
s7.addText("Voice Input (Hindi):", { x: 7.95, y: 2.95, w: 4.4, h: 0.25, fontSize: 9, color: DIM, fontFace: "Calibri" });
s7.addText('"मुझे 3 दिन से बुखार और सिरदर्द है,\nऔर सीने में दर्द हो रहा है"', {
  x: 7.95, y: 3.2, w: 4.4, h: 0.7, fontSize: 12, color: TEXT, fontFace: "Calibri", lineSpacingMultiple: 1.3,
});

// Urgency alert
s7.addShape(pptx.ShapeType.roundRect, { x: 7.8, y: 4.2, w: 4.7, h: 0.5, rectRadius: 0.08, fill: { color: DANGER, transparency: 85 }, line: { color: DANGER, width: 1, transparency: 60 } });
s7.addText("⚠️ Urgent symptom detected: chest pain — call 112", { x: 7.95, y: 4.25, w: 4.4, h: 0.4, fontSize: 10, color: DANGER, fontFace: "Calibri" });

// Normalized
s7.addShape(pptx.ShapeType.roundRect, { x: 7.8, y: 4.9, w: 4.7, h: 0.7, rectRadius: 0.1, fill: { color: "0D1117" } });
s7.addText("AI normalizes for doctor's brief:", { x: 7.95, y: 4.95, w: 4.4, h: 0.2, fontSize: 9, color: DIM, fontFace: "Calibri" });
s7.addText("→ fever, headache, chest pain (3-day duration)", { x: 7.95, y: 5.2, w: 4.4, h: 0.3, fontSize: 11, color: PRIMARY_L, fontFace: "Calibri" });
addNote(s7, "Demo moment. Speak in Hindi live if mic works. If not, point to the card. The Hindi → urgency detection → clinical English normalization is visceral.");

// ════════════════════════════════════════
// SLIDE 8: DOCTOR'S AI COMMAND CENTER
// ════════════════════════════════════════
let s8 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s8.background = { color: BG };
addTag(s8, "THE DOCTOR'S VIEW", PRIMARY, 0.5, 0.4);
s8.addText("AI-Powered Patient 360°", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});
s8.addText("When the doctor opens a patient profile, they see an AI Command Center — not a blank chart.", {
  x: 0.5, y: 1.55, w: 12.3, h: 0.4,
  fontSize: 13, fontFace: "Calibri", color: MUTED,
});

const docFeatures = [
  ["🧠", "AI Patient Snapshot", "Risk badge (LOW→CRITICAL), current symptoms, conditions, allergies — one hero view"],
  ["🎯", "Consultation Prep Panel", "AI-suggested focus areas, new symptoms since last visit, recent abnormal findings"],
  ["📈", "Health Trends", "Biomarker trend charts (hemoglobin, glucose, cholesterol) with SVG line charts"],
  ["📋", "Health Timeline", "Chronological patient history — appointments, reports, risk levels"],
  ["📄", "Reports Viewer", "View PDFs and images inline. See AI analysis severity and extraction data."],
  ["🚨", "Emergency Triage", "4-level AI severity classification (CRITICAL/HIGH/MODERATE/LOW) and 112 quick-dial"],
];
docFeatures.forEach((df, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const fx = 0.5 + col * 6.4;
  const fy = 2.2 + row * 1.35;
  s8.addShape(pptx.ShapeType.roundRect, { x: fx, y: fy, w: 6.1, h: 1.15, rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
  s8.addText(df[0], { x: fx + 0.15, y: fy + 0.15, w: 0.5, h: 0.5, fontSize: 20 });
  s8.addText(df[1], { x: fx + 0.7, y: fy + 0.1, w: 5.2, h: 0.35, fontSize: 12, bold: true, color: TEXT, fontFace: "Calibri" });
  s8.addText(df[2], { x: fx + 0.7, y: fy + 0.5, w: 5.2, h: 0.5, fontSize: 9, color: DIM, fontFace: "Calibri", lineSpacingMultiple: 1.3 });
});

// Screenshot placeholder
s8.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 6.3, w: 12.3, h: 0.9, rectRadius: 0.1, fill: { color: SURFACE2 }, line: { color: DIM, width: 1, dashType: "dash" } });
s8.addText("📸 Screenshot: PatientView360 — AI Snapshot Hero with risk badge, symptoms, conditions", { x: 0.5, y: 6.4, w: 12.3, h: 0.6, fontSize: 10, color: DIM, align: "center", fontFace: "Calibri" });
addNote(s8, "Show the doctor's side. 'This closes the loop — patient speaks, AI analyzes, doctor sees everything BEFORE the patient walks in.'");

// ════════════════════════════════════════
// SLIDE 9: UNDER THE HOOD
// ════════════════════════════════════════
let s9 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s9.background = { color: BG };
addTag(s9, "UNDER THE HOOD", PRIMARY, 0.5, 0.4);
s9.addText("Technical Foundation", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});

const techCols = [
  ["Frontend", "61DAFB", "React 18 + Vite\nTailwind CSS + Framer Motion\nZustand state management\nBrowser-native voice API\nLazy-loaded routes"],
  ["Backend", SUCCESS, "Node.js + Express.js\nModular service layer\nJWT + OTP authentication\nCron-based reminders\nRole-based access"],
  ["AI & Data", ACCENT_L, "Google Gemini API\n4-model fallback chain\nMongoDB Atlas\nCloudinary CDN\nNodemailer"],
];
techCols.forEach((tc, i) => {
  const tx = 0.5 + i * 4.2;
  s9.addShape(pptx.ShapeType.roundRect, { x: tx, y: 1.8, w: 3.9, h: 3.2, rectRadius: 0.12, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
  s9.addShape(pptx.ShapeType.rect, { x: tx, y: 1.8, w: 3.9, h: 0.05, fill: { color: tc[1] } });
  s9.addText(tc[0], { x: tx + 0.25, y: 2.0, w: 3.4, h: 0.35, fontSize: 13, bold: true, color: tc[1], fontFace: "Calibri" });
  s9.addText(tc[2], { x: tx + 0.25, y: 2.4, w: 3.4, h: 2.2, fontSize: 10, color: MUTED, fontFace: "Calibri", lineSpacingMultiple: 1.5, valign: "top" });
});

// Resilience & Security
s9.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 5.3, w: 6.1, h: 1.6, rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
s9.addText("🔄 AI Resilience", { x: 0.7, y: 5.4, w: 5.7, h: 0.3, fontSize: 11, bold: true, color: PRIMARY_L, fontFace: "Calibri" });
s9.addText("4-tier model fallback: gemini-flash-latest → 2.0-flash-lite → 2.0-flash → 2.5-flash. Daily quota exhaustion cached. Safety blocks throw immediately.", {
  x: 0.7, y: 5.75, w: 5.7, h: 0.9, fontSize: 9, color: MUTED, fontFace: "Calibri", lineSpacingMultiple: 1.4,
});

s9.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 5.3, w: 6.1, h: 1.6, rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
s9.addText("🛡️ Security", { x: 7.0, y: 5.4, w: 5.7, h: 0.3, fontSize: 11, bold: true, color: SUCCESS, fontFace: "Calibri" });
s9.addText("Helmet.js headers, MongoDB injection sanitization, CORS whitelist, role-based rate limiting (auth: 20/15min, AI: 20/15min, uploads: 10/15min), medical disclaimers.", {
  x: 7.0, y: 5.75, w: 5.7, h: 0.9, fontSize: 9, color: MUTED, fontFace: "Calibri", lineSpacingMultiple: 1.4,
});
addNote(s9, "25 seconds max. Quick trust-building slide. Don't linger on npm packages. Say 'deployment-ready architecture' not 'production-grade.'");

// ════════════════════════════════════════
// SLIDE 10: COMPETITIVE LANDSCAPE
// ════════════════════════════════════════
let s10 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s10.background = { color: BG };
addTag(s10, "MARKET POSITION", PRIMARY, 0.5, 0.4);
s10.addText("Competitive Landscape", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});

const compRows = [
  ["AI Capability", "Practo", "Ada Health", "Nuance DAX", "ArogyaAI"],
  ["Appointment Booking", "✅", "—", "—", "✅"],
  ["AI Symptom Chat", "—", "✅", "—", "✅"],
  ["Medical Document AI", "—", "—", "—", "✅"],
  ["AI Quality Indicators", "—", "—", "—", "✅"],
  ["Human-in-the-Loop", "—", "—", "—", "✅"],
  ["Pre-Consultation Copilot", "—", "—", "Post-visit", "✅"],
  ["Multilingual Voice", "—", "—", "EN only", "✅"],
  ["AI Emergency Triage", "—", "✅", "—", "✅"],
  ["Total AI Features", "1/8", "2/8", "1/8", "8/8"],
];

const colW = [3.5, 1.8, 1.8, 1.8, 1.8];
compRows.forEach((row, ri) => {
  const ry = 1.8 + ri * 0.42;
  const isHeader = ri === 0;
  const isTotal = ri === compRows.length - 1;
  const bgColor = isHeader ? SURFACE2 : isTotal ? PRIMARY : SURFACE;
  const bgTransp = isTotal ? 88 : (ri % 2 === 0 && !isHeader) ? 0 : 10;

  row.forEach((cell, ci) => {
    const cx = 0.5 + colW.slice(0, ci).reduce((a, b) => a + b, 0);
    let cellColor = isHeader ? TEXT : ci === 4 ? (cell === "✅" ? SUCCESS : PRIMARY_L) : (cell === "✅" ? SUCCESS : cell === "—" ? DIM : MUTED);
    if (isTotal && ci === 4) cellColor = PRIMARY_L;
    s10.addText(cell, {
      x: cx, y: ry, w: colW[ci], h: 0.38,
      fontSize: isHeader ? 9 : 10,
      fontFace: "Calibri",
      bold: isHeader || isTotal || (ci === 4 && cell === "✅"),
      color: cellColor,
      fill: { color: bgColor, transparency: isHeader ? 0 : bgTransp },
      border: [{ type: "solid", pt: 0.5, color: SURFACE2 }],
      align: ci === 0 ? "left" : "center",
      valign: "middle",
    });
  });
});

// Honest note
s10.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 6.2, w: 12.3, h: 0.7,
  rectRadius: 0.1, fill: { color: WARNING, transparency: 92 }, line: { color: WARNING, width: 1, transparency: 70 },
});
s10.addText("⚡ Honest note: This comparison focuses on AI capabilities. Practo has millions of users, real payments, and verified doctors — operational capabilities we haven't built yet. Our advantage is in AI intelligence, not operational scale.", {
  x: 0.7, y: 6.25, w: 11.9, h: 0.6,
  fontSize: 9, color: WARNING, fontFace: "Calibri", lineSpacingMultiple: 1.4,
});
addNote(s10, "Be honest about Practo's advantages. This honesty INCREASES your score with judges who know the market.");

// ════════════════════════════════════════
// SLIDE 11: IMPACT + WHY WE CAN WIN
// ════════════════════════════════════════
let s11 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s11.background = { color: BG };
addTag(s11, "IMPACT & POSITIONING", SUCCESS, 0.5, 0.4);
s11.addText("Who Benefits — And Why We Can Win", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});

// 3 columns: Patients, Doctors, Responsible AI
const impactCols = [
  {
    title: "👤 For Patients", color: PRIMARY, items: [
      "🗣️  Accessibility: Speak symptoms in your language",
      "📊  Transparency: See AI extractions, correct mistakes",
      "📁  Continuity: Health records organized",
      "🚨  Safety: Emergency triage when seconds matter",
    ]
  },
  {
    title: "👨‍⚕️ For Doctors", color: ACCENT, items: [
      "📋  Pre-read Brief: AI copilot before consultation",
      "⏱️  Time Efficiency: 1 min saved × 40+ patients",
      "🔬  Structured Data: Abnormal values flagged",
      "📱  Automation: Cron reminders reduce no-shows",
    ]
  },
  {
    title: "🛡️ Responsible AI", color: WARNING, items: [
      "⚕️  Advisory only — not a diagnosis",
      "✅  Human verification for extracted data",
      "👨‍⚕️  Doctors remain final decision makers",
      "⚠️  Medical disclaimers on every AI output",
    ]
  },
];
impactCols.forEach((col, i) => {
  const ix = 0.5 + i * 4.2;
  s11.addShape(pptx.ShapeType.roundRect, { x: ix, y: 1.8, w: 3.9, h: 3.3, rectRadius: 0.12, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
  s11.addShape(pptx.ShapeType.rect, { x: ix, y: 1.8, w: 3.9, h: 0.04, fill: { color: col.color } });
  s11.addText(col.title, { x: ix + 0.2, y: 1.95, w: 3.5, h: 0.35, fontSize: 13, bold: true, color: TEXT, fontFace: "Calibri" });
  col.items.forEach((item, j) => {
    s11.addText(item, { x: ix + 0.2, y: 2.4 + j * 0.55, w: 3.5, h: 0.45, fontSize: 9.5, color: MUTED, fontFace: "Calibri", lineSpacingMultiple: 1.3 });
  });
});

// Why we can win bar
const winPoints = [
  ["✅ Working Prototype", "Running code, not slides"],
  ["🧠 5 AI Capabilities", "Chat, OCR, copilot, triage, summary"],
  ["🌐 3 Languages", "Hindi, Marathi, English"],
  ["⚙️ Deployment-Ready", "Fallback chain, auth, rate limiting"],
  ["❤️ 1.4B People", "Solving a real problem at scale"],
];
s11.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 5.4, w: 12.3, h: 1.4,
  rectRadius: 0.12, fill: { color: PRIMARY, transparency: 88 }, line: { color: PRIMARY, width: 1, transparency: 70 },
});
winPoints.forEach((wp, i) => {
  const wx = 0.7 + i * 2.4;
  s11.addText(wp[0], { x: wx, y: 5.5, w: 2.2, h: 0.35, fontSize: 10, bold: true, color: PRIMARY_L, align: "center", fontFace: "Calibri" });
  s11.addText(wp[1], { x: wx, y: 5.85, w: 2.2, h: 0.4, fontSize: 8, color: DIM, align: "center", fontFace: "Calibri", lineSpacingMultiple: 1.2 });
});
addNote(s11, "Three sections: Patients, Doctors, Responsible AI. Then the 5 reasons. Deliver with conviction.");

// ════════════════════════════════════════
// SLIDE 12: FUTURE SCOPE & VALIDATION ROADMAP
// ════════════════════════════════════════
let s12 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s12.background = { color: BG };
addTag(s12, "VISION", ACCENT, 0.5, 0.4);
s12.addText("Future Scope & Validation Roadmap", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.7,
  fontSize: 28, fontFace: "Calibri", bold: true, color: TEXT,
});

// Left: Phased Development
s12.addText("Future Development Phases", { x: 0.5, y: 1.7, w: 6.1, h: 0.35, fontSize: 13, bold: true, color: ACCENT_L, fontFace: "Calibri" });

const phases = [
  { label: "PHASE 1", color: PRIMARY, text: "Verified doctor onboarding · Razorpay payments · Video consultations" },
  { label: "PHASE 2", color: ACCENT, text: "ABDM / ABHA integration · Digital prescriptions · Unified health records" },
  { label: "PHASE 3", color: WARNING, text: "Chronic disease prediction · Longitudinal monitoring · AI visit summaries" },
  { label: "PHASE 4", color: SUCCESS, text: "Android & iOS apps · Tamil, Telugu, Bengali, Kannada" },
  { label: "PHASE 5", color: DANGER, text: "Wearable integrations · Remote patient monitoring" },
];
phases.forEach((ph, i) => {
  const py = 2.2 + i * 0.95;
  s12.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: py, w: 6.1, h: 0.8, rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
  s12.addShape(pptx.ShapeType.rect, { x: 0.5, y: py, w: 0.06, h: 0.8, fill: { color: ph.color } });
  s12.addText(ph.label, { x: 0.7, y: py + 0.08, w: 1.2, h: 0.25, fontSize: 8, bold: true, color: ph.color, fontFace: "Calibri", fill: { color: ph.color, transparency: 85 } });
  s12.addText("NOT YET IMPLEMENTED", { x: 2.0, y: py + 0.08, w: 1.8, h: 0.25, fontSize: 7, color: DIM, fontFace: "Calibri" });
  s12.addText(ph.text, { x: 0.7, y: py + 0.4, w: 5.7, h: 0.35, fontSize: 10, color: MUTED, fontFace: "Calibri" });
});

// Right: Validation Roadmap
s12.addText("Validation & Ethics Roadmap", { x: 6.8, y: 1.7, w: 6.1, h: 0.35, fontSize: 13, bold: true, color: WARNING, fontFace: "Calibri" });
s12.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 2.2, w: 6.1, h: 3.7, rectRadius: 0.12, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
s12.addShape(pptx.ShapeType.rect, { x: 6.8, y: 2.2, w: 6.1, h: 0.04, fill: { color: WARNING } });

const validation = [
  ["🏥", "Clinical validation with practicing doctors"],
  ["🧪", "Real-world pilot testing in healthcare facilities"],
  ["📊", "Accuracy benchmarking against ground truth data"],
  ["🔍", "Explainability improvements for AI decisions"],
  ["⚖️", "Bias and safety evaluation across demographics"],
  ["📋", "Regulatory readiness assessment (DISHA, CDSCO)"],
];
validation.forEach((v, i) => {
  s12.addText(v[0] + "  " + v[1], { x: 7.0, y: 2.4 + i * 0.55, w: 5.7, h: 0.45, fontSize: 11, color: MUTED, fontFace: "Calibri" });
});

// Warning note
s12.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 6.1, w: 6.1, h: 0.7, rectRadius: 0.1, fill: { color: WARNING, transparency: 92 }, line: { color: WARNING, width: 1, transparency: 70 } });
s12.addText("⚠️ All validation items are future work. We know the path from prototype to product — and we've designed the architecture to support it.", {
  x: 7.0, y: 6.15, w: 5.7, h: 0.6, fontSize: 9, color: WARNING, fontFace: "Calibri", lineSpacingMultiple: 1.4,
});
addNote(s12, "Run through 5 phases quickly. Then point to validation: 'We know the path from prototype to product.' Every item is future work.");

// ════════════════════════════════════════
// SLIDE 13: THANK YOU
// ════════════════════════════════════════
let s13 = pptx.addSlide({ transition: { type: "fade", speed: 1.0 } });
s13.background = { color: BG };
s13.addText("Thank You", {
  x: 0.5, y: 1.5, w: 12.3, h: 1.0,
  fontSize: 48, fontFace: "Calibri", bold: true,
  color: PRIMARY_L, align: "center",
});
s13.addText([
  { text: "In India, a doctor sees 40 patients a day.\n", options: { fontSize: 18, color: MUTED } },
  { text: "Each consultation lasts 2 minutes.\n", options: { fontSize: 18, color: MUTED } },
  { text: "We can't add more minutes.\n", options: { fontSize: 18, color: TEXT, bold: true } },
  { text: "But we can make every minute count.", options: { fontSize: 22, color: PRIMARY_L, bold: true } },
], {
  x: 2.5, y: 2.8, w: 8.3, h: 2.0,
  align: "center", lineSpacingMultiple: 1.6,
  fontFace: "Calibri",
});

// Cards
s13.addShape(pptx.ShapeType.roundRect, { x: 3.5, y: 5.2, w: 2.8, h: 0.6, rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
s13.addText("💻  GitHub: ArogyaAI", { x: 3.5, y: 5.25, w: 2.8, h: 0.5, fontSize: 11, color: TEXT, align: "center", fontFace: "Calibri" });

s13.addShape(pptx.ShapeType.roundRect, { x: 7.0, y: 5.2, w: 2.8, h: 0.6, rectRadius: 0.1, fill: { color: SURFACE }, line: { color: SURFACE2, width: 1 } });
s13.addText("🖥️  Live Demo Available", { x: 7.0, y: 5.25, w: 2.8, h: 0.5, fontSize: 11, color: TEXT, align: "center", fontFace: "Calibri" });

s13.addText("Questions? We'd love to discuss the technical details — or show a live demo.", {
  x: 2, y: 6.2, w: 9.3, h: 0.4,
  fontSize: 11, color: DIM, align: "center", fontFace: "Calibri",
});
addNote(s13, "Deliver with conviction. Pause. 'We can't add more minutes. But we can make every minute count. That is ArogyaAI.' Smile.");

// ── Generate ──
const outputPath = process.argv[2] || "ArogyaAI_Presentation.pptx";
pptx.writeFile({ fileName: outputPath })
  .then(() => console.log("✅ PPTX created: " + outputPath))
  .catch(err => console.error("❌ Error:", err));
