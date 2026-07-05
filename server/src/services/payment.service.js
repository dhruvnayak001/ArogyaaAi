/**
 * services/payment.service.js
 * Razorpay payment integration — order creation, verification, invoice/receipt generation
 *
 * Security:
 *  - NEVER trust frontend payment success — always verify HMAC-SHA256 signature
 *  - Prevent replay attacks via idempotency check on orderId
 *  - Log all suspicious payment attempts
 *  - Signature is stored hashed (select: false) in DB
 */

'use strict';

const crypto      = require('crypto');
const mongoose    = require('mongoose');
const Razorpay    = require('razorpay');
const PDFDocument = require('pdfkit');
const Appointment = require('../models/Appointment.model');
const AppError    = require('../utils/AppError');
const logger      = require('../config/logger');
const { createNotification } = require('./notification.service');
const { sendEmail, templates } = require('../utils/sendEmail');
const { enqueueNotification, enqueueRefund } = require('../queues');
const { format } = require('date-fns');

/* ── Lazily initialise Razorpay (fails gracefully in dev without keys) ── */
let razorpay = null;
const getRazorpay = () => {
  if (!razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new AppError('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env', 503);
    }
    razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

/* ════════════════════════════════════════
   CREATE RAZORPAY ORDER
   ════════════════════════════════════════ */

/**
 * createPaymentOrder
 * Creates a Razorpay order for an appointment.
 * The patient must own the appointment and it must be in 'pending' payment state.
 */
const createPaymentOrder = async (appointmentId, patientId) => {
  const appt = await Appointment.findById(appointmentId)
    .populate('doctor',  'name email doctorProfile')
    .populate('patient', 'name email phone');

  if (!appt) throw new AppError('Appointment not found.', 404);

  /* Ownership check */
  if (appt.patient._id.toString() !== patientId.toString()) {
    throw new AppError('You are not authorised to pay for this appointment.', 403);
  }

  /* Cancelled appointments must never be payable again */
  if (appt.status === 'cancelled') {
    throw new AppError('Cannot pay for a cancelled appointment.', 400);
  }

  /* Status guard */
  if (appt.paymentStatus === 'paid') {
    throw new AppError('This appointment is already paid.', 400);
  }
  if (['cancelled', 'refunded'].includes(appt.paymentStatus)) {
    throw new AppError(`Cannot pay for a ${appt.paymentStatus} appointment.`, 400);
  }

  const rzp = getRazorpay();

  /* ── Idempotency: reuse an existing live Razorpay order instead of creating
     a new one. Without this, a double-click / network retry / concurrent tab
     creates a second live Razorpay order; if the user pays against the
     "orphaned" one, the DB write below would silently discard it, leaving a
     captured payment with no confirmed appointment and no refund path. ── */
  const previousOrderId = appt.orderId || null;
  if (previousOrderId) {
    try {
      const existingOrder = await rzp.orders.fetch(previousOrderId);
      if (existingOrder && existingOrder.status !== 'paid') {
        logger.info(`[createPaymentOrder] Reusing existing order ${previousOrderId} for appointment ${appointmentId}`);
        return {
          orderId:       existingOrder.id,
          amount:        existingOrder.amount,
          currency:      existingOrder.currency,
          keyId:         process.env.RAZORPAY_KEY_ID,
          appointmentId: appt._id,
          prefill: {
            name:    appt.patient.name,
            email:   appt.patient.email,
            contact: appt.patient.phone || '',
          },
          notes: existingOrder.notes,
        };
      }
    } catch (err) {
      logger.warn(`[createPaymentOrder] Could not fetch existing order ${previousOrderId} (${err.message}) — creating a new one.`);
    }
  }

  /* Amount in paise (₹1 = 100 paise) */
  const amountPaise = Math.round((appt.totalAmount || appt.consultationFee || appt.fee || 0) * 100);

  /* ── Diagnostic logging (debug only \u2014 not shipped to prod log aggregators) ── */
  logger.debug('[createPaymentOrder] Payment flow diagnostics:', {
    appointmentId:    appt._id.toString(),
    patientId:        patientId.toString(),
    consultationFee:  appt.consultationFee,
    consultationType: appt.consultationType,
    totalAmount:      appt.totalAmount,
    fee:              appt.fee,
    amountPaise,
    paymentStatus:    appt.paymentStatus,
  });

  if (amountPaise === 0) {
    throw new AppError('Consultation fee is ₹0 — the doctor has not configured a consultation fee for this type. Please contact support or choose a different consultation type.', 400);
  }

  const orderOptions = {
    amount:   amountPaise,
    currency: 'INR',
    receipt:  appt.receiptNumber || `RCP-${appt._id.toString().slice(-8).toUpperCase()}`,
    notes: {
      appointmentId:    appt._id.toString(),
      patientName:      appt.patient.name,
      doctorName:       appt.doctor.name,
      consultationType: appt.consultationType,
    },
  };

  let order;
  try {
    order = await rzp.orders.create(orderOptions);
  } catch (err) {
    logger.error(`Razorpay order creation failed: ${err.message}`, { appointmentId });
    throw new AppError('Payment gateway error. Please try again.', 502);
  }

  /* Persist orderId atomically — guarded on the orderId value read at the top
     of this function (compare-and-swap). This closes the duplicate-order race:
     if a concurrent call already won and wrote a different orderId (or the
     appointment became cancelled/paid) between our read and this write, this
     update matches zero documents instead of silently overwriting the
     winner's orderId and orphaning their live Razorpay order. */
  const persisted = await Appointment.findOneAndUpdate(
    { _id: appt._id, orderId: previousOrderId, status: { $ne: 'cancelled' }, paymentStatus: { $ne: 'paid' } },
    { $set: { orderId: order.id, amount: amountPaise, currency: 'INR' } },
    { new: true }
  );

  if (!persisted) {
    logger.warn(`[createPaymentOrder] Appointment ${appointmentId} order state changed concurrently — order ${order.id} will remain unused.`);
    throw new AppError('A payment for this appointment is already being processed, or it can no longer be paid for. Please refresh and try again.', 409);
  }

  logger.info(`Razorpay order created: ${order.id} for appointment ${appointmentId}`);

  return {
    orderId:      order.id,
    amount:       amountPaise,
    currency:     'INR',
    keyId:        process.env.RAZORPAY_KEY_ID,
    appointmentId: appt._id,
    prefill: {
      name:  appt.patient.name,
      email: appt.patient.email,
      contact: appt.patient.phone || '',
    },
    notes: orderOptions.notes,
  };
};

/* ════════════════════════════════════════
   VERIFY PAYMENT — CRITICAL SECURITY PATH
   ════════════════════════════════════════ */

/**
 * verifyPayment
 * Verifies Razorpay payment signature using HMAC-SHA256.
 * Only marks appointment as CONFIRMED + PAID after verification succeeds.
 *
 * Prevents:
 *  - Replay attacks (checks orderId wasn't already verified)
 *  - Signature forgery (cryptographic HMAC)
 *  - Cross-appointment payment (verifies orderId matches)
 */
const verifyPayment = async (appointmentId, patientId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError('Missing payment verification parameters.', 400);
  }

  /* ── Pre-flight checks: ownership + orderId + already-paid (non-atomic reads are fine
     here because these are guard rails before the HMAC check, which is the real
     security gate. The atomic write below is what prevents the TOCTOU race.) ── */
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new AppError('Appointment not found.', 404);

  /* Ownership */
  if (appt.patient.toString() !== patientId.toString()) {
    logger.warn(`SUSPICIOUS: Payment verification attempted by non-owner. Patient: ${patientId}, Appointment: ${appointmentId}`);
    throw new AppError('Unauthorised payment verification attempt.', 403);
  }

  /* Replay attack prevention — orderId must match what we created */
  if (appt.orderId !== razorpay_order_id) {
    logger.warn(`SUSPICIOUS: orderId mismatch. Expected: ${appt.orderId}, Received: ${razorpay_order_id}`, { appointmentId, patientId });
    throw new AppError('Invalid payment order. Possible replay attack detected.', 400);
  }

  /* Already paid — fast idempotency return */
  if (appt.paymentStatus === 'paid') {
    logger.warn(`Duplicate payment verification attempt for already-paid appointment: ${appointmentId}`);
    return { appointment: appt, alreadyPaid: true };
  }

  /* ── HMAC-SHA256 signature verification — must happen BEFORE the atomic write ── */
  const secret      = process.env.RAZORPAY_KEY_SECRET;
  const body        = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

  const expectedSigBuf = Buffer.from(expectedSig, 'utf8');
  const givenSigBuf     = Buffer.from(String(razorpay_signature || ''), 'utf8');
  const signatureValid  = expectedSigBuf.length === givenSigBuf.length &&
    crypto.timingSafeEqual(expectedSigBuf, givenSigBuf);

  if (!signatureValid) {
    logger.warn(`SUSPICIOUS: Payment signature mismatch for appointment ${appointmentId}. Possible fraud.`, {
      appointmentId, patientId, razorpay_order_id, razorpay_payment_id,
    });
    /* Mark payment as failed — use findOneAndUpdate to avoid clobbering a concurrent write */
    await Appointment.findOneAndUpdate(
      { _id: appointmentId, paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'failed', paymentFailReason: 'Signature verification failed' } }
    );
    throw new AppError('Payment verification failed. Invalid signature.', 400);
  }

  /* ✅ Signature verified — ATOMIC conditional update to prevent TOCTOU race.
     The filter includes paymentStatus: { $ne: 'paid' } so only ONE concurrent
     request can succeed. Any duplicate call will get null back and be handled below. */
  const hashedSig = crypto.createHash('sha256').update(razorpay_signature).digest('hex');
  const updated = await Appointment.findOneAndUpdate(
    {
      _id:           appointmentId,
      patient:       patientId,
      orderId:       razorpay_order_id,
      paymentStatus: { $ne: 'paid' },      // atomic guard — only one writer wins
      status:        { $ne: 'cancelled' }, // never revive a cancelled appointment
    },
    {
      $set: {
        paymentStatus:    'paid',
        paymentId:        razorpay_payment_id,
        signature:        hashedSig,  // stored hashed (select: false in schema)
        paymentTimestamp: new Date(),
        status:           'confirmed',
        isPaid:           true,
      },
    },
    { new: true }
  );

  /* null means already paid (race lost), cancelled concurrently, or mismatched filter */
  if (!updated) {
    const latest = await Appointment.findById(appointmentId);

    if (latest && latest.status === 'cancelled') {
      /* The patient cancelled between order creation and this verify call, but
         Razorpay genuinely captured the payment (signature above is valid).
         Never confirm — record the capture and auto-refund via the existing
         refund pipeline instead. */
      await markCapturedPaymentForRefund(appointmentId, razorpay_payment_id, 'payment_captured_after_cancellation');
      throw new AppError('This appointment has already been cancelled. Your payment will be automatically refunded.', 400);
    }

    logger.warn(`Concurrent payment verification: appointment ${appointmentId} already processed.`);
    return { appointment: latest, alreadyPaid: true };
  }

  /* Populate for notifications */
  await updated.populate([
    { path: 'patient', select: 'name email' },
    { path: 'doctor',  select: 'name email' },
  ]);

  logger.info(`✅ Payment verified: ${razorpay_payment_id} | Appointment: ${appointmentId} | ₹${(updated.amount / 100).toFixed(2)}`);

  /* Notify patient (via queue, or inline if no Redis) */
  enqueueNotification({
    recipientId: updated.patient._id,
    type:    'payment_confirmed',
    title:   '✅ Payment Confirmed',
    message: `Your payment of ₹${(updated.amount / 100).toFixed(2)} for your appointment with Dr. ${updated.doctor.name} is confirmed.`,
    data:    { appointmentId: updated._id },
    link:    '/appointments',
  }).catch(() => {});

  /* Notify doctor (via queue, or inline if no Redis) */
  enqueueNotification({
    recipientId: updated.doctor._id,
    type:    'appointment_confirmed',
    title:   '💰 Appointment Paid',
    message: `${updated.patient.name} has paid ₹${(updated.amount / 100).toFixed(2)} for their ${updated.consultationType} consultation.`,
    data:    { appointmentId: updated._id },
    link:    '/doctor/dashboard',
  }).catch(() => {});

  return { appointment: updated, alreadyPaid: false };
};

