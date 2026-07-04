/**
 * components/appointments/PaymentStep.jsx
 *
 * Premium payment step for the appointment booking wizard.
 * Handles Razorpay checkout (lazy-loaded SDK), success/failure states.
 *
 * Security:
 *  - Never trust frontend success — always verifies via backend
 *  - Razorpay key_secret NEVER leaves server
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Shield, CheckCircle, XCircle, Loader2, Lock,
  Calendar, Clock, Video, Phone, MapPin, Home, Sparkles, ReceiptText,
} from 'lucide-react';
import { format } from 'date-fns';
import { appointmentsApi } from '@api/appointments.api';
import toast from 'react-hot-toast';

const TYPE_ICON = { video: Video, voice: Phone, clinic: MapPin, home: Home, 'in-person': MapPin, phone: Phone };

/* ── Fee Breakdown Row ── */
function FeeRow({ label, value, highlight = false, isTotal = false }) {
  return (
    <div className={`flex justify-between items-center py-2 ${isTotal ? 'border-t border-white/15 mt-1 pt-3' : ''}`}>
      <span className={`text-sm ${isTotal ? 'text-white font-bold text-base' : 'text-slate-400'}`}>{label}</span>
      <span className={`font-semibold ${isTotal ? 'text-white text-xl' : highlight ? 'text-primary-400' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

/* ── Payment Status Badge ── */
function PaymentBadge({ status }) {
  const config = {
    paid:     { label: 'Payment Confirmed', color: 'text-success-400 bg-success-500/15 border-success-500/30', icon: CheckCircle },
    pending:  { label: 'Payment Pending',   color: 'text-warning-400 bg-warning-500/15 border-warning-500/30', icon: Loader2 },
    failed:   { label: 'Payment Failed',    color: 'text-danger-400  bg-danger-500/15  border-danger-500/30',  icon: XCircle },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${c.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </div>
  );
}

/**
 * PaymentStep
 * Props:
 *  - appointment: the just-created appointment object from backend
 *  - doctor: doctor object
 *  - onSuccess: callback(appointment) — called after payment verified
 *  - onFailure: callback() — called if payment fails
 */
function PaymentStep({ appointment, doctor, onSuccess, onFailure }) {
  const [paymentState, setPaymentState] = useState('idle'); // idle | loading | processing | success | failed

  const profile   = doctor?.doctorProfile || {};
  const fee       = appointment?.consultationFee || appointment?.fee || 0;
  const platform  = appointment?.platformFee || 0;
  const tax       = appointment?.taxAmount    || 0;
  const discount  = appointment?.discountAmount || 0;
  const total     = appointment?.totalAmount   || fee;

  const TypeIcon = TYPE_ICON[appointment?.consultationType || 'clinic'] || MapPin;

  /* Lazy-load Razorpay SDK */
  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload  = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayNow = useCallback(async () => {
    if (!appointment?._id) {
      toast.error('Appointment not found. Please try again.');
      return;
    }

    /* ── Diagnostic logging ── */
    console.log('[PaymentStep] handlePayNow called:', {
      appointmentId:    appointment._id,
      consultationFee:  appointment.consultationFee,
      consultationType: appointment.consultationType,
      totalAmount:      appointment.totalAmount,
      fee,
      total,
    });

    /* Guard against zero-fee payment — doctor has not configured their fee */
    if (fee <= 0 && total <= 0) {
      toast.error('Consultation fee is ₹0. The doctor has not configured a fee for this consultation type. Please contact support or choose a different consultation type.');
      return;
    }

    setPaymentState('loading');

    /* 1. Load SDK */
    const sdkLoaded = await loadRazorpay();
    if (!sdkLoaded) {
      toast.error('Failed to load payment gateway. Check your internet connection.');
      setPaymentState('idle');
      return;
    }

    /* 2. Create Razorpay order via backend */
    let orderData;
    try {
      const { data } = await appointmentsApi.createPaymentOrder(appointment._id);
      orderData = data.data?.order;

      /* ── Diagnostic logging ── */
      console.log('[PaymentStep] Order created:', {
        orderId:       orderData?.orderId,
        amount:        orderData?.amount,
        currency:      orderData?.currency,
        keyId:         orderData?.keyId,
        appointmentId: orderData?.appointmentId,
      });

      if (!orderData?.orderId || !orderData?.amount) {
        toast.error('Payment order creation failed: invalid response from server.');
        setPaymentState('idle');
        return;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create payment order. Please try again.');
      setPaymentState('idle');
      return;
    }

    setPaymentState('processing');

    /* 3. Open Razorpay checkout */
    const rzpOptions = {
      key:         orderData.keyId,
      amount:      orderData.amount,
      currency:    orderData.currency,
      name:        'ArogyaAI',
      description: `${(appointment.consultationType || 'clinic').toUpperCase()} Consultation with Dr. ${doctor?.name}`,
      image:       '/logo.png',  // optional branding
      order_id:    orderData.orderId,
      prefill:     orderData.prefill,
      notes:       orderData.notes,
      theme:       { color: '#4F46E5' },

      handler: async (response) => {
        /* 4. Verify payment signature via backend — NEVER trust frontend */
        setPaymentState('loading');
        try {
          const { data } = await appointmentsApi.verifyPayment({
            appointmentId:        appointment._id,
            razorpay_order_id:    response.razorpay_order_id,
            razorpay_payment_id:  response.razorpay_payment_id,
            razorpay_signature:   response.razorpay_signature,
          });

          setPaymentState('success');
          toast.success('🎉 Payment confirmed! Your appointment is booked.');
          onSuccess?.(data.data?.appointment);
        } catch (err) {
          setPaymentState('failed');
          toast.error(err.response?.data?.message || 'Payment verification failed. Please contact support.');
          onFailure?.();
        }
      },

      modal: {
        ondismiss: () => {
          /* User closed Razorpay modal without paying */
          if (paymentState === 'processing') {
            setPaymentState('idle');
            toast('Payment cancelled. You can retry anytime from your appointments.', { icon: '⚠️' });
          }
        },
      },
    };

    const rzp = new window.Razorpay(rzpOptions);
    rzp.on('payment.failed', (response) => {
      setPaymentState('failed');
      toast.error(`Payment failed: ${response.error?.description || 'Unknown error'}`);
      onFailure?.();
    });
    rzp.open();
  }, [appointment, doctor, onSuccess, onFailure, paymentState]);

  /* ── SUCCESS STATE ── */
  if (paymentState === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-5 text-center"
      >
        <div className="flex flex-col items-center gap-4 py-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="w-24 h-24 rounded-full bg-success-500/20 border-2 border-success-500/50 flex items-center justify-center"
          >
            <CheckCircle className="w-12 h-12 text-success-400" />
          </motion.div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
            <p className="text-slate-400 text-sm">Your appointment is confirmed. Dr. {doctor?.name} has been notified.</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {['Appointment Confirmed', 'AI Brief Ready', 'Doctor Notified'].map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-1.5 text-xs text-success-400 bg-success-500/15 border border-success-500/30 px-3 py-1.5 rounded-full"
              >
                <CheckCircle className="w-3 h-3" />
                {step}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── FAILED STATE ── */
  if (paymentState === 'failed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-5 text-center"
      >
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-20 h-20 rounded-full bg-danger-500/20 border-2 border-danger-500/30 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-danger-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Payment Failed</h3>
            <p className="text-slate-400 text-sm">Your appointment is saved. You can retry payment anytime from your appointments page.</p>
          </div>
          <button
            id="retry-payment-btn"
            onClick={() => setPaymentState('idle')}
            className="btn-primary px-6 py-2.5 text-sm"
          >
            Try Again
          </button>
        </div>
      </motion.div>
    );
  }

  /* ── IDLE / MAIN STATE ── */
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Secure Payment</h2>
        <p className="text-sm text-slate-400">Review your appointment summary and proceed to pay securely</p>
      </div>

      {/* Appointment Summary Card */}
      <div className="glass-card p-5 border border-primary-500/20">
        <div className="flex items-center gap-4 pb-4 border-b border-white/8 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0">
            {doctor?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-lg">Dr. {doctor?.name}</p>
            <p className="text-primary-400 text-sm">{profile.specialization}</p>
            <p className="text-slate-500 text-xs">{profile.hospital || 'Private Practice'}</p>
          </div>
          <PaymentBadge status="pending" />
        </div>

        {/* Details */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-slate-300">
              {appointment?.date
                ? format(
                    new Date(appointment.date.includes('T')
                      ? appointment.date
                      : appointment.date + 'T00:00:00'),
                    'EEEE, MMMM d, yyyy'
                  )
                : '—'
              }
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-slate-300">{appointment?.time || '—'} · {appointment?.duration || 30} minutes</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <TypeIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-slate-300 capitalize">{(appointment?.consultationType || 'clinic').replace(/-/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ReceiptText className="w-4 h-4 text-primary-400" />
          <p className="text-sm font-semibold text-white">Fee Breakdown</p>
        </div>
        <FeeRow label="Consultation Fee"    value={`₹${fee.toLocaleString('en-IN')}`} />
        <FeeRow label="Platform Fee"        value={platform > 0 ? `₹${platform.toLocaleString('en-IN')}` : 'Included'} />
        <FeeRow label="Tax (GST)"           value={tax > 0 ? `₹${tax.toLocaleString('en-IN')}` : 'Included'} />
        {discount > 0 && <FeeRow label="Discount" value={`-₹${discount.toLocaleString('en-IN')}`} highlight />}
        <FeeRow label="Grand Total" value={`₹${total.toLocaleString('en-IN')}`} isTotal />
      </div>

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Lock className="w-3.5 h-3.5 text-success-400 flex-shrink-0" />
        <span>Payments are processed securely via Razorpay. ArogyaAI does not store card data.</span>
      </div>

      {/* Pay Button */}
      <motion.button
        id="pay-now-btn"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handlePayNow}
        disabled={paymentState === 'loading' || paymentState === 'processing'}
        className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-3 relative overflow-hidden"
      >
        {/* Shimmer effect */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        {paymentState === 'loading' || paymentState === 'processing' ? (
          <><Loader2 className="w-5 h-5 animate-spin" />Processing…</>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pay ₹{total.toLocaleString('en-IN')} Securely
            <Shield className="w-4 h-4 opacity-70" />
          </>
        )}
      </motion.button>

      {/* Razorpay branding */}
      <p className="text-center text-xs text-slate-600">
        Powered by <span className="text-slate-400 font-medium">Razorpay</span> · UPI, Cards, Net Banking accepted
      </p>
    </div>
  );
}

export { PaymentStep };
export default PaymentStep;
