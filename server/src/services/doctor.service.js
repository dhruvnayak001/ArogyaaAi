/**
 * services/doctor.service.js
 * Doctor profile, search, and patient management
 */

'use strict';

const mongoose     = require('mongoose');
const User         = require('../models/User.model');
const HealthRecord = require('../models/HealthRecord.model');
const Appointment  = require('../models/Appointment.model');
const AppError     = require('../utils/AppError');
const logger       = require('../config/logger');

/**
 * Escape special regex characters to prevent ReDoS attacks.
 * All user-supplied strings that become $regex values must pass through this.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ════════════════════════════════════════
   SEARCH / BROWSE
   ════════════════════════════════════════ */

const searchDoctors = async (filters = {}) => {
  /* Only verified doctors are ever searchable/bookable publicly — this is
     not an opt-in filter, it is always enforced. */
  const query = { role: 'doctor', isActive: true, 'doctorProfile.isVerified': true };

  if (filters.specialization) {
    const safe = escapeRegex(String(filters.specialization).slice(0, 60));
    query['doctorProfile.specialization'] = { $regex: safe, $options: 'i' };
  }
  if (filters.name) {
    const safe = escapeRegex(String(filters.name).slice(0, 60));
    query.name = { $regex: safe, $options: 'i' };
  }

  const limit = Math.min(parseInt(filters.limit, 10) || 20, 50);
  const skip  = parseInt(filters.skip, 10)  || 0;

  const [doctors, total] = await Promise.all([
    User.find(query)
      .select('name avatar doctorProfile.specialization doctorProfile.rating doctorProfile.reviewCount doctorProfile.experience doctorProfile.hospital doctorProfile.consultationFee doctorProfile.isVerified doctorProfile.availability doctorProfile.languages doctorProfile.consultationModes')
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return { doctors, total, limit, skip };
};

/**
 * Public fields shown on the doctor profile card (unauthenticated / patient view).
 * Excludes: phone, email (direct contact circumvents platform),
 *           doctorProfile.licenseNumber (regulatory ID — not public-facing),
 *           doctorProfile.cancellationPolicy (internal booking logic).
 */
const PUBLIC_DOCTOR_SELECT =
  'name avatar doctorProfile.specialization doctorProfile.qualifications ' +
  'doctorProfile.experience doctorProfile.hospital doctorProfile.consultationFee ' +
  'doctorProfile.bio doctorProfile.rating doctorProfile.reviewCount ' +
  'doctorProfile.isVerified doctorProfile.availability doctorProfile.languages ' +
  'doctorProfile.consultationModes createdAt';

/**
 * getDoctorById — public profile (no phone / email / licenseNumber).
 * Used by GET /doctors/:id (unauthenticated).
 */
const getDoctorById = async (doctorId) => {
  const doctor = await User.findOne({
    _id: doctorId, role: 'doctor', isActive: true, 'doctorProfile.isVerified': true,
  })
    .select(PUBLIC_DOCTOR_SELECT)
    .lean();
  if (!doctor) throw new AppError('Doctor not found.', 404);
  return doctor;
};

/**
 * getDoctorOwnProfile — full profile for the authenticated doctor's dashboard.
 * Used by GET /doctors/profile (doctor-only).
 * Includes phone, email, licenseNumber so the doctor can manage their own data.
 */
const getDoctorOwnProfile = async (doctorId) => {
  const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true })
    .select('name avatar email phone doctorProfile createdAt')
    .lean();
  if (!doctor) throw new AppError('Doctor not found.', 404);
  return doctor;
};

const getSpecializations = async () => {
  const specializations = await User.distinct('doctorProfile.specialization', {
    role: 'doctor',
    isActive: true,
    'doctorProfile.specialization': { $ne: null },
  });
  return specializations.filter(Boolean).sort();
};

/* ════════════════════════════════════════
   DOCTOR PROFILE MANAGEMENT
   ════════════════════════════════════════ */

const updateDoctorProfile = async (doctorId, updates) => {
  const ALLOWED_ROOT = ['name', 'phone', 'address', 'avatar'];
  const ALLOWED_PROFILE = [
    'specialization', 'qualifications', 'experience',
    'licenseNumber', 'hospital', 'consultationFee', 'bio',
  ];

  const rootUpdates    = {};
  const profileUpdates = {};

  ALLOWED_ROOT.forEach((f) => {
    if (updates[f] !== undefined) rootUpdates[f] = updates[f];
  });
  ALLOWED_PROFILE.forEach((f) => {
    if (updates[f] !== undefined) profileUpdates[`doctorProfile.${f}`] = updates[f];
  });

  const doctor = await User.findByIdAndUpdate(
    doctorId,
    { $set: { ...rootUpdates, ...profileUpdates } },
    { new: true, runValidators: true }
  );
  if (!doctor) throw new AppError('Doctor not found.', 404);

  logger.info(`Doctor profile updated: ${doctorId}`);
  return doctor;
};