/* ════════════════════════════════════════
   CAPTURED-AFTER-CANCELLATION RECONCILIATION
   ════════════════════════════════════════ */

/**
 * markCapturedPaymentForRefund
 * Shared helper for both verifyPayment() and the Razorpay webhook: a payment
 * was genuinely captured by Razorpay (HMAC signature verified, or the webhook
 * itself is the trusted source) for an appointment that has since been
 * cancelled. We must never confirm the appointment — instead we record the
 * capture on the ledger and hand off to the existing refund pipeline
 * (enqueueRefund → BullMQ arogyaai-refund queue → processRefundJob).
 *
 * Atomic + idempotent: the guarded findOneAndUpdate only succeeds once
 * (status:'cancelled', paymentStatus:{$ne:'paid'}), so calling this twice for
 * the same appointment (verify() losing a race AND the webhook firing) is
 * safe — the second call is a no-op and enqueueRefund's own deterministic
 * jobId additionally prevents a duplicate refund job either way.
 */
const markCapturedPaymentForRefund = async (appointmentId, paymentId, reason) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) {
    logger.warn(`[Payment] markCapturedPaymentForRefund: appointment ${appointmentId} not found.`);
    return null;
  }

  const refundAmount = appt.totalAmount || appt.consultationFee || appt.fee || 0;

  const captured = await Appointment.findOneAndUpdate(
    { _id: appointmentId, status: 'cancelled', paymentStatus: { $ne: 'paid' } },
    {
      $set: {
        paymentStatus:    'paid',
        paymentId,
        paymentTimestamp: new Date(),
        refundStatus:     'initiated',
        refundAmount,
      },
    },
    { new: true }
  );

  if (!captured) {
    logger.info(`[Payment] Captured-after-cancel reconciliation for ${appointmentId} was already handled — skipping duplicate refund enqueue.`);
    return null;
  }

  logger.warn(`[Payment] Payment captured on cancelled appointment ${appointmentId} (paymentId=${paymentId}) — refund auto-enqueued.`);

  enqueueRefund({ appointmentId: captured._id.toString(), reason }).catch((err) =>
    logger.warn(`Refund enqueue failed for captured-after-cancel appointment ${appointmentId}: ${err.message}`)
  );

  return captured;
};

