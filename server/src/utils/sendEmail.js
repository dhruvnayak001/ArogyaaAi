/**
 * utils/sendEmail.js
 * Nodemailer email utility with template support
 */

'use strict';

const nodemailer = require('nodemailer');
const logger     = require('../config/logger');

/* ── Transporter singleton ─────────────────────────────────────────────────
   Lazily initialized on first use so the module loads cleanly during startup
   even before environment validation runs.  Reused across all subsequent
   sendEmail() calls — avoids opening a new SMTP/TLS connection per message,
   which is the primary risk under high cron-job load (50+ concurrent sends).
   ──────────────────────────────────────────────────────────────────────── */
let _transporter = null;

const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return _transporter;
};

/* ── Email header injection prevention ─────────────────────────────────────
   User-supplied strings must have CRLF stripped before interpolation into
   subject lines or HTML bodies. An attacker who sets their name to
   "X\r\nBcc: victim@example.com" could inject arbitrary SMTP headers.
   Nodemailer sanitizes most cases, but this provides belt-and-suspenders
   protection that does not depend on Nodemailer's internal behavior.
   ──────────────────────────────────────────────────────────────────────── */
const sanitizeForEmail = (str, maxLen = 200) =>
  String(str ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLen);

/* ── Email templates ── */
const templates = {
  passwordReset: (resetUrl) => ({
    subject: 'ArogyaAI — Reset Your Password',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#0694a2,#7c3aed);padding:32px 40px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:800">ArogyaAI</h1>
          <p style="margin:8px 0 0;opacity:0.8;font-size:13px">HEALTHCARE PLATFORM</p>
        </div>
        <div style="padding:40px">
          <h2 style="margin:0 0 16px;font-size:20px">Reset Your Password</h2>
          <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px">
            You requested a password reset for your ArogyaAI account. Click the button below to set a new password. This link expires in 30 minutes.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#0694a2,#047481);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px">
            Reset Password
          </a>
          <p style="color:#475569;font-size:12px;margin:24px 0 0">
            If you didn't request this, please ignore this email. Your password will remain unchanged.
          </p>
        </div>
      </div>
    `,
  }),

  welcomeEmail: (name) => ({
    subject: `Welcome to ArogyaAI, ${sanitizeForEmail(name)}!`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#0694a2,#7c3aed);padding:32px 40px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:800">ArogyaAI</h1>
        </div>
        <div style="padding:40px">
          <h2 style="margin:0 0 16px">Welcome, ${sanitizeForEmail(name)}! 🎉</h2>
          <p style="color:#94a3b8;line-height:1.6">
            Your ArogyaAI account is ready. Start chatting with our AI healthcare assistant, book appointments, and manage your health records &mdash; all in one place.
          </p>
        </div>
      </div>
    `,
  }),

  /**
   * otpEmail — 6-digit OTP verification email
   */
  otpEmail: (name, otp, expiresInMinutes = 10) => ({
    subject: 'ArogyaAI — Your Email Verification Code',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#0694a2,#7c3aed);padding:32px 40px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:800">ArogyaAI</h1>
          <p style="margin:8px 0 0;opacity:0.8;font-size:13px">EMAIL VERIFICATION</p>
        </div>
        <div style="padding:40px">
          <h2 style="margin:0 0 8px;font-size:20px">Hi ${name}, verify your email 👋</h2>
          <p style="color:#94a3b8;line-height:1.6;margin:0 0 32px">
            Use the code below to verify your ArogyaAI account. It expires in <strong style="color:#f8fafc">${expiresInMinutes} minutes</strong>.
          </p>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;text-align:center;margin:0 0 28px">
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;letter-spacing:2px;text-transform:uppercase">Your OTP code</p>
            <p style="margin:0;font-size:48px;font-weight:900;letter-spacing:12px;color:#22d3ee;font-family:monospace">${String(otp)}</p>
          </div>
          <p style="color:#475569;font-size:12px;margin:0;line-height:1.8">
            ⚠️ Never share this code with anyone — ArogyaAI staff will never ask for your OTP.<br/>
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  }),

  appointmentConfirmed: (patientName, doctorName, date, time) => ({
    subject: 'ArogyaAI — Appointment Confirmed',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#0694a2,#7c3aed);padding:32px 40px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:800">ArogyaAI</h1>
        </div>
        <div style="padding:40px">
          <h2 style="margin:0 0 16px">Appointment Confirmed ✅</h2>
          <p style="color:#94a3b8">Hi ${sanitizeForEmail(patientName)}, your appointment has been confirmed.</p>
          <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0">
            <p style="margin:0 0 8px"><strong>Doctor:</strong> Dr. ${sanitizeForEmail(doctorName)}</p>
            <p style="margin:0 0 8px"><strong>Date:</strong> ${sanitizeForEmail(date)}</p>
            <p style="margin:0"><strong>Time:</strong> ${sanitizeForEmail(time)}</p>
          </div>
        </div>
      </div>
    `,
  }),

  /**
   * appointmentBooked — sent to doctor when a patient books
   */
  appointmentBooked: (doctorName, patientName, date, time, reason) => ({
    subject: 'ArogyaAI — New Appointment Request',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#0694a2,#7c3aed);padding:32px 40px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:800">ArogyaAI</h1>
          <p style="margin:8px 0 0;opacity:0.8;font-size:13px">NEW APPOINTMENT REQUEST</p>
        </div>
        <div style="padding:40px">
          <h2 style="margin:0 0 16px">&#128197; New Appointment Request</h2>
          <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px">
            Hi Dr. <strong style="color:#f8fafc">${sanitizeForEmail(doctorName)}</strong>, a patient has requested an appointment with you.
          </p>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin:0 0 24px">
            <p style="margin:0 0 10px"><strong>Patient:</strong> ${sanitizeForEmail(patientName)}</p>
            <p style="margin:0 0 10px"><strong>Date:</strong> ${sanitizeForEmail(date)}</p>
            <p style="margin:0 0 10px"><strong>Time:</strong> ${sanitizeForEmail(time)}</p>
            <p style="margin:0"><strong>Reason:</strong> ${sanitizeForEmail(reason || 'Not specified', 500)}</p>
          </div>
          <p style="color:#475569;font-size:12px;margin:0">
            Please log in to your ArogyaAI dashboard to confirm or decline this request.
          </p>
        </div>
      </div>
    `,
  }),

  /**
   * appointmentCancelled — sent to affected party when appointment is cancelled
   * cancelledBy: 'patient' | 'doctor'
   */
  appointmentCancelled: (recipientName, patientName, doctorName, date, time, cancelledBy, reason) => ({
    subject: 'ArogyaAI — Appointment Cancelled',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#ef4444,#b91c1c);padding:32px 40px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:800">ArogyaAI</h1>
          <p style="margin:8px 0 0;opacity:0.8;font-size:13px">APPOINTMENT CANCELLED</p>
        </div>
        <div style="padding:40px">
          <h2 style="margin:0 0 16px">&#10060; Appointment Cancelled</h2>
          <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px">
            Hi <strong style="color:#f8fafc">${sanitizeForEmail(recipientName)}</strong>, the following appointment has been cancelled
            by the <strong style="color:#f8fafc">${sanitizeForEmail(cancelledBy)}</strong>.
          </p>
          <div style="background:#1e293b;border:2px solid #ef444440;border-radius:12px;padding:24px;margin:0 0 24px">
            <p style="margin:0 0 10px"><strong>Patient:</strong> ${sanitizeForEmail(patientName)}</p>
            <p style="margin:0 0 10px"><strong>Doctor:</strong> Dr. ${sanitizeForEmail(doctorName)}</p>
            <p style="margin:0 0 10px"><strong>Date:</strong> ${sanitizeForEmail(date)}</p>
            <p style="margin:0 0 10px"><strong>Time:</strong> ${sanitizeForEmail(time)}</p>
            ${reason ? `<p style="margin:10px 0 0;color:#94a3b8"><strong>Reason:</strong> ${sanitizeForEmail(reason, 500)}</p>` : ''}
          </div>
          <p style="color:#475569;font-size:12px;margin:0">
            You can book a new appointment anytime through your ArogyaAI dashboard.
          </p>
        </div>
      </div>
    `,
  }),
};

/**
 * Send an email
 * @param {{ to, subject, html, text }} options
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'ArogyaAI <noreply@arogyaai.health>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Fallback plain text
    });
    logger.info(`Email sent: ${info.messageId} → ${to}`);
    return info;
  } catch (err) {
    logger.error(`Email send failed to ${to}:`, err.message);
    throw err;
  }
};

/**
 * verifySmtp
 * Tests the SMTP connection at startup.
 * Resolves true on success; resolves false (never rejects) on failure.
 * Callers should log a warning and continue — email delivery is degraded,
 * not fatal, so we must not crash the server if SMTP is down.
 */
const verifySmtp = async () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('SMTP not configured — email delivery will be unavailable');
    return false;
  }
  try {
    const transporter = getTransporter();
    await transporter.verify();
    logger.info('✅ SMTP connection verified successfully');
    return true;
  } catch (err) {
    logger.warn(`⚠️  SMTP verification failed: ${err.message} — email delivery may be unavailable`);
    return false;
  }
};

module.exports = { sendEmail, templates, verifySmtp };