const updateAvailability = async (doctorId, availability) => {
  const { days, startTime, endTime, slotDuration, lunchBreak } = availability;

  const setFields = {
    'doctorProfile.availability.days':         days,
    'doctorProfile.availability.startTime':    startTime,
    'doctorProfile.availability.endTime':      endTime,
    'doctorProfile.availability.slotDuration': slotDuration,
  };

  if (lunchBreak !== undefined) {
    setFields['doctorProfile.availability.lunchBreak.enabled'] = lunchBreak.enabled ?? false;
    setFields['doctorProfile.availability.lunchBreak.start']   = lunchBreak.start   || '13:00';
    setFields['doctorProfile.availability.lunchBreak.end']     = lunchBreak.end     || '14:00';
  }

  const doctor = await User.findByIdAndUpdate(
    doctorId,
    { $set: setFields },
    { new: true }
  );
  if (!doctor) throw new AppError('Doctor not found.', 404);
  return doctor.doctorProfile.availability;
};

/**
 * updateConsultationModes
 * Replace the doctor's consultation mode array atomically.
 * Validates that mode values are from the allowed set.
 */
const VALID_MODES = ['video', 'voice', 'clinic', 'home'];

const updateConsultationModes = async (doctorId, modes) => {
  if (!Array.isArray(modes)) throw new AppError('Modes must be an array.', 400);

  /* Validate each mode entry */
  const sanitized = modes.map((m) => {
    if (!VALID_MODES.includes(m.mode)) {
      throw new AppError(`Invalid consultation mode: ${m.mode}`, 400);
    }
    return {
      mode:        m.mode,
      fee:         Math.max(0, Number(m.fee)         || 0),
      duration:    Math.max(10, Number(m.duration)   || 30),
      enabled:     Boolean(m.enabled),
      description: (m.description || '').slice(0, 200),
    };
  });

  /* Ensure no duplicate modes */
  const modeSet = new Set(sanitized.map((m) => m.mode));
  if (modeSet.size !== sanitized.length) {
    throw new AppError('Duplicate consultation modes are not allowed.', 400);
  }

  const doctor = await User.findByIdAndUpdate(
    doctorId,
    { $set: { 'doctorProfile.consultationModes': sanitized } },
    { new: true, runValidators: true }
  );
  if (!doctor) throw new AppError('Doctor not found.', 404);

  logger.info(`Doctor consultation modes updated: ${doctorId}`);
  return doctor.doctorProfile.consultationModes;
};

/**
 * updateCancellationPolicy
 * Update doctor's cancellation policy tiers.
 */
const updateCancellationPolicy = async (doctorId, policy) => {
  const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, Number(v) || 0));

  const doctor = await User.findByIdAndUpdate(
    doctorId,
    {
      $set: {
        'doctorProfile.cancellationPolicy.moreThan24h':    clamp(policy.moreThan24h),
        'doctorProfile.cancellationPolicy.between12and24h': clamp(policy.between12and24h),
        'doctorProfile.cancellationPolicy.lessThan12h':    clamp(policy.lessThan12h),
      },
    },
    { new: true }
  );
  if (!doctor) throw new AppError('Doctor not found.', 404);
  return doctor.doctorProfile.cancellationPolicy;
};

/* ════════════════════════════════════════
   PATIENT MANAGEMENT (doctor role only)
   ════════════════════════════════════════ */

/**
 * Get unique patients who have had appointments with this doctor.
 *
 * Previous implementation: distinct('patient') → User.find({ $in: ids })
 *   — Two round-trips; $in array is unbounded for high-volume doctors.
 *
 * New implementation: single aggregation pipeline.
 *   $match → $group → $lookup → $match(isActive + name) → $facet(data + count)
 *   One round-trip; cursor-paginated inside the pipeline.
 */
