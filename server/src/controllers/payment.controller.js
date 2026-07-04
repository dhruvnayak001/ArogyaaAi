/**
 * controllers/payment.controller.js
 * HTTP handlers for Razorpay payment flows
 */

'use strict';

const paymentService = require('../services/payment.service');
const catchAsync     = require('../utils/catchAsync');
const Appointment    = require('../models/Appointment.model');
const AppError       = require('../utils/AppError');
const logger         = require('../config/logger');

/* ── POST /payments/create-order ── */
const createOrder = catchAsync(async (req, res) => {
  const { appointmentId } = req.body;
  if (!appointmentId) throw new AppError('appointmentId is required.', 400);

  const order = await paymentService.createPaymentOrder(appointmentId, req.user._id);
  res.status(200).json({ success: true, data: { order } });
});

/* ── POST /payments/verify ── */
const verifyPayment = catchAsync(async (req, res) => {
  const { appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!appointmentId) throw new AppError('appointmentId is required.', 400);

  const result = await paymentService.verifyPayment(appointmentId, req.user._id, {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  res.status(200).json({
    success: true,
    message: result.alreadyPaid ? 'Payment already verified.' : 'Payment verified successfully.',
    data: {
      appointment: result.appointment,
      alreadyPaid: result.alreadyPaid,
    },
  });
});

/* ── POST /payments/retry/:appointmentId ── */
const retryPayment = catchAsync(async (req, res) => {
  const order = await paymentService.retryPayment(req.params.appointmentId, req.user._id);
  res.status(200).json({ success: true, data: { order } });
});

/* ── GET /payments/earnings  (doctor only) ── */
const getEarnings = catchAsync(async (req, res) => {
  const earnings = await paymentService.getDoctorEarnings(req.user._id);
  res.status(200).json({ success: true, data: { earnings } });
});

/* ── GET /payments/invoice/:appointmentId ── */
const downloadInvoice = catchAsync(async (req, res) => {
  const { appointmentId } = req.params;
  const userId = req.user._id;

  const appt = await Appointment.findById(appointmentId)
    .populate('patient', 'name email phone')
    .populate('doctor',  'name email doctorProfile');

  if (!appt) throw new AppError('Appointment not found.', 404);

  /* Access: patient OR the appointment's doctor can download */
  const isPatient = appt.patient._id.toString() === userId.toString();
  const isDoctor  = appt.doctor._id.toString()  === userId.toString();
  if (!isPatient && !isDoctor) throw new AppError('Not authorised to download this invoice.', 403);

  const pdfBuffer = await paymentService.generateInvoicePDF(appt);

  const filename = `arogyaai-invoice-${appt.invoiceNumber || appt._id}.pdf`;
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      pdfBuffer.length,
  });
  res.end(pdfBuffer);
  logger.info(`Invoice downloaded: ${appointmentId} by ${userId}`);
});

/* ── GET /payments/receipt/:appointmentId ── */
const downloadReceipt = catchAsync(async (req, res) => {
  const { appointmentId } = req.params;
  const userId = req.user._id;

  const appt = await Appointment.findById(appointmentId)
    .populate('patient', 'name email phone')
    .populate('doctor',  'name email doctorProfile');

  if (!appt) throw new AppError('Appointment not found.', 404);

  const isPatient = appt.patient._id.toString() === userId.toString();
  const isDoctor  = appt.doctor._id.toString()  === userId.toString();
  if (!isPatient && !isDoctor) throw new AppError('Not authorised to download this receipt.', 403);

  if (appt.paymentStatus !== 'paid') {
    throw new AppError('Receipt is only available for paid appointments.', 400);
  }

  const pdfBuffer = await paymentService.generateReceiptPDF(appt);

  const filename = `arogyaai-receipt-${appt.receiptNumber || appt._id}.pdf`;
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      pdfBuffer.length,
  });
  res.end(pdfBuffer);
  logger.info(`Receipt downloaded: ${appointmentId} by ${userId}`);
});

module.exports = {
  createOrder,
  verifyPayment,
  retryPayment,
  getEarnings,
  downloadInvoice,
  downloadReceipt,
};