/* ════════════════════════════════════════
   PROCESS REFUND JOB — called by the refund worker (BullMQ) or,
   when REDIS_URL is not configured, inline from queues/index.js
   ════════════════════════════════════════ */

/**
 * processRefundJob
 * Idempotent refund processor: verifies the refund hasn't already been
 * processed, calls the Razorpay Refund API, and updates the appointment
 * ONLY after a successful Razorpay response.
 *
 * Idempotency:
 *  - Re-fetches the appointment fresh (never trusts stale job payload data).
 *  - No-ops if refundStatus is already 'processed'.
 *  - The final DB write is an atomic findOneAndUpdate guarded by
 *    `refundStatus: { $ne: 'processed' }`, so a duplicate/racing call can
 *    never double-apply the refunded state.
 *  - If Razorpay itself reports the payment as already fully refunded
 *    (e.g. a previous attempt succeeded but this process crashed before
 *    persisting that fact), we reconcile locally instead of refunding again.
 *
 * Failure handling:
 *  - Permanent conditions (missing paymentId, zero refund amount) are
 *    resolved without calling Razorpay and WITHOUT throwing (no point
 *    retrying a condition that can't change).
 *  - Transient Razorpay/network errors are rethrown so the caller's retry
 *    mechanism (BullMQ exponential backoff) can retry the job. refundStatus
 *    is only flipped to 'failed' by the caller once retries are exhausted
 *    (see queues/workers/refund.worker.js) — an in-flight retryable attempt
 *    does not touch refundStatus.
 *
 * @param {{ appointmentId: string, reason?: string }} payload
 */