const getMyPatients = async (doctorId, filters = {}) => {
  const page     = Math.max(1,  parseInt(filters.page,  10) || 1);
  const limit    = Math.min(50, parseInt(filters.limit, 10) || 20);
  const skip     = (page - 1) * limit;

  /* Stage 1: restrict to this doctor's appointments */
  const pipeline = [
    { $match: { doctor: new mongoose.Types.ObjectId(String(doctorId)) } },

    /* Stage 2: deduplicate — one doc per unique patient */
    { $group: { _id: '$patient' } },

    /* Stage 3: join patient profile from users collection */
    {
      $lookup: {
        from:         'users',
        localField:   '_id',
        foreignField: '_id',
        as:           'patient',
        pipeline: [
          {
            $project: {
              name:              1,
              email:             1,
              avatar:            1,
              phone:             1,
              bloodGroup:        1,
              chronicConditions: 1,
              lastLogin:         1,
              createdAt:         1,
              isActive:          1,
            },
          },
        ],
      },
    },

    /* Stage 4: unwind the single-element array produced by $lookup */
    { $unwind: '$patient' },

    /* Stage 5: filter inactive users */
    { $match: { 'patient.isActive': true } },
  ];

  /* Stage 6: optional name filter */
  if (filters.name) {
    const safe = escapeRegex(String(filters.name).slice(0, 60));
    pipeline.push({ $match: { 'patient.name': { $regex: safe, $options: 'i' } } });
  }

  /* Stage 7: $facet — count total and slice the page in ONE query */
  pipeline.push({
    $facet: {
      data: [
        { $skip: skip },
        { $limit: limit },
        { $replaceRoot: { newRoot: '$patient' } },
      ],
      meta: [
        { $count: 'total' },
      ],
    },
  });

  const [result] = await Appointment.aggregate(pipeline);
  const patients = result?.data  || [];
  const total    = result?.meta?.[0]?.total || 0;

  return { patients, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Get a patient's shared health records (doctor access only)
 */
const getPatientRecords = async (doctorId, patientId) => {
  /* Verify doctor has appointment history with this patient */
  const hasRelationship = await Appointment.exists({
    doctor:  doctorId,
    patient: patientId,
  });
  if (!hasRelationship) {
    throw new AppError('You do not have access to this patient\'s records.', 403);
  }

  /* Return only records explicitly shared with this doctor */
  const records = await HealthRecord.find({
    user:                  patientId,
    'sharedWith.doctor':   doctorId,
  }).lean();

  return records;
};

/* ════════════════════════════════════════
   PATIENT 360 — AI COMMAND CENTER
   ════════════════════════════════════════ */

/**
 * Extract a numeric value from an AI-extracted field which may be
 * { value, confidence } or a plain string like "12.5 g/dL"
 */
const _extractNumeric = (raw) => {
  if (!raw) return null;
  const str = typeof raw === 'object' ? (raw.value ?? '') : String(raw);
  const match = str.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
};

const _extractText = (raw) => {
  if (!raw) return null;
  return typeof raw === 'object' ? (raw.value ?? null) : String(raw);
};

/**
 * Pull biomarker trends from an array of health records.
 * Returns an object keyed by biomarker name with { date, value } arrays.
 */
const _extractTrends = (records) => {
  const BIOMARKER_KEYS = {
    hemoglobin:     ['hemoglobin', 'hb', 'haemoglobin'],
    bloodSugar:     ['blood sugar', 'glucose', 'fasting glucose', 'rbs', 'fbs', 'ppbs', 'blood glucose'],
    hba1c:          ['hba1c', 'hb a1c', 'glycated hemoglobin', 'glycosylated'],
    cholesterol:    ['total cholesterol', 'cholesterol'],
    bloodPressure:  ['blood pressure', 'systolic', 'bp'],
    creatinine:     ['creatinine', 'serum creatinine'],
    vitaminD:       ['vitamin d', '25-oh vitamin d', '25-hydroxyvitamin'],
    uricAcid:       ['uric acid'],
    tsh:            ['tsh', 'thyroid stimulating'],
  };

  const trends = {};

  for (const record of records) {
    if (!record.analysis?.extractedValues) continue;
    const vals = record.analysis.extractedValues;
    const date = record.date || record.createdAt;

    for (const [biomarker, keys] of Object.entries(BIOMARKER_KEYS)) {
      for (const [fieldKey, rawVal] of Object.entries(vals)) {
        const lk = fieldKey.toLowerCase();
        if (keys.some((k) => lk.includes(k))) {
          const num = _extractNumeric(rawVal);
          if (num !== null) {
            if (!trends[biomarker]) trends[biomarker] = [];
            trends[biomarker].push({ date, value: num, label: _extractText(rawVal), recordTitle: record.title });
          }
          break;
        }
      }
    }
  }

  /* Sort each trend by date ascending */
  for (const key of Object.keys(trends)) {
    trends[key].sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  return trends;
};

/**
 * Build an AI-generated narrative history summary from records + appointments
 */
const _buildHistorySummary = (patient, appointments, records) => {
  const totalReports = records.length;
  const monthsSpan   = (() => {
    if (!records.length) return 0;
    const dates   = records.map((r) => new Date(r.date || r.createdAt)).filter(Boolean);
    const oldest  = Math.min(...dates.map((d) => d.getTime()));
    const months  = Math.round((Date.now() - oldest) / (1000 * 60 * 60 * 24 * 30));
    return months;
  })();

  /* Aggregate recurring conditions across all records */
  const conditionCount = {};
  for (const r of records) {
    const conds = r.analysis?.detectedConditions ?? [];
    for (const c of conds) {
      const label = typeof c === 'object' ? (c.value ?? '') : String(c);
      if (label) conditionCount[label] = (conditionCount[label] || 0) + 1;
    }
  }
  const recurringConditions = Object.entries(conditionCount)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label)
    .slice(0, 5);

  /* Aggregate symptoms across appointments */
  const symCount = {};
  for (const a of appointments) {
    const syms = a.symptoms ?? a.aiConsultationBrief?.symptoms ?? [];
    for (const s of syms) {
      symCount[s] = (symCount[s] || 0) + 1;
    }
  }
  const recurringSymptoms = Object.entries(symCount)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s)
    .slice(0, 5);

  /* Most recent AI risk */
  const latestAppt = [...appointments]
    .filter((a) => a.aiConsultationBrief?.urgencyLevel)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const latestRisk = latestAppt?.aiConsultationBrief?.urgencyLevel ?? 'UNKNOWN';

  /* Recurring abnormal findings */
  const abnCount = {};
  for (const r of records) {
    for (const f of (r.analysis?.abnormalFindings ?? [])) {
      if (f.parameter) {
        abnCount[f.parameter] = (abnCount[f.parameter] || 0) + 1;
      }
    }
  }
  const recurringAbnormal = Object.entries(abnCount)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p)
    .slice(0, 5);

  return {
    totalReports,
    monthsSpan,
    recurringConditions,
    recurringSymptoms,
    recurringAbnormal,
    latestRisk,
    totalAppointments: appointments.length,
  };
};

