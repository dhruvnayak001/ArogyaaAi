/**
 * __tests__/payment.test.js
 *
 * Comprehensive tests for payment.service:
 *   - Razorpay HMAC-SHA256 signature verification (correct / tampered / missing)
 *   - Duplicate webhook / already-paid idempotency
 *   - Payment race condition (atomic findOneAndUpdate returns null)
 *   - Refund state transitions on cancelAppointment (appointment.service)
 *   - orderId mismatch (replay attack detection)
 *   - Ownership guard
 */

'use strict';

jest.mock('../models/Appointment.model');
jest.mock('../services/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../utils/sendEmail', () => ({
  sendEmail:  jest.fn().mockResolvedValue({}),
  templates:  { appointmentCancelled: jest.fn().mockReturnValue({ subject: '', html: '' }) },
}));
jest.mock('../config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
/* Replace the real queues module — otherwise the new enqueueRefund() inline
   fallback (no REDIS_URL in test env) would call the real processRefundJob,
   which would try to hit the real Razorpay SDK. */
jest.mock('../queues', () => ({
  enqueueEmail:        jest.fn().mockResolvedValue({}),
  enqueueNotification: jest.fn().mockResolvedValue({}),
  enqueueRefund:       jest.fn().mockResolvedValue({}),
}));

const crypto      = require('crypto');
const Appointment = require('../models/Appointment.model');
const { enqueueRefund } = require('../queues');
const paySvc      = require('../services/payment.service');
const apptSvc     = require('../services/appointment.service');

/* ── helpers ─────────────────────────────────────────────────────────────── */

const SECRET    = 'test_razorpay_secret_32chars_min!';
const ORDER_ID  = 'order_ABCDEFGH';
const PAY_ID    = 'pay_XYZ123';
const APPT_ID   = 'appt_111';
const PATIENT_ID = 'patient_AAA';

/** Compute the correct HMAC exactly as Razorpay does. */
const makeHmac = (orderId, paymentId, secret = SECRET) =>
  crypto.createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

/** Base pending appointment stub returned by Appointment.findById. */
const pendingAppt = () => ({
  _id:           APPT_ID,
  patient:       PATIENT_ID,
  orderId:       ORDER_ID,
  paymentStatus: 'pending',
  amount:        50000,       // 500 INR in paise
  toString:      () => PATIENT_ID,
});

/** Stub returned after successful atomic update (populate chained). */
const paidApptPopulated = () => ({
  _id:           APPT_ID,
  patient:       { _id: PATIENT_ID, name: 'Test Patient', email: 'p@test.com' },
  doctor:        { _id: 'doctor_BBB', name: 'Dr. Smith', email: 'd@test.com' },
  amount:        50000,
  paymentStatus: 'paid',
  consultationType: 'clinic',
  populate:      jest.fn().mockResolvedValue(undefined),
});

/* ════════════════════════════════════════════════════════════════════════════
   1. HMAC SIGNATURE VERIFICATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('payment.service — HMAC signature verification', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    jest.clearAllMocks();
  });

  it('accepts a correct HMAC-SHA256 signature and marks appointment paid', async () => {
    const sig     = makeHmac(ORDER_ID, PAY_ID);
    const updated = paidApptPopulated();

    Appointment.findById        = jest.fn().mockResolvedValue(pendingAppt());
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue(updated);

    const result = await paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
      razorpay_order_id:   ORDER_ID,
      razorpay_payment_id: PAY_ID,
      razorpay_signature:  sig,
    });

    expect(result.alreadyPaid).toBe(false);
    expect(Appointment.findOneAndUpdate).toHaveBeenCalledTimes(1);

    /* Verify the atomic update sets all required payment fields */
    const [filter, update] = Appointment.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: APPT_ID, paymentStatus: { $ne: 'paid' } });
    expect(update.$set).toMatchObject({
      paymentStatus: 'paid',
      paymentId:     PAY_ID,
      status:        'confirmed',
      isPaid:        true,
    });
    /* Signature must be stored HASHED, not raw */
    expect(update.$set.signature).not.toBe(sig);
    expect(update.$set.signature).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('rejects a tampered signature with 400', async () => {
    const wrongSig = makeHmac(ORDER_ID, PAY_ID).replace(/^./, 'f');

    Appointment.findById        = jest.fn().mockResolvedValue(pendingAppt());
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue(null);

    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id:   ORDER_ID,
        razorpay_payment_id: PAY_ID,
        razorpay_signature:  wrongSig,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: /signature/i });

    /* Failed attempt must mark paymentStatus = 'failed' */
    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: APPT_ID, paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'failed', paymentFailReason: expect.any(String) } }
    );
  });

  it('rejects a valid sig for wrong orderId (cross-payment replay)', async () => {
    /* Signature is valid for a DIFFERENT order */
    const sigForOtherOrder = makeHmac('order_DIFFERENT', PAY_ID);

    Appointment.findById = jest.fn().mockResolvedValue(pendingAppt()); // orderId = ORDER_ID

    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id:   'order_DIFFERENT',
        razorpay_payment_id: PAY_ID,
        razorpay_signature:  sigForOtherOrder,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: /order|replay/i });
  });

  it('rejects with 400 when any required parameter is missing', async () => {
    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id:   ORDER_ID,
        razorpay_payment_id: PAY_ID,
        // razorpay_signature missing
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {})
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   2. DUPLICATE WEBHOOK / ALREADY-PAID IDEMPOTENCY
   ════════════════════════════════════════════════════════════════════════════ */

describe('payment.service — duplicate webhook protection', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    jest.clearAllMocks();
  });

  it('returns alreadyPaid=true immediately when paymentStatus is already "paid" (fast path)', async () => {
    Appointment.findById = jest.fn().mockResolvedValue({
      ...pendingAppt(),
      paymentStatus: 'paid',
    });

    const sig = makeHmac(ORDER_ID, PAY_ID);
    const result = await paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
      razorpay_order_id:   ORDER_ID,
      razorpay_payment_id: PAY_ID,
      razorpay_signature:  sig,
    });

    expect(result.alreadyPaid).toBe(true);
    /* Must NOT call findOneAndUpdate when already paid */
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not call findOneAndUpdate more than once per verify call (no double-write)', async () => {
    const sig     = makeHmac(ORDER_ID, PAY_ID);
    const updated = paidApptPopulated();

    Appointment.findById        = jest.fn().mockResolvedValue(pendingAppt());
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue(updated);

    await paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
      razorpay_order_id:   ORDER_ID,
      razorpay_payment_id: PAY_ID,
      razorpay_signature:  sig,
    });

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   3. PAYMENT RACE CONDITIONS
   ════════════════════════════════════════════════════════════════════════════ */