const processRefundJob = async ({ appointmentId, reason }) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) {
    logger.warn(`[Refund] Appointment ${appointmentId} not found — skipping.`);
    return;
  }

  if (appt.refundStatus === 'processed') {
    logger.info(`[Refund] Appointment ${appointmentId} already refunded — skipping (idempotent).`);
    return;
  }

  if (appt.paymentStatus !== 'paid' && appt.paymentStatus !== 'refunded') {
    logger.warn(`[Refund] Appointment ${appointmentId} paymentStatus=${appt.paymentStatus} — nothing to refund.`);
    return;
  }

  if (!appt.paymentId) {
    await Appointment.findOneAndUpdate(
      { _id: appt._id, refundStatus: { $ne: 'processed' } },
      { $set: { refundStatus: 'failed', refundFailReason: 'No Razorpay payment ID on record.' } }
    );
    logger.error(`[Refund] Appointment ${appointmentId} has no paymentId — cannot refund. Marked failed.`);
    return;
  }

  if (!appt.refundAmount || appt.refundAmount <= 0) {
    /* Nothing owed (e.g. 0% cancellation-policy tier) — no Razorpay call needed. */
    await Appointment.findOneAndUpdate(
      { _id: appt._id, refundStatus: { $ne: 'processed' } },
      { $set: { refundStatus: 'processed' } }
    );
    logger.info(`[Refund] Appointment ${appointmentId} refundAmount=0 — marked processed, no Razorpay call.`);
    return;
  }

  const rzp        = getRazorpay();
  const amountPaise = Math.round(appt.refundAmount * 100);

  let refund;
  try {
    refund = await rzp.payments.refund(appt.paymentId, {
      amount: amountPaise,
      speed:  'normal',
      notes:  { appointmentId: appt._id.toString(), reason: reason || 'appointment_cancelled' },
    });
  } catch (err) {
    const desc = err?.error?.description || err.message || '';

    /* Razorpay reports this payment as already (fully) refunded — most likely
       a previous attempt succeeded at Razorpay but crashed before our DB write
       completed. Reconcile locally instead of attempting a duplicate refund. */
    if (/already.*refund|fully refunded/i.test(desc)) {
      await Appointment.findOneAndUpdate(
        { _id: appt._id, refundStatus: { $ne: 'processed' } },
        { $set: { refundStatus: 'processed', paymentStatus: 'refunded', refundProcessedAt: new Date() } }
      );
      logger.warn(`[Refund] Razorpay reports appointment ${appointmentId} already refunded — reconciled idempotently.`);
      return;
    }

    logger.error(`[Refund] Razorpay refund call failed for appointment ${appointmentId}: ${desc}`);
    throw err; // transient/unknown — let the caller retry
  }

  /* ✅ Razorpay confirmed the refund — ATOMIC guarded update.
     DB is updated ONLY after a successful Razorpay response, and only if
     this appointment hasn't already been marked processed by a concurrent call. */
  const updated = await Appointment.findOneAndUpdate(
    { _id: appt._id, refundStatus: { $ne: 'processed' } },
    {
      $set: {
        refundStatus:      'processed',
        paymentStatus:     'refunded',
        refundId:          refund.id,
        refundProcessedAt: new Date(),
        refundFailReason:  null,
      },
    },
    { new: true }
  );

  if (!updated) {
    logger.info(`[Refund] Appointment ${appointmentId} was already marked processed by a concurrent call.`);
    return;
  }

  logger.info(`[Refund] ✅ Refund processed for appointment ${appointmentId}: refundId=${refund.id}, amount=₹${appt.refundAmount}`);

  /* Notify patient (non-blocking) */
  enqueueNotification({
    recipientId: updated.patient,
    type:        'refund_processed',
    title:       '💸 Refund Processed',
    message:     `Your refund of ₹${appt.refundAmount.toLocaleString('en-IN')} has been processed.`,
    data:        { appointmentId: updated._id },
    link:        '/appointments',
  }).catch(() => {});
};

