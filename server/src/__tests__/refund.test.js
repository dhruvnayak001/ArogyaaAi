/**
 * __tests__/refund.test.js
 *
 * Tests for payment.service.processRefundJob — the core logic behind the
 * BullMQ refund worker (queues/workers/refund.worker.js) and its inline
 * (no-Redis) fallback in queues/index.js.
 *
 * Covers:
 *   - Idempotency (already processed / missing appointment / not paid)
 *   - Permanent failure conditions resolved without calling Razorpay
 *   - Successful refund → refundStatus=processed, paymentStatus=refunded,
 *     refundId, refundProcessedAt — written ONLY after a successful
 *     Razorpay response
 *   - Reconciliation when Razorpay reports the payment as already refunded
 *   - Transient Razorpay errors are rethrown so the caller (BullMQ) can retry
 *   - Never double-refunds when a concurrent writer already processed it
 */

'use strict';

const mockRefund = jest.fn();

jest.mock('../models/Appointment.model');
jest.mock('../queues', () => ({
  enqueueNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    payments: { refund: mockRefund },
  }))
);

const Appointment = require('../models/Appointment.model');
const paymentSvc  = require('../services/payment.service');

const APPT_ID = 'appt_refund_001';

/** Base paid appointment stub returned by Appointment.findById. */
const paidAppt = (overrides = {}) => ({
  _id:           APPT_ID,
  patient:       'patient_AAA',
  paymentId:     'pay_XYZ123',
  paymentStatus: 'paid',
  refundStatus:  'initiated',
  refundAmount:  500, // rupees
  ...overrides,
});

describe('payment.service.processRefundJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAZORPAY_KEY_ID     = 'rzp_test_id';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret_32chars_min!!';
  });

  it('does nothing when the appointment no longer exists', async () => {
    Appointment.findById = jest.fn().mockResolvedValue(null);

    await paymentSvc.processRefundJob({ appointmentId: APPT_ID });

    expect(mockRefund).not.toHaveBeenCalled();
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent — skips when refundStatus is already "processed"', async () => {
    Appointment.findById = jest.fn().mockResolvedValue(paidAppt({ refundStatus: 'processed' }));

    await paymentSvc.processRefundJob({ appointmentId: APPT_ID });

    expect(mockRefund).not.toHaveBeenCalled();
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('skips when paymentStatus is not paid/refunded (nothing to refund)', async () => {
    Appointment.findById = jest.fn().mockResolvedValue(paidAppt({ paymentStatus: 'pending' }));

    await paymentSvc.processRefundJob({ appointmentId: APPT_ID });

    expect(mockRefund).not.toHaveBeenCalled();
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('marks refundStatus=failed (no retry) when the appointment has no paymentId', async () => {
    Appointment.findById        = jest.fn().mockResolvedValue(paidAppt({ paymentId: null }));
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue({});

    await paymentSvc.processRefundJob({ appointmentId: APPT_ID });

    expect(mockRefund).not.toHaveBeenCalled();
    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: APPT_ID, refundStatus: { $ne: 'processed' } },
      { $set: { refundStatus: 'failed', refundFailReason: expect.any(String) } }
    );
  });

  it('marks refundStatus=processed with no Razorpay call when refundAmount is 0', async () => {
    Appointment.findById        = jest.fn().mockResolvedValue(paidAppt({ refundAmount: 0 }));
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue({});

    await paymentSvc.processRefundJob({ appointmentId: APPT_ID });

    expect(mockRefund).not.toHaveBeenCalled();
    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: APPT_ID, refundStatus: { $ne: 'processed' } },
      { $set: { refundStatus: 'processed' } }
    );
  });

  it('calls Razorpay with the correct paise amount and updates the DB only after success', async () => {
    Appointment.findById = jest.fn().mockResolvedValue(paidAppt({ refundAmount: 329.67 }));
    mockRefund.mockResolvedValue({ id: 'rfnd_ABC123', status: 'processed' });
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: APPT_ID, patient: 'patient_AAA' });

    await paymentSvc.processRefundJob({ appointmentId: APPT_ID, reason: 'patient_cancelled' });

    expect(mockRefund).toHaveBeenCalledWith('pay_XYZ123', expect.objectContaining({
      amount: 32967, // 329.67 * 100, rounded
      notes:  expect.objectContaining({ appointmentId: APPT_ID, reason: 'patient_cancelled' }),
    }));

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: APPT_ID, refundStatus: { $ne: 'processed' } },
      {
        $set: expect.objectContaining({
          refundStatus:      'processed',
          paymentStatus:     'refunded',
          refundId:          'rfnd_ABC123',
          refundProcessedAt: expect.any(Date),
          refundFailReason:  null,
        }),
      },
      { new: true }
    );
  });

  it('reconciles idempotently when Razorpay reports the payment as already refunded', async () => {
    Appointment.findById = jest.fn().mockResolvedValue(paidAppt());
    mockRefund.mockRejectedValue({ error: { description: 'The payment has been fully refunded already' } });
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue({});

    await paymentSvc.processRefundJob({ appointmentId: APPT_ID });

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: APPT_ID, refundStatus: { $ne: 'processed' } },
      { $set: { refundStatus: 'processed', paymentStatus: 'refunded', refundProcessedAt: expect.any(Date) } }
    );
  });

  it('rethrows on a transient Razorpay error so the caller (BullMQ) can retry', async () => {
    Appointment.findById = jest.fn().mockResolvedValue(paidAppt());
    mockRefund.mockRejectedValue(new Error('Network timeout'));

    await expect(paymentSvc.processRefundJob({ appointmentId: APPT_ID }))
      .rejects.toThrow('Network timeout');

    /* Must NOT mark failed on a single retryable attempt — only the worker's
       exhausted-retries handler does that (see refund.worker.js). */
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('never double-refunds: a lost race on the final write does not throw or re-notify', async () => {
    const { enqueueNotification } = require('../queues');
    Appointment.findById = jest.fn().mockResolvedValue(paidAppt());
    mockRefund.mockResolvedValue({ id: 'rfnd_RACE', status: 'processed' });
    /* Another writer (e.g. the refund.processed webhook) already marked it processed. */
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue(null);

    await expect(paymentSvc.processRefundJob({ appointmentId: APPT_ID })).resolves.toBeUndefined();

    expect(enqueueNotification).not.toHaveBeenCalled();
  });
});
