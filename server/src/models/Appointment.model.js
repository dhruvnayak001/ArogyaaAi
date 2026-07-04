/**
 * models/Appointment.model.js
 * Appointment booking schema — extended with AI Pre-Consultation Copilot fields
 * + full Razorpay payment tracking
 */

'use strict';

const mongoose = require('mongoose');

/* ── Sub-schema: abnormal value entry ── */
const AbnormalValueSchema = new mongoose.Schema({
  parameter:   { type: String },
  value:       { type: String },
  normalRange: { type: String },
  severity:    { type: String, enum: ['critical', 'high', 'moderate', 'low'] },
}, { _id: false });

/* ── Sub-schema: AI Consultation Copilot Brief ── */
const AIConsultationBriefSchema = new mongoose.Schema({
  summaryText:          { type: String, default: null },
  findings:             [{ type: String }],
  conditions:           [{ type: String }],
  urgencyLevel:         { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
  recommendation:       { type: String, default: null },
  suggestedFocusAreas:  [{ type: String }],
  abnormalValues:       [AbnormalValueSchema],
  symptomTimeline:      { type: String, default: null },
  recommendedSpecialty: { type: String, default: null },
  disclaimer:           { type: String, default: 'AI-assisted clinical preparation summary. Not a medical diagnosis.' },
  aiConfidence:         { type: Number, default: 0 },
  generatedAt:          { type: Date, default: null },
}, { _id: false });

/* ── Main Appointment Schema ── */
const AppointmentSchema = new mongoose.Schema(
  {
    patient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    doctor: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    date: {
      type:     Date,
      required: [true, 'Appointment date is required'],
    },
    time: {
      type:     String,
      required: [true, 'Appointment time is required'],
      match:    [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'],
    },
    duration: {
      type:    Number,
      default: 30, // minutes
    },

    /* ── Consultation type (mapped from doctor's consultationModes) ── */
    consultationType: {
      type:    String,
      enum:    ['video', 'voice', 'clinic', 'home'],
      default: 'clinic',
    },

    /* ── Legacy type field kept for backward compatibility ── */
    type: {
      type:    String,
      enum:    ['in-person', 'video', 'phone', 'clinic', 'voice', 'home'],
      default: 'clinic',
    },

    status: {
      type:    String,
      enum:    ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
      default: 'pending',
      index:   true,
    },
    reason: {
      type:      String,
      required:  [true, 'Reason is required'],
      maxlength: 500,
    },

    /* ── Symptom data ── */
    symptoms:          [{ type: String }],
    symptomTranscript: { type: String, default: null },   // raw voice/typed transcript

    /* ── Linked health records (patient attaches from existing OR new upload) ── */
    uploadedReportIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref:  'HealthRecord',
    }],

    /* ── AI Pre-Consultation Copilot Summary ── */
    aiConsultationBrief: {
      type:    AIConsultationBriefSchema,
      default: null,
    },

    /* ── Doctor/patient notes ── */
    notes: {
      patient: { type: String, default: null },
      doctor:  { type: String, default: null },
    },
    prescription: {
      type:    String,
      default: null,
    },

    /* ══════════════════════════════════════════
       PAYMENT FIELDS — Production Razorpay
       ══════════════════════════════════════════ */

    /* Fee locked at booking time from doctor's consultationModes config */
    consultationFee: { type: Number, default: 0 },

    /* Future-ready fee components */
    platformFee:  { type: Number, default: 0 },   // platform commission
    taxAmount:    { type: Number, default: 0 },   // GST/tax
    discountAmount: { type: Number, default: 0 }, // coupons / wallet
    totalAmount:  { type: Number, default: 0 },   // consultationFee + platformFee + tax - discount

    /* Legacy fee field (kept for backward compat) */
    fee:       { type: Number, default: 0 },
    isPaid:    { type: Boolean, default: false },

    /* Payment state machine */
    paymentStatus: {
      type:    String,
      enum:    ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
      index:   true,
    },

    /* Razorpay identifiers */
    orderId:          { type: String, default: null, index: true },  // rzp order id
    paymentId:        { type: String, default: null },               // rzp payment id
    signature:        { type: String, default: null, select: false }, // NEVER expose signature
    paymentMethod:    { type: String, default: null },               // card/upi/netbanking
    currency:         { type: String, default: 'INR' },
    amount:           { type: Number, default: 0 },                  // in paise

    paymentTimestamp: { type: Date, default: null },
    paymentFailReason:{ type: String, default: null },

    /* Invoice & Receipt — auto-generated unique identifiers */
    invoiceNumber:    { type: String, default: null, unique: true, sparse: true },
    receiptNumber:    { type: String, default: null, unique: true, sparse: true },

    /* ── Cancellation ── */
    cancelledBy:         { type: String, enum: ['patient', 'doctor', null], default: null },
    cancellationReason:  { type: String, default: null },
    cancelledAt:         { type: Date,   default: null },
    refundAmount:        { type: Number, default: 0 },
    refundStatus:        { type: String, enum: ['none', 'initiated', 'processed', 'failed'], default: 'none' },
    refundId:            { type: String, default: null },
    refundProcessedAt:   { type: Date,   default: null },
    refundFailReason:    { type: String, default: null },

    /* ── Video consultation link ── */
    videoLink: { type: String, default: null },

    /* ── Reminders sent ── */
    reminderSent24h: { type: Boolean, default: false },
    reminderSent1h:  { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ── Indexes ── */
AppointmentSchema.index({ patient: 1, date: -1 });
AppointmentSchema.index({ doctor:  1, date: -1 });
AppointmentSchema.index({ date: 1,  status: 1 });
AppointmentSchema.index({ doctor: 1, date: 1, time: 1, paymentStatus: 1 });
AppointmentSchema.index({ paymentStatus: 1, createdAt: -1 });

/* Earnings aggregation index — covers getDoctorEarnings() time-range queries.
   Allows MongoDB to satisfy { doctor, paymentStatus: 'paid', paymentTimestamp: { $gte/$lte } }
   with an index scan instead of a collection scan, and to serve the descending
   sort on paymentTimestamp without a blocking sort stage. */
AppointmentSchema.index(
  { doctor: 1, paymentStatus: 1, paymentTimestamp: -1 },
  { name: 'doctor_earnings' }
);

/* ── Partial unique index: prevents double-booking the same slot ──────────────
   Only applies when the appointment is active (pending/confirmed) AND the
   payment is live (pending/paid). Cancelled and failed appointments are
   excluded so the same slot can be rebooked after a cancellation.

   MongoDB enforces this atomically, closing the TOCTOU race that exists
   when application code does findOne → create in two separate operations.

   NOTE: This index must be created on the Atlas cluster separately if the
   collection already exists. Use the migration script in the walkthrough.
   ─────────────────────────────────────────────────────────────────────── */
AppointmentSchema.index(
  { doctor: 1, date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status:        { $in: ['pending', 'confirmed'] },
      paymentStatus: { $in: ['pending', 'paid'] },
    },
    name: 'unique_active_slot',
  }
);

/* ── Pre-save: sync legacy fields ── */
AppointmentSchema.pre('save', function(next) {
  /* Keep isPaid in sync with paymentStatus */
  this.isPaid = this.paymentStatus === 'paid';
  /* Keep legacy fee in sync with consultationFee */
  if (this.consultationFee && !this.fee) this.fee = this.consultationFee;
  /* Compute total if not set */
  if (!this.totalAmount) {
    this.totalAmount = (this.consultationFee || 0) + (this.platformFee || 0) + (this.taxAmount || 0) - (this.discountAmount || 0);
  }
  next();
});

const Appointment = mongoose.model('Appointment', AppointmentSchema);

module.exports = Appointment;