describe('payment.service — race condition handling', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    jest.clearAllMocks();
  });

  it('returns alreadyPaid=true when the atomic findOneAndUpdate returns null (race lost)', async () => {
    const sig = makeHmac(ORDER_ID, PAY_ID);

    /* First findById: appointment appears pending (before lock) */
    /* Second findById (fallback after null update): appointment is now paid */
    Appointment.findById = jest.fn()
      .mockResolvedValueOnce(pendingAppt())
      .mockResolvedValueOnce({ ...pendingAppt(), paymentStatus: 'paid' });

    /* Atomic update returns null — another instance won the race */
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue(null);

    const result = await paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
      razorpay_order_id:   ORDER_ID,
      razorpay_payment_id: PAY_ID,
      razorpay_signature:  sig,
    });

    expect(result.alreadyPaid).toBe(true);
    /* findOneAndUpdate was called exactly once — no retry loop */
    expect(Appointment.findOneAndUpdate).toHaveBeenCalledTimes(1);
    /* fallback findById called to read the winner's committed state */
    expect(Appointment.findById).toHaveBeenCalledTimes(2);
  });

  it('two concurrent calls: exactly one succeeds and one returns alreadyPaid=true', async () => {
    const sig = makeHmac(ORDER_ID, PAY_ID);

    /* Simulate two simultaneous in-flight findById calls both seeing "pending" */
    Appointment.findById = jest.fn()
      .mockResolvedValue(pendingAppt());

    const updated = paidApptPopulated();
    let callCount = 0;
    Appointment.findOneAndUpdate = jest.fn().mockImplementation(() => {
      callCount++;
      /* First caller wins (gets the updated doc); second gets null */
      return Promise.resolve(callCount === 1 ? updated : null);
    });

    /* Fallback findById for the loser */
    Appointment.findById
      .mockResolvedValueOnce(pendingAppt())
      .mockResolvedValueOnce(pendingAppt())
      .mockResolvedValueOnce({ ...pendingAppt(), paymentStatus: 'paid' });

    const [res1, res2] = await Promise.all([
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id: ORDER_ID, razorpay_payment_id: PAY_ID, razorpay_signature: sig,
      }),
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id: ORDER_ID, razorpay_payment_id: PAY_ID, razorpay_signature: sig,
      }),
    ]);

    const winners = [res1, res2].filter((r) => !r.alreadyPaid);
    const losers  = [res1, res2].filter((r) =>  r.alreadyPaid);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   4. OWNERSHIP GUARD
   ════════════════════════════════════════════════════════════════════════════ */

