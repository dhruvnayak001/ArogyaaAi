/**
 * __tests__/webhook.test.js
 *
 * Tests for the Razorpay webhook (P1-1):
 *   - HMAC signature verification (valid / invalid)
 *   - Idempotency via WebhookEvent unique-index dedup (duplicate event skipped)
 *   - payment.captured: confirms a pending appointment
 *   - payment.captured on a cancelled appointment: refund path, no confirm
 *   - refund.processed / refund.failed reconciliation
 */

'use strict';

jest.mock('../models/WebhookEvent.model');
jest.mock('../models/Appointment.model');
jest.mock('../config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../queues', () => ({
  enqueueEmail:        jest.fn().mockResolvedValue({}),
  enqueueNotification: jest.fn().mockResolvedValue({}),
  enqueueRefund:       jest.fn().mockResolvedValue({}),
}));

const crypto        = require('crypto');
const WebhookEvent  = require('../models/WebhookEvent.model');
const Appointment   = require('../models/Appointment.model');
const { enqueueNotification, enqueueRefund } = require('../queues');
const { handleRazorpayWebhook } = require('../controllers/webhook.controller');

const SECRET  = 'test_webhook_secret_value';
const APPT_ID = 'appt_webhook_1';
const PAY_ID  = 'pay_WEBHOOK1';

const sign = (bodyBuf, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(bodyBuf).digest('hex');

/** Build a fake Express req/res pair for direct controller invocation. */
const makeReqRes = (payload, { signature, eventId } = {}) => {
  const bodyBuf = Buffer.from(JSON.stringify(payload));
  const sig     = signature !== undefined ? signature : sign(bodyBuf);

  const req = {
    body: bodyBuf,
    headers: {
      'x-razorpay-signature': sig,
      ...(eventId ? { 'x-razorpay-event-id': eventId } : {}),
    },
  };
  const res = {
    statusCode: null,
    jsonBody:   null,
    status(code) { this.statusCode = code; return this; },
    json(body)   { this.jsonBody = body; return this; },
  };
  return { req, res };
};

const paymentCapturedPayload = (overrides = {}) => ({
  event: 'payment.captured',
  created_at: 1710000000,
  payload: {
    payment: {
      entity: {
        id:       PAY_ID,
        order_id: 'order_WEBHOOK1',
        notes:    { appointmentId: APPT_ID },
        ...overrides,
      },
    },
  },
});

describe('webhook.controller — signature + idempotency', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    jest.clearAllMocks();
  });

  it('rejects a request with an invalid signature', async () => {
    const payload = paymentCapturedPayload();
    const { req, res } = makeReqRes(payload, { signature: 'deadbeef'.repeat(8) });

    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(400);
    expect(WebhookEvent.create).not.toHaveBeenCalled();
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 503 when RAZORPAY_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const payload = paymentCapturedPayload();
    const { req, res } = makeReqRes(payload);

    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(503);
  });

  it('processes a valid signature and records the event', async () => {
    WebhookEvent.create = jest.fn().mockResolvedValue({});
    Appointment.findById = jest.fn().mockResolvedValue({
      _id: APPT_ID, status: 'pending', paymentStatus: 'pending',
    });
    Appointment.findOneAndUpdate = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: APPT_ID, amount: 100000, consultationType: 'clinic',
        patient: { _id: 'patient_1', name: 'Pat' },
        doctor:  { _id: 'doctor_1', name: 'Doc' },
      }),
    });

    const payload = paymentCapturedPayload();
    const { req, res } = makeReqRes(payload);

    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(WebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('skips a duplicate event (same eventId already claimed) — returns 200, does not reprocess', async () => {
    const dupError = Object.assign(new Error('duplicate key'), { code: 11000 });
    WebhookEvent.create = jest.fn().mockRejectedValue(dupError);

    const payload = paymentCapturedPayload();
    const { req, res } = makeReqRes(payload, { eventId: 'evt_dup_1' });

    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(Appointment.findById).not.toHaveBeenCalled();
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('webhook.controller — payment.captured', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    jest.clearAllMocks();
    WebhookEvent.create = jest.fn().mockResolvedValue({});
  });

  it('confirms a pending appointment atomically and notifies both parties', async () => {
    Appointment.findById = jest.fn().mockResolvedValue({
      _id: APPT_ID, status: 'pending', paymentStatus: 'pending',
    });
    const populated = {
      _id: APPT_ID, amount: 100000, consultationType: 'clinic',
      patient: { _id: 'patient_1', name: 'Pat' },
      doctor:  { _id: 'doctor_1', name: 'Doc' },
    };
    Appointment.findOneAndUpdate = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(populated),
    });

    const { req, res } = makeReqRes(paymentCapturedPayload());
    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(200);
    const [filter, update] = Appointment.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: APPT_ID, paymentStatus: { $ne: 'paid' }, status: { $ne: 'cancelled' } });
    expect(update.$set).toMatchObject({ paymentStatus: 'paid', paymentId: PAY_ID, status: 'confirmed', isPaid: true });
    expect(enqueueNotification).toHaveBeenCalledTimes(2);
  });

  it('routes to the refund pipeline instead of confirming when the appointment is cancelled', async () => {
    Appointment.findById = jest.fn()
      .mockResolvedValueOnce({ _id: APPT_ID, status: 'cancelled', paymentStatus: 'pending' }) // handlePaymentCapturedWebhook's read
      .mockResolvedValueOnce({ _id: APPT_ID, status: 'cancelled', paymentStatus: 'pending', totalAmount: 500 }); // markCapturedPaymentForRefund's read

    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: APPT_ID, patient: 'patient_1', refundStatus: 'initiated',
    });

    const { req, res } = makeReqRes(paymentCapturedPayload());
    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(200);
    const [filter, update] = Appointment.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: APPT_ID, status: 'cancelled', paymentStatus: { $ne: 'paid' } });
    expect(update.$set).toMatchObject({ paymentStatus: 'paid', refundStatus: 'initiated', refundAmount: 500 });
    expect(update.$set.status).toBeUndefined(); // never confirmed
    expect(enqueueRefund).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when the appointment is already paid (duplicate/retried event)', async () => {
    Appointment.findById = jest.fn().mockResolvedValue({
      _id: APPT_ID, status: 'confirmed', paymentStatus: 'paid',
    });

    const { req, res } = makeReqRes(paymentCapturedPayload());
    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
  });
});