/* ════════════════════════════════════════
   RETRY PAYMENT
   ════════════════════════════════════════ */

/**
 * retryPayment
 * Creates a new Razorpay order for an appointment with failed/pending payment.
 * Does NOT create a duplicate appointment.
 */
const retryPayment = async (appointmentId, patientId) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new AppError('Appointment not found.', 404);

  if (appt.patient.toString() !== patientId.toString()) {
    throw new AppError('Unauthorised retry attempt.', 403);
  }

  /* Cancelled appointments must never be payable again */
  if (appt.status === 'cancelled') {
    throw new AppError('Cannot retry payment for a cancelled appointment.', 400);
  }

  if (appt.paymentStatus === 'paid') {
    throw new AppError('This appointment is already paid.', 400);
  }

  if (['cancelled', 'refunded'].includes(appt.paymentStatus)) {
    throw new AppError(`Cannot retry payment for a ${appt.paymentStatus} appointment.`, 400);
  }

  /* Reset payment failure state atomically — guarded so a concurrent
     cancellation/payment between the checks above and this write can never
     be silently overwritten. */
  const reset = await Appointment.findOneAndUpdate(
    {
      _id:           appointmentId,
      patient:       patientId,
      status:        { $ne: 'cancelled' },
      paymentStatus: { $nin: ['paid', 'cancelled', 'refunded'] },
    },
    { $set: { paymentStatus: 'pending', paymentFailReason: null, orderId: null } },
    { new: true }
  );

  if (!reset) {
    throw new AppError('Cannot retry payment — this appointment\'s state changed. Please refresh and try again.', 400);
  }

  /* Create a fresh order */
  return createPaymentOrder(appointmentId, patientId);
};

/* ════════════════════════════════════════
   DOCTOR EARNINGS
   ════════════════════════════════════════ */

/**
 * getDoctorEarnings
 * Calculate earnings for a doctor (today / week / month).
 *
 * Previous: 3 separate aggregate() calls + 1 countDocuments() = 4 round-trips.
 * Now: 1 aggregate with $facet (today/week/month in parallel branches) +
 *      1 countDocuments() = 2 round-trips.
 * The doctor_earnings index { doctor, paymentStatus, paymentTimestamp } covers all branches.
 */
const getDoctorEarnings = async (doctorId) => {
  const now      = new Date();

  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);

  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const doctorOid = new mongoose.Types.ObjectId(String(doctorId));

  const [facetResult, totalCompleted] = await Promise.all([
    Appointment.aggregate([
      /* Pre-filter to this doctor's paid appointments within the widest window (this month).
         The compound index on { doctor, paymentStatus, paymentTimestamp } makes this efficient. */
      {
        $match: {
          doctor:           doctorOid,
          paymentStatus:    'paid',
          paymentTimestamp: { $gte: monthStart },
        },
      },
      {
        $facet: {
          today: [
            { $match: { paymentTimestamp: { $gte: todayStart, $lte: todayEnd } } },
            { $group: { _id: null, total: { $sum: '$consultationFee' }, count: { $sum: 1 } } },
          ],
          week: [
            { $match: { paymentTimestamp: { $gte: weekStart } } },
            { $group: { _id: null, total: { $sum: '$consultationFee' }, count: { $sum: 1 } } },
          ],
          month: [
            { $group: { _id: null, total: { $sum: '$consultationFee' }, count: { $sum: 1 } } },
          ],
        },
      },
    ]),
    Appointment.countDocuments({ doctor: doctorId, status: 'completed' }),
  ]);

  const f = facetResult[0] || {};

  return {
    today:  { amount: f.today?.[0]?.total  || 0, count: f.today?.[0]?.count  || 0 },
    week:   { amount: f.week?.[0]?.total   || 0, count: f.week?.[0]?.count   || 0 },
    month:  { amount: f.month?.[0]?.total  || 0, count: f.month?.[0]?.count  || 0 },
    totalCompleted,
  };
};

/* ════════════════════════════════════════
   INVOICE PDF GENERATION
   ════════════════════════════════════════ */

/**
 * generateInvoicePDF
 * Returns a Buffer of the PDF invoice for the given appointment.
 */
