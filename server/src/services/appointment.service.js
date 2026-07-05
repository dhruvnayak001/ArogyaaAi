/**
 * services/appointment.service.js
 * Business logic for appointment booking and management
 */

'use strict';

const Appointment = require('../models/Appointment.model');
const User        = require('../models/User.model');
const AppError    = require('../utils/AppError');
const { sendEmail, templates } = require('../utils/sendEmail');
const { createNotification }   = require('./notification.service');
const { enqueueEmail, enqueueNotification, enqueueRefund } = require('../queues');
const logger      = require('../config/logger');
const { format }  = require('date-fns');

/* Canonicalize a date to midnight UTC before every slot write/query. Without
   this, two clients submitting the same calendar day with different
   time-of-day components (e.g. timezone-naive frontends) are treated as
   different `date` values — defeating both the double-booking unique index
   and availability lookups, which rely on exact Date equality. */
const normalizeDate = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

/* Explicit appointment status state machine. Without this, a doctor could
   flip a cancelled/completed appointment back to confirmed, or complete an
   already-cancelled one, corrupting billing/refund state and re-triggering
   confirmation notifications for a stale appointment. */
const ALLOWED_STATUS_TRANSITIONS = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/* ════════════════════════════════════════
   GET APPOINTMENTS
   ════════════════════════════════════════ */

/**
 * Get appointments — filtered by user role
 * Patients see their own; doctors see their scheduled ones.
 */
