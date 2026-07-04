/**
 * routes/payment.routes.js
 *
 * Route table:
 *  POST  /api/v1/payments/create-order           → createOrder      (patient)
 *  POST  /api/v1/payments/verify                 → verifyPayment    (patient)
 *  POST  /api/v1/payments/retry/:appointmentId   → retryPayment     (patient)
 *  GET   /api/v1/payments/earnings               → getEarnings      (doctor)
 *  GET   /api/v1/payments/invoice/:appointmentId → downloadInvoice  (patient | doctor)
 *  GET   /api/v1/payments/receipt/:appointmentId → downloadReceipt  (patient | doctor)
 */

'use strict';

const express       = require('express');
const router        = express.Router();
const paymentCtrl   = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');
const validate      = require('../middleware/validate.middleware');

/* All payment routes require authentication */
router.use(protect);

/* ── Patient: create Razorpay order ── */
router.post('/create-order',
  authorize('patient'),
  body('appointmentId').isMongoId().withMessage('Valid appointmentId is required'),
  validate,
  paymentCtrl.createOrder
);

/* ── Patient: verify Razorpay payment signature ── */
router.post('/verify',
  authorize('patient'),
  [
    body('appointmentId').isMongoId().withMessage('Valid appointmentId is required'),
    body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required'),
    body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required'),
    body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required'),
  ],
  validate,
  paymentCtrl.verifyPayment
);

/* ── Patient: retry failed/pending payment ── */
router.post('/retry/:appointmentId',
  authorize('patient'),
  param('appointmentId').isMongoId().withMessage('Invalid appointment ID'),
  validate,
  paymentCtrl.retryPayment
);

/* ── Doctor: get earnings analytics ── */
router.get('/earnings',
  authorize('doctor'),
  paymentCtrl.getEarnings
);

/* ── Patient | Doctor: download invoice ── */
router.get('/invoice/:appointmentId',
  param('appointmentId').isMongoId().withMessage('Invalid appointment ID'),
  validate,
  paymentCtrl.downloadInvoice
);

/* ── Patient | Doctor: download receipt ── */
router.get('/receipt/:appointmentId',
  param('appointmentId').isMongoId().withMessage('Invalid appointment ID'),
  validate,
  paymentCtrl.downloadReceipt
);

module.exports = router;
