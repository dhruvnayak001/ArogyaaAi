/**
 * controllers/appointment.controller.js
 * HTTP layer for appointment booking and management
 */

'use strict';

const apptService = require('../services/appointment.service');
const catchAsync  = require('../utils/catchAsync');

/* GET /appointments */
const getAppointments = catchAsync(async (req, res) => {
  const result = await apptService.getAppointments(
    req.user._id,
    req.user.role,
    req.query
  );
  /* result = { appointments[], total, page, limit, totalPages } */
  res.status(200).json({ success: true, data: result });
});

/* GET /appointments/upcoming */
const getUpcoming = catchAsync(async (req, res) => {
  const appointments = await apptService.getUpcomingAppointments(
    req.user._id,
    req.user.role
  );
  res.status(200).json({ success: true, data: { appointments } });
});

/* GET /appointments/:id */
const getAppointmentById = catchAsync(async (req, res) => {
  const appointment = await apptService.getAppointmentById(
    req.params.id,
    req.user._id,
    req.user.role
  );
  res.status(200).json({ success: true, data: { appointment } });
});

/* POST /appointments */
const bookAppointment = catchAsync(async (req, res) => {
  const appointment = await apptService.bookAppointment(req.user._id, req.body);
  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully',
    data: { appointment },
  });
});

/* PUT /appointments/:id */
const updateAppointment = catchAsync(async (req, res) => {
  const appointment = await apptService.updateAppointment(
    req.params.id,
    req.user._id,
    req.user.role,
    req.body
  );
  res.status(200).json({ success: true, data: { appointment } });
});

/* PATCH /appointments/:id/status  (doctor only) */
const updateStatus = catchAsync(async (req, res) => {
  const appointment = await apptService.updateAppointmentStatus(
    req.params.id,
    req.user._id,
    req.body
  );
  res.status(200).json({ success: true, data: { appointment } });
});

/* PATCH /appointments/:id/cancel  (patient only) */
const cancelAppointment = catchAsync(async (req, res) => {
  const appointment = await apptService.cancelAppointment(
    req.params.id,
    req.user._id,
    req.body.reason
  );
  res.status(200).json({ success: true, data: { appointment } });
});

/* GET /appointments/slots/:doctorId */
const getAvailableSlots = catchAsync(async (req, res) => {
  const slots = await apptService.getAvailableSlots(
    req.params.doctorId,
    req.query.date
  );
  res.status(200).json({ success: true, data: { slots } });
});

module.exports = {
  getAppointments,
  getUpcoming,
  getAppointmentById,
  bookAppointment,
  updateAppointment,
  updateStatus,
  cancelAppointment,
  getAvailableSlots,
};