const getAppointments = async (userId, userRole, filters = {}) => {
  const query = {};

  if (userRole === 'patient') query.patient = userId;
  if (userRole === 'doctor')  query.doctor  = userId;

  if (filters.status) query.status = filters.status;
  if (filters.date) {
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.date);
    end.setHours(23, 59, 59, 999);
    query.date = { $gte: start, $lte: end };
  }

  const page  = Math.max(1,  parseInt(filters.page,  10) || 1);
  const limit = Math.min(50, parseInt(filters.limit, 10) || 20);
  const skip  = (page - 1) * limit;

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate('patient', 'name email avatar gender bloodGroup chronicConditions allergies dateOfBirth')
      .populate('doctor',  'name email avatar doctorProfile')
      /* Trim populate: only severity + title for list view. Full analysis is
         available on the single-appointment detail endpoint. This prevents
         serializing large AI analysis blobs on every list load. */
      .populate('uploadedReportIds', 'title type date analysis.severity')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(query),
  ]);

  return { appointments, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Get upcoming appointments (next 30 days)
 */
const getUpcomingAppointments = async (userId, userRole) => {
  const query = {
    status: { $in: ['pending', 'confirmed'] },
    date:   { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  };
  if (userRole === 'patient') query.patient = userId;
  if (userRole === 'doctor')  query.doctor  = userId;

  return Appointment.find(query)
    .populate('patient', 'name avatar gender bloodGroup dateOfBirth chronicConditions allergies')
    .populate('doctor',  'name avatar doctorProfile')
    /* Trim populate for list view — detail endpoint provides full data */
    .populate('uploadedReportIds', 'title type date analysis.severity')
    .sort({ date: 1 })
    /* Hard cap so a high-volume doctor/clinic account can't pull an
       unbounded result set on every dashboard load. */
    .limit(100)
    .lean();
};

/**
 * Get a single appointment (validates ownership)
 */
const getAppointmentById = async (appointmentId, userId, userRole) => {
  const appt = await Appointment.findById(appointmentId)
    .populate('patient', 'name email phone avatar bloodGroup chronicConditions allergies dateOfBirth gender emergencyContact')
    .populate('doctor',  'name email avatar doctorProfile')
    .populate('uploadedReportIds', 'title type date fileUrl files analysis.severity analysis.summary doctorSummary');

  if (!appt) throw new AppError('Appointment not found.', 404);

  /* A hard-deleted patient/doctor account leaves the corresponding populated
     field as null — guard before dereferencing to avoid an unhandled 500 for
     the other party still holding a reference to this appointment. */
  if (!appt.patient || !appt.doctor) {
    throw new AppError('This appointment references an account that no longer exists.', 410);
  }

  const isOwner = userRole === 'patient'
    ? appt.patient._id.toString() === userId.toString()
    : appt.doctor._id.toString()  === userId.toString();

  if (!isOwner) throw new AppError('Not authorized to view this appointment.', 403);

  return appt;
};

/* ════════════════════════════════════════
   BOOK APPOINTMENT
   ════════════════════════════════════════ */

/**
 * bookAppointment
 * Validates slot availability and creates appointment.
 * Locks consultation fee from doctor's mode config at booking time.
 */
const bookAppointment = async (patientId, payload) => {
  const {
    doctorId, date, time, consultationType, type, reason,
    symptoms, notes,
    symptomTranscript,
    uploadedReportIds,
    aiConsultationBrief,
  } = payload;

  /* 1. Verify doctor exists and is verified — unverified doctors must never receive bookings */
  const doctor = await User.findOne({
    _id: doctorId, role: 'doctor', isActive: true, 'doctorProfile.isVerified': true,
  });
  if (!doctor) throw new AppError('Doctor not found.', 404);

  /* 2. Resolve consultation type (new field takes priority, type is legacy) */
  const resolvedType = consultationType || type || 'clinic';

  /* 3. Look up fee and duration from doctor's consultationModes */
  const modes = doctor.doctorProfile?.consultationModes || [];
  const modeConfig = modes.find((m) => m.mode === resolvedType && m.enabled);

  /* Fallback: if mode not configured or disabled, use legacy consultationFee */
  const consultationFee = modeConfig
    ? modeConfig.fee
    : (doctor.doctorProfile?.consultationFee || 0);
  const duration = modeConfig?.duration || 30;

  /* 4. Check slot availability (only block if another paid/pending appointment exists) */
  const appointmentDate = normalizeDate(date);
  const existing = await Appointment.findOne({
    doctor: doctorId,
    date:   appointmentDate,
    time,
    status: { $in: ['pending', 'confirmed'] },
    paymentStatus: { $in: ['pending', 'paid'] },
  });
  if (existing) throw new AppError('This time slot is already booked. Please choose another.', 409);

  /* 5. Prevent self-booking */
  if (patientId.toString() === doctorId.toString()) {
    throw new AppError('You cannot book an appointment with yourself.', 400);
  }

  /* 6. Validate report IDs belong to this patient (security) */
  let validReportIds = [];
  if (Array.isArray(uploadedReportIds) && uploadedReportIds.length > 0) {
    const HealthRecord = require('../models/HealthRecord.model');
    const owned = await HealthRecord.find({
      _id:  { $in: uploadedReportIds },
      user: patientId,              // HealthRecord model uses 'user', not 'patient'
    }).select('_id').lean();
    validReportIds = owned.map((r) => r._id);
  }

  /* 7. Generate invoice & receipt numbers.
     crypto.randomBytes gives a cryptographically strong, high-entropy suffix —
     Math.random()'s ~36^5 keyspace made collisions (and their confusing
     misattribution as "slot already booked") realistic at scale. */
  const crypto      = require('crypto');
  const now         = new Date();
  const monthStr    = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const uniqueSuffix = crypto.randomBytes(5).toString('hex').toUpperCase();
  const invoiceNumber = `INV-${monthStr}-${uniqueSuffix}`;
  const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  /* 8. Compute total */
  const totalAmount = consultationFee; // platform fee / tax = 0 for now

  /* 9. Create appointment — wrapped to handle concurrent double-booking.
     The partial unique index (unique_active_slot) on { doctor, date, time }
     enforces slot uniqueness atomically at the DB level. If two concurrent
     requests both pass the findOne check above (TOCTOU window), MongoDB will
     reject the second insert with a duplicate key error (code 11000). We
     catch that specifically and return a clean 409 — no raw Mongo error leaks. */
  let appointment;
  try {
    appointment = await Appointment.create({
      patient:  patientId,
      doctor:   doctorId,
      date:     appointmentDate,
      time,
      consultationType: resolvedType,
      type:     resolvedType,  // keep legacy field in sync
      duration,
      reason,
      symptoms:          symptoms          || [],
      symptomTranscript: symptomTranscript || null,
      uploadedReportIds: validReportIds,
      aiConsultationBrief: aiConsultationBrief || null,
      notes:    { patient: notes || null },
      consultationFee,
      fee:      consultationFee,  // legacy
      totalAmount,
      amount:   consultationFee * 100,  // in paise for Razorpay
      paymentStatus: 'pending',
      invoiceNumber,
      receiptNumber,
    });
  } catch (err) {
    /* MongoDB duplicate key — could be the slot-uniqueness index OR a
       collision on the (low-entropy) invoiceNumber/receiptNumber unique
       fields. Inspect which index actually fired before choosing the error
       message so a receipt-number clash isn't misreported to the user as
       "someone else booked your slot" and needlessly rejected. */
    if (err.code === 11000) {
      const collidedField = Object.keys(err.keyPattern || {})[0];
      if (collidedField === 'invoiceNumber' || collidedField === 'receiptNumber') {
        logger.warn(`Invoice/receipt number collision on booking retry: doctor=${doctorId}, field=${collidedField}`);
        throw new AppError('A temporary booking conflict occurred. Please try again.', 409);
      }
      logger.warn(`Double-booking attempt blocked by index: doctor=${doctorId}, date=${appointmentDate}, time=${time}`);
      throw new AppError('This time slot was just booked by another patient. Please choose another slot.', 409);
    }
    throw err;
  }

  const populated = await appointment.populate([
    { path: 'patient', select: 'name email' },
    { path: 'doctor',  select: 'name email' },
  ]);

  /* 10. Notify doctor via email using proper template (non-blocking) */
  const formattedDate = format(appointmentDate, 'PPP');
  const bookingEmail  = templates.appointmentBooked(
    doctor.name,
    populated.patient.name,
    formattedDate,
    time,
    reason
  );
  enqueueEmail(
    { to: doctor.email, subject: bookingEmail.subject, html: bookingEmail.html },
    () => sendEmail({ to: doctor.email, subject: bookingEmail.subject, html: bookingEmail.html })
  ).catch((err) => logger.warn(`Appointment notification email failed: ${err.message}`));

  /* 11. In-app notification for doctor (non-blocking) */
  enqueueNotification({
    recipientId: doctorId,
    type:    'appointment_booked',
    title:   '📅 New Appointment Request',
    message: `${populated.patient.name} booked an appointment on ${formattedDate} at ${time}.`,
    data:    { appointmentId: appointment._id },
    link:    '/doctor/dashboard',
  }).catch(() => {});

  logger.info(`Appointment booked: ${appointment._id} (${patientId} → ${doctorId}) | ${resolvedType} | ₹${consultationFee}`);
  return populated;
};


/* ════════════════════════════════════════
   UPDATE / STATUS
   ════════════════════════════════════════ */

/**
 * Update appointment details (patient: reschedule / notes)
 */
const updateAppointment = async (appointmentId, userId, userRole, updates) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new AppError('Appointment not found.', 404);

  const isPatient = userRole === 'patient' && appt.patient.toString() === userId.toString();
  if (!isPatient) throw new AppError('Not authorized to update this appointment.', 403);

  if (appt.status === 'cancelled' || appt.status === 'completed') {
    throw new AppError(`Cannot modify a ${appt.status} appointment.`, 400);
  }

  const ALLOWED = ['date', 'time', 'type', 'reason', 'symptoms', 'symptomTranscript', 'uploadedReportIds', 'aiConsultationBrief'];
  ALLOWED.forEach((field) => {
    if (updates[field] !== undefined) appt[field] = updates[field];
  });
  if (updates.notes) appt.notes.patient = updates.notes;

  /* Reschedules must use the same canonical date form as bookAppointment,
     or the slot-uniqueness index can be bypassed by a differing time-of-day
     component on an otherwise identical date/time. */
  if (updates.date !== undefined) appt.date = normalizeDate(updates.date);

  /* Re-validate ownership of uploadedReportIds if they are being changed */
  if (Array.isArray(updates.uploadedReportIds) && updates.uploadedReportIds.length > 0) {
    const HealthRecord = require('../models/HealthRecord.model');
    const owned = await HealthRecord.find({
      _id:  { $in: updates.uploadedReportIds },
      user: userId,
    }).select('_id').lean();
    appt.uploadedReportIds = owned.map((r) => r._id);
  }

  /* If date/time changed, pre-check availability for a friendlier error, but
     the real guarantee is the unique_active_slot index — catch its duplicate
     key error the same way bookAppointment does instead of letting a raw
     Mongo error surface as an unhandled 500. */
  try {
    await appt.save();
  } catch (err) {
    if (err.code === 11000) {
      logger.warn(`Reschedule collision blocked by index: appointment=${appointmentId}, doctor=${appt.doctor}, date=${appt.date}, time=${appt.time}`);
      throw new AppError('This time slot is already booked. Please choose another.', 409);
    }
    throw err;
  }
  return appt;
};

/**
 * updateAppointmentStatus — doctor action (confirm / complete / cancel)
 */
const updateAppointmentStatus = async (appointmentId, doctorId, payload) => {
  const { status, notes } = payload;
  const VALID = ['confirmed', 'completed', 'cancelled'];
  if (!VALID.includes(status)) throw new AppError('Invalid status value.', 400);

  const current = await Appointment.findOne({ _id: appointmentId, doctor: doctorId }).select('status');
  if (!current) throw new AppError('Appointment not found.', 404);

  if (!ALLOWED_STATUS_TRANSITIONS[current.status]?.includes(status)) {
    throw new AppError(`Cannot change status from ${current.status} to ${status}.`, 400);
  }

  /* Atomic compare-and-swap: filter re-asserts the exact prior status so a
     concurrent write (e.g. the patient cancelling at the same moment) cannot
     be silently lost — whichever write reaches Mongo first wins, and the
     loser gets null back instead of clobbering the winner's state. */
  const appt = await Appointment.findOneAndUpdate(
    { _id: appointmentId, doctor: doctorId, status: current.status },
    {
      $set: {
        status,
        ...(notes ? { 'notes.doctor': notes } : {}),
      },
    },
    { new: true }
  ).populate('patient', 'name email');

  if (!appt) {
    throw new AppError('This appointment was modified concurrently. Please refresh and try again.', 409);
  }

  if (status === 'confirmed') {
    const formattedDate = format(new Date(appt.date), 'PPP');
    const confirmedHtml = templates.appointmentConfirmed(
      appt.patient.name,
      'Your Doctor',
      formattedDate,
      appt.time
    ).html;
    enqueueEmail(
      { to: appt.patient.email, subject: 'Appointment Confirmed — ArogyaAI', html: confirmedHtml },
      () => sendEmail({ to: appt.patient.email, subject: 'Appointment Confirmed — ArogyaAI', html: confirmedHtml })
    ).catch((err) => logger.warn(`Confirmation email failed: ${err.message}`));

    /* In-app notification for patient */
    enqueueNotification({
      recipientId: appt.patient._id,
      type:    'appointment_confirmed',
      title:   '✅ Appointment Confirmed',
      message: `Your appointment on ${formattedDate} at ${appt.time} has been confirmed.`,
      data:    { appointmentId: appt._id },
      link:    '/appointments',
    }).catch(() => {});
  }

  if (status === 'cancelled') {
    /* Email + In-app notification for patient (doctor cancelled) */
    const formattedDate = format(new Date(appt.date), 'PPP');
    const cancelEmail   = templates.appointmentCancelled(
      appt.patient.name,
      appt.patient.name,
      'Your Doctor',
      formattedDate,
      appt.time,
      'doctor',
      notes || null
    );
    enqueueEmail(
      { to: appt.patient.email, subject: cancelEmail.subject, html: cancelEmail.html },
      () => sendEmail({ to: appt.patient.email, subject: cancelEmail.subject, html: cancelEmail.html })
    ).catch((err) => logger.warn(`Cancellation email failed: ${err.message}`));

    enqueueNotification({
      recipientId: appt.patient._id,
      type:    'appointment_cancelled',
      title:   '❌ Appointment Cancelled',
      message: `Your appointment scheduled for ${formattedDate} at ${appt.time} has been cancelled by the doctor.`,
      data:    { appointmentId: appt._id },
      link:    '/appointments',
    }).catch(() => {});
  }

  return appt;
};

/**
 * Cancel appointment (patient action)
 */
const cancelAppointment = async (appointmentId, patientId, reason) => {
  const appt = await Appointment.findOne({ _id: appointmentId, patient: patientId })
    .populate('patient', 'name email')
    .populate('doctor',  'name email doctorProfile.cancellationPolicy');
  if (!appt) throw new AppError('Appointment not found.', 404);

  if (['cancelled', 'completed'].includes(appt.status)) {
    throw new AppError(`Appointment is already ${appt.status}.`, 400);
  }

  const patientDoc  = appt;
  const patientName = patientDoc.patient?.name  || 'Patient';
  const doctorEmail = patientDoc.doctor?.email  || null;
  const doctorName  = patientDoc.doctor?.name   || 'Doctor';
  const doctorId    = patientDoc.doctor?._id    || appt.doctor;
  const fmtDate     = format(new Date(appt.date), 'PPP');

  /* ── Refund state machine (paid appointments only) ──────────────────────
     Reads the doctor's cancellationPolicy tiers to determine what percentage
     of consultationFee the patient is entitled to as a refund.
     Sets refundStatus = 'initiated' and refundAmount so the finance/admin
     layer can process the actual Razorpay refund against appt.paymentId.

     Policy tiers (default: 100 / 50 / 0):
       moreThan24h:    % refund if cancelled > 24 h before appointment
       between12and24h: % refund if 12–24 h before
       lessThan12h:    % refund if < 12 h before                          */
  const cancellationFields = {
    status:             'cancelled',
    cancelledBy:        'patient',
    cancellationReason: reason || null,
    cancelledAt:        new Date(),
  };

  let willRefund = false;
  if (appt.paymentStatus === 'paid') {
    const policy = patientDoc.doctor?.doctorProfile?.cancellationPolicy || {};
    const pctMoreThan24h    = typeof policy.moreThan24h    === 'number' ? policy.moreThan24h    : 100;
    const pctBetween12and24 = typeof policy.between12and24h === 'number' ? policy.between12and24h : 50;
    const pctLessThan12h    = typeof policy.lessThan12h    === 'number' ? policy.lessThan12h    : 0;

    const hoursUntilAppt = (new Date(appt.date).getTime() - Date.now()) / (1000 * 60 * 60);

    let refundPct;
    if (hoursUntilAppt > 24) {
      refundPct = pctMoreThan24h;
    } else if (hoursUntilAppt >= 12) {
      refundPct = pctBetween12and24;
    } else {
      refundPct = pctLessThan12h;
    }

    const baseAmount = appt.totalAmount || appt.consultationFee || 0;
    cancellationFields.refundAmount = parseFloat(((baseAmount * refundPct) / 100).toFixed(2));
    cancellationFields.refundStatus = 'initiated';
    willRefund = true;

    logger.info(
      `Refund initiated for appointment ${appointmentId}: ` +
      `hoursUntil=${hoursUntilAppt.toFixed(1)}, policy=${refundPct}%, ` +
      `base=₹${baseAmount}, refund=₹${cancellationFields.refundAmount}`
    );
  }

  /* Atomic compare-and-swap: only persists if the appointment is still in a
     cancellable state at write time. Guards against a lost update if the
     doctor concurrently completes/cancels the same appointment between our
     read above and this write. */
  const updated = await Appointment.findOneAndUpdate(
    { _id: appointmentId, patient: patientId, status: { $nin: ['cancelled', 'completed'] } },
    { $set: cancellationFields },
    { new: true }
  );

  if (!updated) {
    throw new AppError('This appointment was already finalized. Please refresh and try again.', 409);
  }

  if (willRefund) {
    /* Hand off the actual Razorpay refund call to the refund worker (or run
       inline if Redis isn't configured) — non-blocking so cancellation
       doesn't wait on payment-gateway latency. */
    enqueueRefund({ appointmentId: updated._id.toString(), reason: 'patient_cancelled' }).catch((err) =>
      logger.warn(`Refund enqueue failed for appointment ${appointmentId}: ${err.message}`)
    );
  }

  /* Email to doctor */
  if (doctorEmail) {
    const cancelEmail = templates.appointmentCancelled(
      doctorName,
      patientName,
      doctorName,
      fmtDate,
      appt.time,
      'patient',
      reason || null
    );
    enqueueEmail(
      { to: doctorEmail, subject: cancelEmail.subject, html: cancelEmail.html },
      () => sendEmail({ to: doctorEmail, subject: cancelEmail.subject, html: cancelEmail.html })
    ).catch((err) => logger.warn(`Patient-cancel doctor email failed: ${err.message}`));
  }

  /* Email to patient (self-cancellation confirmation) */
  const patientEmail = patientDoc.patient?.email || null;
  if (patientEmail) {
    const confirmEmail = templates.appointmentCancelled(
      patientName,
      patientName,
      doctorName,
      fmtDate,
      appt.time,
      'patient',
      reason || null
    );
    enqueueEmail(
      { to: patientEmail, subject: confirmEmail.subject, html: confirmEmail.html },
      () => sendEmail({ to: patientEmail, subject: confirmEmail.subject, html: confirmEmail.html })
    ).catch((err) => logger.warn(`Patient-cancel self email failed: ${err.message}`));
  }

  enqueueNotification({
    recipientId: doctorId,
    type:    'appointment_cancelled',
    title:   '❌ Appointment Cancelled',
    message: `${patientName} cancelled their appointment on ${fmtDate} at ${appt.time}.`,
    data:    { appointmentId: appt._id },
    link:    '/doctor/dashboard',
  }).catch(() => {});

  return updated;
};

/* ════════════════════════════════════════
   AVAILABILITY
   ════════════════════════════════════════ */

/**
 * Get available time slots for a doctor on a given date
 * Respects: working days, lunch break, booked slots, slot duration
 */
const getAvailableSlots = async (doctorId, dateStr) => {
  const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true });
  if (!doctor) throw new AppError('Doctor not found.', 404);

  const avail    = doctor.doctorProfile?.availability || {};
  const start    = avail.startTime    || '09:00';
  const end      = avail.endTime      || '17:00';
  const duration = avail.slotDuration || 30;
  const workDays = avail.days         || ['Mon','Tue','Wed','Thu','Fri'];
  const lunch    = avail.lunchBreak   || { enabled: false, start: '13:00', end: '14:00' };

  /* Check if this date is a working day */
  const dateObj   = normalizeDate(dateStr);
  const dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayOfWeek = dayNames[dateObj.getDay()];
  const isWorkingDay = workDays.length === 0 || workDays.includes(dayOfWeek);

  if (!isWorkingDay) {
    return {
      slots: [],
      isWorkingDay: false,
      dayOfWeek,
      workingHours: { start, end },
    };
  }

  /* Generate all slots, excluding lunch break */
  const allSlots = _generateTimeSlots(start, end, duration, lunch);

  /* Find booked slots for that date */
  const booked = await Appointment.find({
    doctor: doctorId,
    date:   dateObj,
    status: { $in: ['pending', 'confirmed'] },
    paymentStatus: { $in: ['pending', 'paid'] },
  }).select('time').lean();

  const bookedTimes = new Set(booked.map((b) => b.time));

  return {
    slots: allSlots.map((slot) => ({
      time:      slot,
      available: !bookedTimes.has(slot),
    })),
    isWorkingDay: true,
    dayOfWeek,
    workingHours: { start, end },
    lunchBreak:   lunch.enabled ? { start: lunch.start, end: lunch.end } : null,
  };
};

/* ── Private helper: generate time slot strings (excludes lunch break) ── */
const _generateTimeSlots = (startTime, endTime, durationMins, lunchBreak = {}) => {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM]     = endTime.split(':').map(Number);

  let current  = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  /* Lunch break boundaries (in minutes from midnight) */
  let lunchStart = Infinity;
  let lunchEnd   = 0;
  if (lunchBreak.enabled && lunchBreak.start && lunchBreak.end) {
    const [lsH, lsM] = lunchBreak.start.split(':').map(Number);
    const [leH, leM] = lunchBreak.end.split(':').map(Number);
    lunchStart = lsH * 60 + lsM;
    lunchEnd   = leH * 60 + leM;
  }

  while (current + durationMins <= endTotal) {
    /* Skip slots that fall within the lunch break window */
    if (!(current >= lunchStart && current < lunchEnd)) {
      const h = String(Math.floor(current / 60)).padStart(2, '0');
      const m = String(current % 60).padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
    current += durationMins;
  }
  return slots;
};

module.exports = {
  getAppointments,
  getUpcomingAppointments,
  getAppointmentById,
  bookAppointment,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getAvailableSlots,
};