/**
 * Full Patient 360 Aggregation — parallel fetch, lean queries
 * @param {string} doctorId
 * @param {string} patientId
 * @param {string|null} focusAppointmentId  — the appointment being opened (optional)
 */
const getPatient360 = async (doctorId, patientId, focusAppointmentId = null) => {
  /* 1. Verify doctor–patient relationship */
  const hasRelationship = await Appointment.exists({
    doctor:  doctorId,
    patient: patientId,
  });
  if (!hasRelationship) {
    throw new AppError('You do not have access to this patient\'s records.', 403);
  }

  /* 2. Parallel fetch — all data in one round trip.
        Previously fired two identical HealthRecord queries (sharedRecords + allPatientRecords).
        Now fires ONE query selecting the union of both field sets and derives both views from it. */
  const [
    patient,
    appointments,
    combinedRecords,
    focusAppointment,
  ] = await Promise.all([
    /* Patient profile */
    User.findById(patientId)
      .select('name email phone avatar bloodGroup gender dateOfBirth chronicConditions allergies emergencyContact address createdAt')
      .lean(),

    /* All appointments between this doctor and patient */
    Appointment.find({ doctor: doctorId, patient: patientId })
      .select('date time type status reason symptoms symptomTranscript aiConsultationBrief uploadedReportIds notes prescription fee')
      .populate('uploadedReportIds', 'title type date fileUrl files analysis.severity doctorSummary.riskLevel')
      .sort({ date: -1 })
      .lean(),

    /* Single HealthRecord query — union of display fields + analysis fields.
       Scoped to explicitly shared records only (BOLA prevention). */
    HealthRecord.find({ user: patientId, 'sharedWith.doctor': doctorId })
      .select('title type date fileUrl files analysis doctorSummary extractionMethod ocrConfidence tags notes createdAt')
      .sort({ date: -1 })
      .lean(),

    /* Focus appointment (the one being opened) */
    focusAppointmentId
      ? Appointment.findById(focusAppointmentId)
          .select('date time type status reason symptoms symptomTranscript aiConsultationBrief uploadedReportIds notes prescription')
          .populate('uploadedReportIds', 'title type date fileUrl files analysis.severity analysis.summary doctorSummary')
          .lean()
      : Promise.resolve(null),
  ]);

  /* Derive both views from the single combined result */
  const sharedRecords    = combinedRecords; // full display fields already selected
  const allPatientRecords = combinedRecords; // analysis sub-fields are present in .analysis

  if (!patient) throw new AppError('Patient not found.', 404);

  /* 3. Compute age */
  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  /* 4. Extract medicines from confirmed records */
  const medicines = [];
  const seenMeds  = new Set();
  for (const r of allPatientRecords) {
    for (const m of (r.analysis?.medicines ?? [])) {
      const label = typeof m === 'object' ? (m.value ?? '') : String(m);
      if (label && !seenMeds.has(label.toLowerCase())) {
        seenMeds.add(label.toLowerCase());
        medicines.push(label);
      }
    }
    if (medicines.length >= 20) break;
  }

  /* 5. Extract trends */
  const trends = _extractTrends(allPatientRecords);

  /* 6. Build AI history summary */
  const historySummary = _buildHistorySummary(patient, appointments, allPatientRecords);

  /* 7. Build health timeline (merged + sorted) */
  const timeline = [
    ...appointments.map((a) => ({
      _id:        a._id,
      type:       'appointment',
      date:       a.date,
      title:      `Appointment — ${a.type}`,
      subtitle:   a.reason,
      status:     a.status,
      urgency:    a.aiConsultationBrief?.urgencyLevel,
      hasBrief:   !!a.aiConsultationBrief?.summaryText,
      reportCount: a.uploadedReportIds?.length ?? 0,
    })),
    ...sharedRecords.map((r) => ({
      _id:        r._id,
      type:       'record',
      date:       r.date || r.createdAt,
      title:      r.title,
      subtitle:   r.type?.replace(/_/g, ' '),
      severity:   r.analysis?.severity,
      hasFile:    !!(r.fileUrl || r.files?.length),
      riskLevel:  r.doctorSummary?.riskLevel,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  /* 8. Build consultation prep (suggested focus areas) */
  const suggestedFocusAreas = [];

  /* From focus appointment brief */
  if (focusAppointment?.aiConsultationBrief?.suggestedFocusAreas?.length) {
    suggestedFocusAreas.push(...focusAppointment.aiConsultationBrief.suggestedFocusAreas);
  }

  /* From abnormal findings in recent records */
  for (const r of allPatientRecords.slice(0, 5)) {
    for (const f of (r.analysis?.abnormalFindings ?? [])) {
      if (f.parameter && f.severity !== 'low') {
        const hint = `Review ${f.parameter} (${f.severity || 'abnormal'} — ${f.value ?? ''} vs ${f.normalRange ?? 'normal'})`.trim();
        if (!suggestedFocusAreas.includes(hint)) suggestedFocusAreas.push(hint);
      }
    }
    if (suggestedFocusAreas.length >= 8) break;
  }

  /* What changed since last visit */
  const lastAppt  = appointments.find((a, i) => i > 0 && a.status === 'completed');
  const prevSymptoms = lastAppt?.symptoms ?? [];
  const curSymptoms  = focusAppointment?.symptoms ?? appointments[0]?.symptoms ?? [];
  const newSymptoms  = curSymptoms.filter((s) => !prevSymptoms.includes(s));
  const resolvedSymptoms = prevSymptoms.filter((s) => !curSymptoms.includes(s));

  return {
    patient:           { ...patient, age },
    age,
    focusAppointment:  focusAppointment || (appointments[0] ?? null),
    appointments,
    sharedRecords,
    medicines:         medicines.slice(0, 20),
    trends,
    historySummary,
    timeline,
    consultationPrep: {
      suggestedFocusAreas: suggestedFocusAreas.slice(0, 8),
      newSymptoms,
      resolvedSymptoms,
      abnormalFindings: allPatientRecords
        .slice(0, 3)
        .flatMap((r) => r.analysis?.abnormalFindings ?? [])
        .filter((f) => f.severity !== 'low')
        .slice(0, 10),
    },
  };
};

module.exports = {
  searchDoctors,
  getDoctorById,
  getDoctorOwnProfile,
  getSpecializations,
  updateDoctorProfile,
  updateAvailability,
  updateConsultationModes,
  updateCancellationPolicy,
  getMyPatients,
  getPatientRecords,
  getPatient360,
};
