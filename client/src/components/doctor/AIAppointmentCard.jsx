/**
 * components/doctor/AIAppointmentCard.jsx
 *
 * AI-powered appointment card for the doctor dashboard.
 * Replaces plain appointment list items with a premium copilot card.
 *
 * Shows:
 *  - Patient avatar + name
 *  - Date/time/type
 *  - AI Risk badge (color coded)
 *  - Expandable AI Copilot summary
 *  - Symptom chips
 *  - Abnormal value highlights
 *  - Suggested focus areas
 *  - Reports count badge
 *  - Confirm / Decline actions (for pending)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Calendar, Clock, Paperclip,
  Video, Phone, MapPin, Brain, AlertTriangle, Activity, Stethoscope, Eye,
  CheckCircle, Home, IndianRupee,
} from 'lucide-react';

import { format, isToday, isTomorrow } from 'date-fns';
import StatusBadge from '@components/ui/StatusBadge';
import { AIConsultationBrief } from '@components/appointments/AIConsultationBrief';

const URGENCY_BADGE = {
  LOW:      { label: 'Low Risk',    cls: 'bg-success-500/20 text-success-400 border-success-500/30' },
  MEDIUM:   { label: 'Medium Risk', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  HIGH:     { label: 'High Risk',   cls: 'bg-danger-500/20 text-danger-400 border-danger-500/30' },
  CRITICAL: { label: 'Critical',    cls: 'bg-red-500/25 text-red-400 border-red-500/40' },
};

/* Helper: is this urgency level elevated? */
function urgent(level) {
  return level === 'HIGH' || level === 'CRITICAL';
}

const TYPE_ICONS = {
  video:      Video,
  voice:      Phone,
  phone:      Phone,
  clinic:     MapPin,
  'in-person': MapPin,
  home:       Home,
};

function formatDate(date) {
  const d = new Date(date);
  if (isToday(d))    return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

/**
 * @param {{
 *   appointment: object,
 *   onStatusUpdate?: (id: string, status: string) => void,
 * }} props
 */
export function AIAppointmentCard({ appointment, onStatusUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const navigate  = useNavigate();
  const appt    = appointment;
  const brief   = appt.aiConsultationBrief;
  const urgency = brief?.urgencyLevel ? URGENCY_BADGE[brief.urgencyLevel] : null;
  /* Prefer new consultationType field; fallback to legacy type */
  const consultType = appt.consultationType || appt.type || 'clinic';
  const TypeIcon = TYPE_ICONS[consultType] || MapPin;
  const reportCount = appt.uploadedReportIds?.length || 0;
  const symptoms = brief?.symptoms || appt.symptoms || [];
  const hasBrief = !!(brief?.summaryText);
  const patientId = appt.patient?._id || appt.patient;
  const isPaid    = appt.paymentStatus === 'paid';
  const fee       = appt.consultationFee || appt.fee || 0;

  const open360 = (e) => {
    e.stopPropagation();
    if (!patientId) return;
    navigate(`/doctor/patients/${patientId}/360?apptId=${appt._id}`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border overflow-hidden transition-colors ${
        hasBrief && urgent(brief?.urgencyLevel)
          ? 'border-danger-500/30 bg-danger-500/5'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      {/* Main row */}
      <div className="p-4 flex items-start gap-4">
        {/* Patient avatar */}
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">
          {appt.patient?.name?.[0]?.toUpperCase() ?? 'P'}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Name + status */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="font-semibold text-white text-sm leading-tight">{appt.patient?.name ?? 'Patient'}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Date/time */}
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  {formatDate(appt.date)}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {appt.time}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500 capitalize">
                  <TypeIcon className="w-3 h-3" />
                  {consultType.replace(/-/g, ' ')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isPaid && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success-500/15 border border-success-500/30 text-success-400">
                  <CheckCircle className="w-3 h-3" />Paid
                </span>
              )}
              <StatusBadge status={appt.status} />
            </div>
          </div>

          {/* AI Risk + Reports + Specialty row */}
          <div className="flex items-center gap-2 flex-wrap">
            {urgency && (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${urgency.cls}`}>
                {urgent(brief?.urgencyLevel)
                  ? <AlertTriangle className="w-3 h-3" />
                  : <Activity className="w-3 h-3" />
                }
                {urgency.label}
              </span>
            )}

            {hasBrief && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary-500/15 border border-primary-500/30 text-primary-400">
                <Brain className="w-3 h-3" />
                AI Brief
              </span>
            )}

            {/* Recommended specialty — instant clinical context for doctor */}
            {brief?.recommendedSpecialty && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-violet-500/15 border border-violet-500/30 text-violet-400">
                <Stethoscope className="w-3 h-3" />
                {brief.recommendedSpecialty}
              </span>
            )}

            {fee > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400">
                <IndianRupee className="w-3 h-3" />
                {fee.toLocaleString('en-IN')}
              </span>
            )}

            {reportCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white/8 border border-white/15 text-slate-400">
                <Paperclip className="w-3 h-3" />
                {reportCount} report{reportCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Symptom chips preview (always visible) */}
          {symptoms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {symptoms.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400"
                >
                  {s}
                </span>
              ))}
              {symptoms.length > 4 && (
                <span className="text-xs text-slate-600">+{symptoms.length - 4} more</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        {/* Expand brief button */}
        {hasBrief ? (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide AI Brief' : 'View AI Copilot Brief'}
          </button>
        ) : (
          <div className="text-xs text-slate-600">
            {appt.reason ? `Reason: ${appt.reason.slice(0, 50)}…` : 'No AI brief available'}
          </div>
        )}

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          {/* 360 View button */}
          {patientId && (
            <button
              id={`view360-${appt._id}`}
              onClick={open360}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/30 transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              360 View
            </button>
          )}

          {/* Status actions (pending only) */}
          {appt.status === 'pending' && onStatusUpdate && (
            <>
              <button
                id={`confirm-${appt._id}`}
                onClick={() => onStatusUpdate(appt._id, 'confirmed')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success-500/15 text-success-400 hover:bg-success-500/25 border border-success-500/30 transition-all"
              >
                Confirm
              </button>
              <button
                id={`decline-${appt._id}`}
                onClick={() => onStatusUpdate(appt._id, 'cancelled')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 border border-danger-500/25 transition-all"
              >
                Decline
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded AI Brief */}
      <AnimatePresence>
        {expanded && hasBrief && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="p-4">
              <AIConsultationBrief brief={brief} compact={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AIAppointmentCard;