describe('webhook.controller — refund.processed / refund.failed', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    jest.clearAllMocks();
    WebhookEvent.create = jest.fn().mockResolvedValue({});
  });

  it('refund.processed updates refundStatus, paymentStatus, refundProcessedAt, refundId', async () => {
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: APPT_ID, patient: 'patient_1', refundAmount: 500,
    });

    const payload = {
      event: 'refund.processed',
      created_at: 1710000001,
      payload: { refund: { entity: { id: 'rfnd_1', payment_id: PAY_ID, notes: { appointmentId: APPT_ID } } } },
    };
    const { req, res } = makeReqRes(payload);
    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(200);
    const [filter, update] = Appointment.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: APPT_ID, refundStatus: { $ne: 'processed' } });
    expect(update.$set).toMatchObject({ refundStatus: 'processed', paymentStatus: 'refunded', refundId: 'rfnd_1' });
  });

  it('refund.failed updates refundStatus=failed and refundFailReason', async () => {
    Appointment.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: APPT_ID });

    const payload = {
      event: 'refund.failed',
      created_at: 1710000002,
      payload: { refund: { entity: { id: 'rfnd_2', payment_id: PAY_ID, notes: { appointmentId: APPT_ID }, error_description: 'Bank declined' } } },
    };
    const { req, res } = makeReqRes(payload);
    await handleRazorpayWebhook(req, res);

    expect(res.statusCode).toBe(200);
    const [filter, update] = Appointment.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: APPT_ID, refundStatus: { $ne: 'processed' } });
    expect(update.$set).toMatchObject({ refundStatus: 'failed', refundFailReason: 'Bank declined' });
  });
});
