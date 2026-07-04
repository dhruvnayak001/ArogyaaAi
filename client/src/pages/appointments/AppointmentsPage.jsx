/**
 * pages/appointments/AppointmentsPage.jsx
 * List and manage appointments — upcoming, past, cancelled tabs
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Plus, Clock, User, Video, Phone, MapPin, XCircle,
  CheckCircle, AlertCircle, CreditCard, FileText, ReceiptText, Loader2,
  RefreshCw, Home,
} from 'lucide-react';
import { appointmentsApi } from '@api/appointments.api';
import StatusBadge from '@components/ui/StatusBadge';
import EmptyState from '@components/ui/EmptyState';
import { CardSkeleton } from '@components/ui/LoadingSkeleton';
import toast from 'react-hot-toast';
import { format, isAfter, isSameDay, startOfDay } from 'date-fns';

const TYPE_ICON = { 'in-person': MapPin, video: Video, phone: Phone, clinic: MapPin, voice: Phone, home: Home };

/* Download PDF blob helper */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/* Payment Status Chip */
function PaymentChip({ status }) {
  const cfg = {
    paid:     { label: 'Paid',    className: 'text-success-400 bg-success-500/15 border-success-500/30', icon: CheckCircle },
    pending:  { label: 'Payment Pending', className: 'text-warning-400 bg-warning-500/15 border-warning-500/30', icon: AlertCircle },
    failed:   { label: 'Payment Failed',  className: 'text-danger-400  bg-danger-500/15  border-danger-500/30',  icon: XCircle     },
    cancelled:{ label: 'Refunded',        className: 'text-slate-400   bg-slate-500/10   border-slate-500/20',   icon: CheckCircle },
    refunded: { label: 'Refunded',        className: 'text-slate-400   bg-slate-500/10   border-slate-500/20',   icon: CheckCircle },
  };
  const c = cfg[status] || cfg.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border ${c.className}`}>
      <Icon className="w-3 h-3" />{c.label}
    </span>
  );
}

function AppointmentCard({ appt, onCancel, onPaymentRetry }) {
  const TypeIcon = TYPE_ICON[appt.consultationType || appt.type] || MapPin;
  const isUpcoming = isAfter(new Date(appt.date), new Date()) &&
    !['cancelled', 'completed'].includes(appt.status);
  const [downloading, setDownloading] = useState(null); // 'invoice' | 'receipt' | null
  const [retrying,    setRetrying]    = useState(false);

  const handleDownload = async (type) => {
    setDownloading(type);
    try {
      const { data } = type === 'invoice'
        ? await appointmentsApi.downloadInvoice(appt._id)
        : await appointmentsApi.downloadReceipt(appt._id);
      downloadBlob(data, `arogyaai-${type}-${appt._id.slice(-6)}.pdf`);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to download ${type}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onPaymentRetry(appt._id);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card-hover p-5 flex flex-col gap-3"
    >
      {/* Top row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Date block */}
        <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20
                        flex flex-col items-center justify-center text-center">
          <p className="text-primary-400 font-bold text-xl leading-none">
            {format(new Date(appt.date), 'd')}
          </p>
          <p className="text-primary-400/60 text-xs uppercase tracking-wider">
            {format(new Date(appt.date), 'MMM')}
          </p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-white text-sm">
              Dr. {appt.doctor?.name ?? 'Unknown'}
            </p>
            <StatusBadge status={appt.status} />
            <PaymentChip status={appt.paymentStatus || 'pending'} />
          </div>
          <p className="text-xs text-slate-500 truncate mb-1.5">{appt.reason || 'General Consultation'}</p>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {appt.time ?? '—'}
            </span>
            {appt.doctor?.doctorProfile?.specialization && (
              <span className="flex items-center gap-1 truncate">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                {appt.doctor.doctorProfile.specialization}
              </span>
            )}
            <span className="flex items-center gap-1 capitalize">
              <TypeIcon className="w-3.5 h-3.5" /> {appt.consultationType || appt.type || 'clinic'}
            </span>
            {appt.consultationFee > 0 && (
              <span className="text-primary-400 font-medium">₹{appt.consultationFee.toLocaleString('en-IN')}</span>
            )}
          </div>
        </div>

        {/* Cancel */}
        {isUpcoming && (
          <button
            onClick={() => onCancel(appt._id)}
            className="flex-shrink-0 p-2 rounded-xl text-slate-500 hover:text-danger-400
                       hover:bg-danger-500/10 transition-all"
            title="Cancel appointment"
          >
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Action row */}
      {(appt.paymentStatus === 'paid' || ['pending', 'failed'].includes(appt.paymentStatus)) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/8">
          {/* Invoice download */}
          {appt.paymentStatus === 'paid' && (
            <button
              id={`invoice-${appt._id}`}
              onClick={() => handleDownload('invoice')}
              disabled={downloading === 'invoice'}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-white/15
                         text-slate-400 hover:text-white hover:border-white/25 transition-all disabled:opacity-50"
            >
              {downloading === 'invoice' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Invoice
            </button>
          )}
          {/* Receipt download */}
          {appt.paymentStatus === 'paid' && (
            <button
              id={`receipt-${appt._id}`}
              onClick={() => handleDownload('receipt')}
              disabled={downloading === 'receipt'}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-white/15
                         text-slate-400 hover:text-white hover:border-white/25 transition-all disabled:opacity-50"
            >
              {downloading === 'receipt' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ReceiptText className="w-3.5 h-3.5" />}
              Receipt
            </button>
          )}
          {/* Retry payment */}
          {['pending', 'failed'].includes(appt.paymentStatus) && appt.status !== 'cancelled' && (
            <button
              id={`retry-pay-${appt._id}`}
              onClick={() => onPaymentRetry(appt)}
              disabled={retrying}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-primary-500/30
                         text-primary-400 hover:text-white hover:bg-primary-500/20 transition-all disabled:opacity-50"
            >
              {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Complete Payment
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function AppointmentsPage() {
  const [all,     setAll]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await appointmentsApi.getAll();
      /* Handle both { appointments } and { data: { appointments } } envelopes */
      const appts = data.data?.appointments ?? data.appointments ?? [];
      setAll(appts);
    } catch {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    try {
      await appointmentsApi.cancel(id, 'Cancelled by patient');
      setAll((prev) => prev.map((a) => a._id === id ? { ...a, status: 'cancelled', paymentStatus: 'cancelled' } : a));
      toast.success('Appointment cancelled');
    } catch {
      toast.error('Failed to cancel appointment');
    }
  };

  const handlePaymentRetry = async (appt) => {
    /* Load Razorpay SDK */
    const loadSdk = () => new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

    const sdkLoaded = await loadSdk();
    if (!sdkLoaded) { toast.error('Failed to load payment gateway.'); return; }

    let orderData;
    try {
      const { data } = await appointmentsApi.retryPayment(appt._id);
      orderData = data.data?.order;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create payment order.');
      return;
    }

    const rzp = new window.Razorpay({
      key:      orderData.keyId,
      amount:   orderData.amount,
      currency: orderData.currency,
      name:     'ArogyaAI',
      description: `${(appt.consultationType || 'clinic').toUpperCase()} Consultation`,
      order_id: orderData.orderId,
      prefill:  orderData.prefill,
      theme:    { color: '#4F46E5' },
      handler: async (response) => {
        try {
          await appointmentsApi.verifyPayment({
            appointmentId:       appt._id,
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          });
          toast.success('🎉 Payment confirmed! Appointment is now booked.');
          load(); // refresh list
        } catch (err) {
          toast.error(err.response?.data?.message || 'Payment verification failed.');
        }
      },
      modal: { ondismiss: () => toast('Payment cancelled.', { icon: '⚠️' }) },
    });
    rzp.open();
  };

  const now   = new Date();
  const today = startOfDay(now);
  const upcoming  = all.filter((a) => {
    /* Include today AND future dates (compare start-of-day so today's appts are always "upcoming") */
    const apptDay = startOfDay(new Date(a.date));
    return !isSameDay(apptDay, today)
      ? isAfter(apptDay, today)
      : true;   // same day → always upcoming until the appointment is marked completed
  }).filter((a) => !['cancelled', 'completed'].includes(a.status));
  const past      = all.filter((a) => a.status === 'completed');
  const cancelled = all.filter((a) => a.status === 'cancelled');

  const TABS = [
    { key: 'upcoming',  label: `Upcoming (${upcoming.length})`,   list: upcoming  },
    { key: 'past',      label: `Completed (${past.length})`,      list: past      },
    { key: 'cancelled', label: `Cancelled (${cancelled.length})`, list: cancelled },
  ];
  const shown = TABS.find((t) => t.key === tab)?.list ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-heading">Appointments</h1>
          <p className="section-subheading mt-1">Manage your medical consultations</p>
        </div>
        <Link id="book-appointment-btn" to="/appointments/book"
          className="btn-primary text-sm px-5 py-2.5">
          <Plus className="w-4 h-4" /> Book New
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Upcoming',  value: upcoming.length,  color: 'text-primary-400' },
          { label: 'Completed', value: past.length,      color: 'text-success-400' },
          { label: 'Cancelled', value: cancelled.length, color: 'text-danger-400'  },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass-card rounded-xl w-fit flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} id={`tab-${t.key}`} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-primary-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={`No ${tab} appointments`}
          description={tab === 'upcoming' ? 'Book a consultation with a specialist today.' : 'Nothing to show here.'}
          action={tab === 'upcoming' ? (
            <Link to="/appointments/book" className="btn-primary text-sm px-5 py-2.5">
              <Plus className="w-4 h-4" /> Book Appointment
            </Link>
          ) : null}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {shown.map((appt) => (
              <AppointmentCard key={appt._id} appt={appt} onCancel={handleCancel} onPaymentRetry={handlePaymentRetry} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default AppointmentsPage;