const generateInvoicePDF = (appt) => {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accentColor  = '#4F46E5';  // indigo
    const textColor    = '#1F2937';
    const subtextColor = '#6B7280';
    const lineColor    = '#E5E7EB';

    /* ── Header ── */
    doc.rect(0, 0, doc.page.width, 90).fill(accentColor);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('ArogyaAI', 50, 28);
    doc.fontSize(10).font('Helvetica').text('Healthcare Consultation Platform', 50, 54);
    doc.fillColor('white').fontSize(10).text(`INVOICE`, doc.page.width - 130, 28);
    doc.fillColor('white').fontSize(10).text(`#${appt.invoiceNumber || 'N/A'}`, doc.page.width - 130, 44);

    let y = 110;

    /* ── Bill To / From ── */
    doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold').text('BILL TO', 50, y);
    doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold').text('DOCTOR', 320, y);
    y += 18;

    doc.fillColor(textColor).fontSize(10).font('Helvetica')
      .text(appt.patient?.name || 'Patient', 50, y)
      .text(`Dr. ${appt.doctor?.name || 'Doctor'}`, 320, y);
    y += 14;
    doc.fillColor(subtextColor).fontSize(9)
      .text(appt.patient?.email || '', 50, y)
      .text(appt.doctor?.doctorProfile?.specialization || '', 320, y);
    y += 14;
    doc.fillColor(subtextColor).fontSize(9)
      .text(appt.patient?.phone || '', 50, y)
      .text(appt.doctor?.doctorProfile?.hospital || '', 320, y);

    y += 30;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(lineColor).stroke();
    y += 20;

    /* ── Appointment Details ── */
    doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold').text('APPOINTMENT DETAILS', 50, y);
    y += 18;

    const details = [
      ['Appointment ID',   appt._id?.toString() || ''],
      ['Date',             appt.date ? format(new Date(appt.date), 'EEEE, MMMM d, yyyy') : ''],
      ['Time',             appt.time || ''],
      ['Consultation Type', (appt.consultationType || 'clinic').toUpperCase()],
      ['Duration',         `${appt.duration || 30} minutes`],
    ];

    details.forEach(([label, val]) => {
      doc.fillColor(subtextColor).fontSize(9).font('Helvetica').text(label + ':', 50, y, { width: 180 });
      doc.fillColor(textColor).fontSize(9).text(val, 250, y);
      y += 16;
    });

    y += 15;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(lineColor).stroke();
    y += 20;

    /* ── Fee Breakdown Table ── */
    doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold').text('FEE BREAKDOWN', 50, y);
    y += 18;

    // Table header
    doc.rect(50, y, doc.page.width - 100, 22).fill('#F3F4F6');
    doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold')
      .text('Description', 58, y + 6)
      .text('Amount', doc.page.width - 130, y + 6);
    y += 22;

    // Rows
    const feeRows = [
      ['Consultation Fee', `₹${(appt.consultationFee || 0).toLocaleString('en-IN')}`],
      ['Platform Fee',     `₹${(appt.platformFee || 0).toLocaleString('en-IN')}`],
      ['Tax',              `₹${(appt.taxAmount || 0).toLocaleString('en-IN')}`],
      ['Discount',         appt.discountAmount ? `-₹${appt.discountAmount.toLocaleString('en-IN')}` : '₹0'],
    ];

    feeRows.forEach(([desc, amt], i) => {
      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 18).fill('#FAFAFA');
      doc.fillColor(textColor).fontSize(9).font('Helvetica')
        .text(desc, 58, y + 4)
        .text(amt, doc.page.width - 130, y + 4);
      y += 18;
    });

    // Total row
    doc.rect(50, y, doc.page.width - 100, 26).fill(accentColor);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
      .text('GRAND TOTAL', 58, y + 7)
      .text(`₹${(appt.totalAmount || appt.consultationFee || 0).toLocaleString('en-IN')}`, doc.page.width - 130, y + 7);
    y += 36;

    /* ── Payment Info ── */
    y += 10;
    doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold').text('PAYMENT INFORMATION', 50, y);
    y += 18;

    const payInfo = [
      ['Payment Status',  (appt.paymentStatus || 'pending').toUpperCase()],
      ['Payment ID',      appt.paymentId || 'N/A'],
      ['Payment Date',    appt.paymentTimestamp ? format(new Date(appt.paymentTimestamp), 'MMM d, yyyy HH:mm') : 'N/A'],
      ['Payment Method',  appt.paymentMethod || 'Razorpay'],
      ['Receipt No.',     appt.receiptNumber || 'N/A'],
    ];

    payInfo.forEach(([label, val]) => {
      doc.fillColor(subtextColor).fontSize(9).font('Helvetica').text(label + ':', 50, y, { width: 180 });
      doc.fillColor(textColor).fontSize(9).text(val, 250, y);
      y += 16;
    });

    /* ── Footer ── */
    const footerY = doc.page.height - 70;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor(lineColor).stroke();
    doc.fillColor(subtextColor).fontSize(8).font('Helvetica')
      .text('ArogyaAI — AI-Powered Healthcare Platform', 50, footerY + 10, { align: 'center', width: doc.page.width - 100 })
      .text('This is a computer-generated invoice and does not require a signature.', 50, footerY + 22, { align: 'center', width: doc.page.width - 100 })
      .text(`Generated on ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 50, footerY + 34, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  });
};

/* ════════════════════════════════════════
   RECEIPT PDF GENERATION
   ════════════════════════════════════════ */

/**
 * generateReceiptPDF
 * Returns a Buffer of the payment receipt PDF.
 */
const generateReceiptPDF = (appt) => {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accentColor = '#10B981'; // emerald for receipt
    const textColor   = '#1F2937';
    const lineColor   = '#E5E7EB';

    /* Header */
    doc.rect(0, 0, doc.page.width, 75).fill(accentColor);
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('ArogyaAI', 40, 20);
    doc.fillColor('white').fontSize(9).font('Helvetica').text('PAYMENT RECEIPT', 40, 42);
    doc.fillColor('white').fontSize(9).text(`#${appt.receiptNumber || 'N/A'}`, doc.page.width - 130, 42);

    let y = 95;

    /* Success badge */
    doc.rect(doc.page.width / 2 - 60, y, 120, 28).fill('#D1FAE5').strokeColor('#10B981').stroke();
    doc.fillColor('#065F46').fontSize(11).font('Helvetica-Bold')
      .text('✅ PAYMENT SUCCESSFUL', doc.page.width / 2 - 55, y + 7);
    y += 48;

    const details = [
      ['Patient',           appt.patient?.name || ''],
      ['Doctor',            `Dr. ${appt.doctor?.name || ''}`],
      ['Consultation',      (appt.consultationType || 'clinic').toUpperCase()],
      ['Date & Time',       appt.date ? `${format(new Date(appt.date), 'MMM d, yyyy')} at ${appt.time}` : ''],
      ['Amount Paid',       `₹${(appt.totalAmount || appt.consultationFee || 0).toLocaleString('en-IN')}`],
      ['Payment ID',        appt.paymentId || 'N/A'],
      ['Paid On',           appt.paymentTimestamp ? format(new Date(appt.paymentTimestamp), 'MMM d, yyyy HH:mm') : 'N/A'],
    ];

    details.forEach(([label, val]) => {
      doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor(lineColor).lineWidth(0.5).stroke();
      y += 8;
      doc.fillColor('#6B7280').fontSize(8).font('Helvetica').text(label, 40, y);
      doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold').text(val, 200, y);
      y += 20;
    });

    /* Footer */
    const footerY = doc.page.height - 50;
    doc.fillColor('#6B7280').fontSize(7)
      .text('Thank you for choosing ArogyaAI for your healthcare needs.', 40, footerY, { align: 'center', width: doc.page.width - 80 })
      .text(`Generated on ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 40, footerY + 12, { align: 'center', width: doc.page.width - 80 });

    doc.end();
  });
};

/* ════════════════════════════════════════
   RAZORPAY WEBHOOK RECONCILIATION
   Called by controllers/webhook.controller.js AFTER signature verification
   and idempotency-ledger dedup have already passed.
   ════════════════════════════════════════ */

/**
 * handlePaymentCapturedWebhook
 * Reconciles a `payment.captured` event against our appointment ledger.
 * This is the safety net for when the frontend never called verifyPayment()
 * (browser closed, network drop, etc.) — it independently confirms the
 * appointment using the same atomic guard shape as verifyPayment(), or
 * routes to the refund pipeline if the appointment was already cancelled.
 */
const handlePaymentCapturedWebhook = async (paymentEntity) => {
  if (!paymentEntity) return;
  const paymentId = paymentEntity.id;
  const orderId   = paymentEntity.order_id;
  const appointmentId = paymentEntity.notes?.appointmentId;

  if (!appointmentId) {
    logger.warn(`[Webhook] payment.captured missing appointmentId in notes (paymentId=${paymentId}) — cannot reconcile.`);
    return;
  }

  const appt = await Appointment.findById(appointmentId);
  if (!appt) {
    logger.warn(`[Webhook] payment.captured references unknown appointment ${appointmentId}.`);
    return;
  }

  if (appt.status === 'cancelled') {
    await markCapturedPaymentForRefund(appointmentId, paymentId, 'webhook_payment_captured_after_cancellation');
    return;
  }

  if (appt.paymentStatus === 'paid') {
    logger.info(`[Webhook] Appointment ${appointmentId} already paid — payment.captured is a no-op (idempotent).`);
    return;
  }

  /* Atomic guarded confirm — identical shape to verifyPayment()'s success path. */
  const updated = await Appointment.findOneAndUpdate(
    {
      _id:           appointmentId,
      orderId,
      paymentStatus: { $ne: 'paid' },
      status:        { $ne: 'cancelled' },
    },
    {
      $set: {
        paymentStatus:    'paid',
        paymentId,
        paymentTimestamp: new Date(),
        status:           'confirmed',
        isPaid:           true,
      },
    },
    { new: true }
  ).populate([
    { path: 'patient', select: 'name email' },
    { path: 'doctor',  select: 'name email' },
  ]);

  if (!updated) {
    logger.info(`[Webhook] Appointment ${appointmentId} payment.captured raced with another writer — skipped (already reconciled).`);
    return;
  }

  logger.info(`[Webhook] ✅ Appointment ${appointmentId} confirmed via webhook reconciliation (paymentId=${paymentId}).`);

  /* Only sent when this call is the one that actually flipped the state —
     prevents duplicate notifications on a duplicate/retried webhook event. */
  enqueueNotification({
    recipientId: updated.patient._id,
    type:    'payment_confirmed',
    title:   '✅ Payment Confirmed',
    message: `Your payment of ₹${(updated.amount / 100).toFixed(2)} for your appointment with Dr. ${updated.doctor.name} is confirmed.`,
    data:    { appointmentId: updated._id },
    link:    '/appointments',
  }).catch(() => {});

  enqueueNotification({
    recipientId: updated.doctor._id,
    type:    'appointment_confirmed',
    title:   '💰 Appointment Paid',
    message: `${updated.patient.name} has paid ₹${(updated.amount / 100).toFixed(2)} for their ${updated.consultationType} consultation.`,
    data:    { appointmentId: updated._id },
    link:    '/doctor/dashboard',
  }).catch(() => {});
};

/**
 * handleRefundProcessedWebhook
 * Reconciles a `refund.processed` event — this is the source of truth for
 * refunds initiated outside our own pipeline (e.g. manually via the Razorpay
 * dashboard), and a confirmation for refunds we did enqueue ourselves.
 */
const handleRefundProcessedWebhook = async (refundEntity) => {
  if (!refundEntity) return;
  const refundId      = refundEntity.id;
  const paymentId     = refundEntity.payment_id;
  const appointmentId = refundEntity.notes?.appointmentId;

  const filter = appointmentId ? { _id: appointmentId } : { paymentId };

  const updated = await Appointment.findOneAndUpdate(
    { ...filter, refundStatus: { $ne: 'processed' } },
    {
      $set: {
        refundStatus:      'processed',
        paymentStatus:     'refunded',
        refundProcessedAt: new Date(),
        refundId,
        refundFailReason:  null,
      },
    },
    { new: true }
  );

  if (!updated) {
    logger.info(`[Webhook] refund.processed for refundId=${refundId} — already processed or appointment not found (idempotent).`);
    return;
  }

  logger.info(`[Webhook] ✅ Refund reconciled as processed: refundId=${refundId}, appointment=${updated._id}`);

  enqueueNotification({
    recipientId: updated.patient,
    type:        'refund_processed',
    title:       '💸 Refund Processed',
    message:     `Your refund of ₹${(updated.refundAmount || 0).toLocaleString('en-IN')} has been processed.`,
    data:        { appointmentId: updated._id },
    link:        '/appointments',
  }).catch(() => {});
};

/**
 * handleRefundFailedWebhook
 * Reconciles a `refund.failed` event so support/finance can see the failure
 * without waiting for BullMQ's own retry-exhaustion handler.
 */
const handleRefundFailedWebhook = async (refundEntity) => {
  if (!refundEntity) return;
  const paymentId     = refundEntity.payment_id;
  const appointmentId = refundEntity.notes?.appointmentId;
  const reason        = (refundEntity.error_description || refundEntity.status || 'Refund failed').toString().slice(0, 300);

  const filter = appointmentId ? { _id: appointmentId } : { paymentId };

  const updated = await Appointment.findOneAndUpdate(
    { ...filter, refundStatus: { $ne: 'processed' } },
    { $set: { refundStatus: 'failed', refundFailReason: reason } },
    { new: true }
  );

  if (!updated) {
    logger.info(`[Webhook] refund.failed — already processed or appointment not found (idempotent), payment=${paymentId}`);
    return;
  }

  logger.warn(`[Webhook] Refund reconciled as failed for appointment ${updated._id}: ${reason}`);
};

/**
 * processWebhookEvent
 * Entry point called by controllers/webhook.controller.js after signature
 * verification and the WebhookEvent idempotency claim have both succeeded.
 */
const processWebhookEvent = async (event) => {
  switch (event?.event) {
    case 'payment.captured':
      return handlePaymentCapturedWebhook(event.payload?.payment?.entity);
    case 'refund.processed':
      return handleRefundProcessedWebhook(event.payload?.refund?.entity);
    case 'refund.failed':
      return handleRefundFailedWebhook(event.payload?.refund?.entity);
    default:
      logger.info(`[Webhook] Unhandled event type: ${event?.event} — ignored.`);
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  retryPayment,
  getDoctorEarnings,
  generateInvoicePDF,
  generateReceiptPDF,
  processRefundJob,
  markCapturedPaymentForRefund,
  processWebhookEvent,
  handlePaymentCapturedWebhook,
  handleRefundProcessedWebhook,
  handleRefundFailedWebhook,
};
