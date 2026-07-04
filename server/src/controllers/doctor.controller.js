/**
 * controllers/doctor.controller.js
 * HTTP layer for doctor profiles and patient management
 */

'use strict';

const doctorService = require('../services/doctor.service');
const catchAsync    = require('../utils/catchAsync');

/* GET /doctors */
const searchDoctors = catchAsync(async (req, res) => {
  const result = await doctorService.searchDoctors(req.query);
  res.status(200).json({ success: true, data: result });
});

/* GET /doctors/specializations */
const getSpecializations = catchAsync(async (req, res) => {
  const specializations = await doctorService.getSpecializations();
  res.status(200).json({ success: true, data: { specializations } });
});

/* GET /doctors/profile  (own profile — doctor only)
   Uses getDoctorOwnProfile which includes phone, email, licenseNumber
   — the doctor must be able to manage their own private data. */
const getOwnProfile = catchAsync(async (req, res) => {
  const doctor = await doctorService.getDoctorOwnProfile(req.user._id);
  res.status(200).json({ success: true, data: { doctor } });
});

/* GET /doctors/:id  (public)
   Uses getDoctorById which excludes phone, email, licenseNumber, cancellationPolicy. */
const getDoctorById = catchAsync(async (req, res) => {
  const doctor = await doctorService.getDoctorById(req.params.id);
  res.status(200).json({ success: true, data: { doctor } });
});

/* PUT /doctors/profile  (doctor only) */
const updateProfile = catchAsync(async (req, res) => {
  const doctor = await doctorService.updateDoctorProfile(req.user._id, req.body);
  res.status(200).json({ success: true, data: { doctor } });
});

/* PUT /doctors/availability  (doctor only) */
const updateAvailability = catchAsync(async (req, res) => {
  const availability = await doctorService.updateAvailability(req.user._id, req.body);
  res.status(200).json({ success: true, data: { availability } });
});

/* PUT /doctors/consultation-modes  (doctor only) */
const updateConsultationModes = catchAsync(async (req, res) => {
  const modes = await doctorService.updateConsultationModes(req.user._id, req.body.modes);
  res.status(200).json({ success: true, data: { modes } });
});

/* PUT /doctors/cancellation-policy  (doctor only) */
const updateCancellationPolicy = catchAsync(async (req, res) => {
  const policy = await doctorService.updateCancellationPolicy(req.user._id, req.body);
  res.status(200).json({ success: true, data: { policy } });
});

/* GET /doctors/patients  (doctor only) */
const getMyPatients = catchAsync(async (req, res) => {
  const result = await doctorService.getMyPatients(req.user._id, req.query);
  /* result = { patients[], total, page, limit, totalPages } */
  res.status(200).json({ success: true, data: result });
});

/* GET /doctors/patients/:patientId/records  (doctor only) */
const getPatientRecords = catchAsync(async (req, res) => {
  const records = await doctorService.getPatientRecords(
    req.user._id,
    req.params.patientId
  );
  res.status(200).json({ success: true, data: { records } });
});

/* GET /doctors/patients/:patientId/360  (doctor only) */
const getPatient360 = catchAsync(async (req, res) => {
  const data = await doctorService.getPatient360(
    req.user._id,
    req.params.patientId,
    req.query.apptId || null
  );
  res.status(200).json({ success: true, data });
});

module.exports = {
  searchDoctors,
  getSpecializations,
  getOwnProfile,
  getDoctorById,
  updateProfile,
  updateAvailability,
  updateConsultationModes,
  updateCancellationPolicy,
  getMyPatients,
  getPatientRecords,
  getPatient360,
};
