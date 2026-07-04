/**
 * models/User.model.js
 * Core user schema — patients and doctors share this model
 * Role-based fields are conditionally populated
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    /* ── Identity ── */
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false, // Never return password in queries
    },
    role: {
      type:    String,
      enum:    ['patient', 'doctor', 'admin'],
      default: 'patient',
    },
    avatar: {
      type:    String,
      default: null,
    },

    /* ── Personal health info (patient) ── */
    dateOfBirth: { type: Date,   default: null },
    gender:      { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], default: null },
    phone:       { type: String, trim: true, default: null },
    address:     { type: String, default: null },
    bloodGroup:  { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-', null], default: null },
    allergies:   [{ type: String }],
    chronicConditions: [{ type: String }],
    emergencyContact: {
      name:         { type: String, default: null },
      relationship: { type: String, default: null },
      phone:        { type: String, default: null },
    },

    /* ── Doctor profile (doctor role only) ── */
    doctorProfile: {
      specialization:  { type: String, default: null },
      qualifications:  [{ type: String }],
      experience:      { type: Number, default: 0 },    // years
      licenseNumber:   { type: String, default: null },
      hospital:        { type: String, default: null },
      consultationFee: { type: Number, default: 0 },   // INR (legacy — kept for backward compat)
      bio:             { type: String, maxlength: 500 },
      rating:          { type: Number, default: 0, min: 0, max: 5 },
      reviewCount:     { type: Number, default: 0 },
      isVerified:      { type: Boolean, default: false },
      languages:       [{ type: String }],   // e.g. ['English', 'Hindi', 'Marathi']

      /* ── Per-mode consultation configuration ── */
      consultationModes: [{
        _id:         false,
        mode:        { type: String, enum: ['video', 'voice', 'clinic', 'home'], required: true },
        fee:         { type: Number, default: 0, min: 0 },        // INR
        duration:    { type: Number, default: 30, min: 10 },      // minutes
        enabled:     { type: Boolean, default: false },
        description: { type: String, default: null, maxlength: 200 },
      }],

      /* ── Availability ── */
      availability: {
        days:         [{ type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] }],
        startTime:    { type: String, default: '09:00' },
        endTime:      { type: String, default: '17:00' },
        slotDuration: { type: Number, default: 30 },              // minutes
        lunchBreak: {
          enabled:   { type: Boolean, default: false },
          start:     { type: String, default: '13:00' },
          end:       { type: String, default: '14:00' },
        },
      },

      /* ── Cancellation policy ── */
      cancellationPolicy: {
        moreThan24h:   { type: Number, default: 100 },  // % refund
        between12and24h: { type: Number, default: 50 },
        lessThan12h:   { type: Number, default: 0 },
      },
    },

    /* ── Auth tokens ── */
    refreshToken: {
      type:   String,
      select: false,
    },
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
    emailVerificationToken: { type: String, select: false },

    /* ── Account status ── */
    isEmailVerified: { type: Boolean, default: false },
    isActive:        { type: Boolean, default: true },
    lastLogin:       { type: Date,    default: null },

    /* ── Preferences ── */
    preferences: {
      emailNotifications:   { type: Boolean, default: true },
      pushNotifications:    { type: Boolean, default: false },
      emergencyAlerts:      { type: Boolean, default: true },
      appointmentReminders: { type: Boolean, default: true },
      shareWithDoctors:     { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/* ── Indexes ── */
// Note: email index is auto-created by unique:true above
UserSchema.index({ role:  1 });
UserSchema.index({ 'doctorProfile.specialization': 1 });
UserSchema.index({ createdAt: -1 });

/* ── Pre-save hook: hash password ── */
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt  = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ── Instance method: compare password ── */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/* ── Instance method: generate password reset token ── */
UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken   = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return resetToken; // Return unhashed — send via email
};

/* ── Virtual: age ── */
UserSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