describe('payment.service — ownership guard', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    jest.clearAllMocks();
  });

  it('throws 403 when patient ID does not match appointment owner', async () => {
    Appointment.findById = jest.fn().mockResolvedValue({
      ...pendingAppt(),
      patient: 'other_patient_BBB',
    });

    const sig = makeHmac(ORDER_ID, PAY_ID);
    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id:   ORDER_ID,
        razorpay_payment_id: PAY_ID,
        razorpay_signature:  sig,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when appointment does not exist', async () => {
    Appointment.findById = jest.fn().mockResolvedValue(null);

    const sig = makeHmac(ORDER_ID, PAY_ID);
    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id:   ORDER_ID,
        razorpay_payment_id: PAY_ID,
        razorpay_signature:  sig,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   5. REFUND STATE TRANSITIONS (appointment.service.cancelAppointment)
   ════════════════════════════════════════════════════════════════════════════ */

describe('appointment.service — refund state transitions on cancellation', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  /**
   * Build a stub appointment that Appointment.findOne returns.
   * The stub must support: populate(), save(), and field mutation.
   */
  const makeApptStub = (overrides = {}) => {
    const stub = {
      _id:             'appt_cancel_001',
      patient:         PATIENT_ID,
      doctor:          'doctor_DDD',
      date:            new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 h from now
      time:            '10:00',
      status:          'confirmed',
      paymentStatus:   'paid',
      totalAmount:     1000,
      consultationFee: 1000,
      refundStatus:    'none',
      refundAmount:    0,
      cancelledBy:     null,
      cancellationReason: null,
      cancelledAt:     null,
      save:            jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };

    /* populate() mutates the stub in-place (mirroring Mongoose behaviour)
       and returns the document itself — service code does `const patientDoc = await appt.populate(...)`. */
    stub.populate = jest.fn().mockImplementation(async () => {
      stub.patient = { _id: PATIENT_ID, name: 'Test Patient', email: 'p@test.com' };
      stub.doctor  = {
        _id:   'doctor_DDD',
        name:  'Dr. Jones',
        email: 'dr@test.com',
        doctorProfile: {
          cancellationPolicy: stub._cancellationPolicy || {
            moreThan24h:     100,
            between12and24h: 50,
            lessThan12h:     0,
          },
        },
      };
      return stub; // Mongoose returns the document itself from populate()
    });

    return stub;
  };

  it('sets refundStatus=initiated and refundAmount=100% when cancelled >24 h before (default policy)', async () => {
    const stub = makeApptStub({
      date: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 h from now
    });
    Appointment.findOne = jest.fn().mockResolvedValue(stub);

    await apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Test reason');

    expect(stub.refundStatus).toBe('initiated');
    expect(stub.refundAmount).toBe(1000); // 100% of 1000
    expect(stub.save).toHaveBeenCalledTimes(1);
  });

  it('sets refundAmount=50% when cancelled 12–24 h before (between12and24h tier)', async () => {
    const stub = makeApptStub({
      date: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 h from now
    });
    Appointment.findOne = jest.fn().mockResolvedValue(stub);

    await apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Test reason');

    expect(stub.refundStatus).toBe('initiated');
    expect(stub.refundAmount).toBe(500); // 50% of 1000
  });

  it('sets refundAmount=0 when cancelled <12 h before (lessThan12h tier)', async () => {
    const stub = makeApptStub({
      date: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 h from now
    });
    Appointment.findOne = jest.fn().mockResolvedValue(stub);

    await apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Test reason');

    expect(stub.refundStatus).toBe('initiated');
    expect(stub.refundAmount).toBe(0); // 0% of 1000
  });

  it('respects custom doctor cancellation policy percentages', async () => {
    const stub = makeApptStub({
      date:                new Date(Date.now() + 30 * 60 * 60 * 1000), // 30 h away
      _cancellationPolicy: { moreThan24h: 75, between12and24h: 25, lessThan12h: 0 },
    });
    Appointment.findOne = jest.fn().mockResolvedValue(stub);

    await apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Custom policy test');

    expect(stub.refundStatus).toBe('initiated');
    expect(stub.refundAmount).toBe(750); // 75% of 1000
  });

  it('does NOT set refundStatus when appointment was never paid', async () => {
    const stub = makeApptStub({ paymentStatus: 'pending' });
    Appointment.findOne = jest.fn().mockResolvedValue(stub);

    await apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Unpaid cancel');

    expect(stub.refundStatus).toBe('none');    // unchanged
    expect(stub.refundAmount).toBe(0);         // unchanged
  });

  it('throws 400 when appointment is already cancelled', async () => {
    const stub = makeApptStub({ status: 'cancelled' });
    Appointment.findOne = jest.fn().mockResolvedValue(stub);

    await expect(
      apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Already done')
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(stub.save).not.toHaveBeenCalled();
  });

  it('throws 404 when appointment not found', async () => {
    Appointment.findOne = jest.fn().mockResolvedValue(null);

    await expect(
      apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Ghost')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rounds refundAmount to 2 decimal places', async () => {
    const stub = makeApptStub({
      date:            new Date(Date.now() + 48 * 60 * 60 * 1000),
      totalAmount:     999,
      consultationFee: 999,
      _cancellationPolicy: { moreThan24h: 33, between12and24h: 10, lessThan12h: 0 },
    });
    Appointment.findOne = jest.fn().mockResolvedValue(stub);

    await apptSvc.cancelAppointment('appt_cancel_001', PATIENT_ID, 'Decimal test');

    // 33% of 999 = 329.67
    expect(stub.refundAmount).toBe(329.67);
    expect(stub.refundStatus).toBe('initiated');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   6. P0-2 — CANCELLED APPOINTMENTS MUST NEVER BECOME PAYABLE/CONFIRMED AGAIN
   ════════════════════════════════════════════════════════════════════════════ */

describe('payment.service — cancelled-appointment guards (P0-2)', () => {
  /** Mimics a chainable mongoose query: findById(id).populate(...).populate(...) */
  const chainable = (result) => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      then:     (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      catch:    (reject) => Promise.resolve(result).catch(reject),
    };
    return query;
  };

  const cancelledAppt = (overrides = {}) => ({
    _id:           APPT_ID,
    status:        'cancelled',
    paymentStatus: 'pending',
    patient:       { _id: PATIENT_ID, name: 'Test Patient', email: 'p@test.com', phone: '9999999999' },
    doctor:        { _id: 'doctor_BBB', name: 'Dr. Smith', email: 'd@test.com', doctorProfile: {} },
    totalAmount:   1000,
    consultationFee: 1000,
    receiptNumber: 'RCP-TEST',
    ...overrides,
  });

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    jest.clearAllMocks();
  });

  it('createPaymentOrder rejects a cancelled appointment with 400 and never creates a Razorpay order', async () => {
    Appointment.findById = jest.fn().mockReturnValue(chainable(cancelledAppt()));

    await expect(
      paySvc.createPaymentOrder(APPT_ID, PATIENT_ID)
    ).rejects.toMatchObject({ statusCode: 400, message: /cancelled/i });

    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('retryPayment rejects a cancelled appointment with 400 and never creates another order', async () => {
    Appointment.findById = jest.fn().mockResolvedValue({
      ...cancelledAppt(),
      patient: PATIENT_ID, // retryPayment reads appt.patient as a plain id, not populated
      toString: () => PATIENT_ID,
    });

    await expect(
      paySvc.retryPayment(APPT_ID, PATIENT_ID)
    ).rejects.toMatchObject({ statusCode: 400, message: /cancelled/i });

    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('verifyPayment rejects a cancelled appointment — never confirms, never marks paid', async () => {
    const sig = makeHmac(ORDER_ID, PAY_ID);

    Appointment.findById = jest.fn().mockResolvedValue({
      ...pendingAppt(),
      status: 'cancelled',
    });
    /* Atomic confirm attempt fails because the real filter would exclude a
       cancelled appointment (status: {$ne:'cancelled'}) */
    Appointment.findOneAndUpdate = jest.fn()
      .mockResolvedValueOnce(null)                          // confirm attempt
      .mockResolvedValueOnce({ _id: APPT_ID, patient: PATIENT_ID }); // markCapturedPaymentForRefund's write

    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id:   ORDER_ID,
        razorpay_payment_id: PAY_ID,
        razorpay_signature:  sig,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: /cancelled/i });

    /* The confirm-attempt filter must guard against a cancelled appointment
       (so a real cancelled document could never match and be confirmed) */
    const [confirmFilter] = Appointment.findOneAndUpdate.mock.calls[0];
    expect(confirmFilter).toMatchObject({ status: { $ne: 'cancelled' } });
  });

  it('payment captured after cancellation is automatically refunded, never confirmed', async () => {
    const sig = makeHmac(ORDER_ID, PAY_ID);

    /* 1st findById: pre-flight read (verifyPayment).
       2nd findById: re-fetch after the atomic confirm returns null.
       3rd findById: inside markCapturedPaymentForRefund (reads amount). */
    Appointment.findById = jest.fn()
      .mockResolvedValueOnce({ ...pendingAppt(), status: 'cancelled' })
      .mockResolvedValueOnce({ ...pendingAppt(), status: 'cancelled' })
      .mockResolvedValueOnce({ ...pendingAppt(), status: 'cancelled', totalAmount: 1000 });

    const capturedDoc = { _id: APPT_ID, patient: PATIENT_ID, refundStatus: 'initiated' };
    Appointment.findOneAndUpdate = jest.fn()
      .mockResolvedValueOnce(null)          // confirm attempt — excluded by cancelled guard
      .mockResolvedValueOnce(capturedDoc);  // markCapturedPaymentForRefund's guarded write succeeds

    await expect(
      paySvc.verifyPayment(APPT_ID, PATIENT_ID, {
        razorpay_order_id:   ORDER_ID,
        razorpay_payment_id: PAY_ID,
        razorpay_signature:  sig,
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    /* The capture-for-refund write must guard on status:'cancelled' and set
       refundStatus:'initiated' with a computed refundAmount — never 'confirmed'. */
    const [filter, update] = Appointment.findOneAndUpdate.mock.calls[1];
    expect(filter).toMatchObject({ _id: APPT_ID, status: 'cancelled', paymentStatus: { $ne: 'paid' } });
    expect(update.$set).toMatchObject({ paymentStatus: 'paid', paymentId: PAY_ID, refundStatus: 'initiated', refundAmount: 1000 });
    expect(update.$set.status).toBeUndefined();

    /* Refund must be auto-enqueued exactly once — never duplicated */
    expect(enqueueRefund).toHaveBeenCalledTimes(1);
    expect(enqueueRefund).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPT_ID, reason: 'payment_captured_after_cancellation' })
    );
  });
});
