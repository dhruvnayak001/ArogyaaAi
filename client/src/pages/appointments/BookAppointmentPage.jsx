/**
 * pages/appointments/BookAppointmentPage.jsx
 *
 * 7-Step AI Smart Appointment + Pre-Consultation Copilot Wizard
 *
 * Steps:
 *  0 — Specialty selection
 *  1 — Doctor selection (premium cards)
 *  2 — Date, Time & Type
 *  3 — Symptoms (voice + text + tags)
 *  4 — Attach Reports (existing records + note upload link)
 *  5 — AI Brief (generate + display)
 *  6 — Confirm & Book
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, ChevronRight, ChevronLeft,
  Video, Phone, MapPin, Stethoscope, Clock, Loader2,
  Heart, Brain, Bone, Eye, Baby, Smile, Zap, Shield,
  FileText, Paperclip, Sparkles, AlertCircle, Calendar,
  Home, CreditCard, IndianRupee,
} from 'lucide-react';
import { format, addDays, startOfToday, isToday } from 'date-fns';
import toast from 'react-hot-toast';

import { doctorsApi }      from '@api/doctors.api';
import { appointmentsApi } from '@api/appointments.api';
import { recordsApi }      from '@api/records.api';
import { aiApi }           from '@api/ai.api';
import { DoctorCard }      from '@components/appointments/DoctorCard';
import { VoiceSymptomInput } from '@components/appointments/VoiceSymptomInput';
import { AIConsultationBrief } from '@components/appointments/AIConsultationBrief';
import { PaymentStep }     from '@components/appointments/PaymentStep';
import { CardSkeleton }    from '@components/ui/LoadingSkeleton';
import { useAppointmentStore } from '@store/appointmentStore';

/* ── Constants ── */
const STEPS = ['Specialty', 'Doctor', 'Schedule', 'Symptoms', 'Reports', 'AI Brief', 'Confirm', 'Payment'];

const SPECIALTIES = [
  { id: 'General Physician', icon: Stethoscope,  color: 'from-blue-500 to-blue-700',     bg: 'bg-blue-500/10',   border: 'border-blue-500/30'   },
  { id: 'Cardiologist',      icon: Heart,         color: 'from-rose-500 to-red-700',      bg: 'bg-rose-500/10',   border: 'border-rose-500/30'   },
  { id: 'Neurologist',       icon: Brain,         color: 'from-violet-500 to-purple-700', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  { id: 'Dermatologist',     icon: Shield,        color: 'from-amber-500 to-orange-600',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30'  },
  { id: 'Orthopedist',       icon: Bone,          color: 'from-emerald-500 to-green-700', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30'},
  { id: 'Gynecologist',      icon: Smile,         color: 'from-pink-500 to-rose-700',     bg: 'bg-pink-500/10',   border: 'border-pink-500/30'   },
  { id: 'Paediatrician',     icon: Baby,          color: 'from-sky-400 to-blue-600',      bg: 'bg-sky-500/10',    border: 'border-sky-500/30'    },
  { id: 'Psychiatrist',      icon: Zap,           color: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
];

const MODE_META = {
  video:  { label: 'Video',    icon: Video,  desc: 'Online video call' },
  voice:  { label: 'Voice',    icon: Phone,  desc: 'Audio consultation' },
  clinic: { label: 'Clinic',   icon: MapPin, desc: 'Visit the clinic' },
  home:   { label: 'Home',     icon: Home,   desc: 'Doctor visits you' },
};

const SLOTS = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00',
];

/* ════════════════════════════════════════
   STEP INDICATOR
   ════════════════════════════════════════ */
function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto no-scrollbar pb-1">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step  ? 'bg-success-500 text-white' :
              i === step ? 'bg-primary-500 text-white ring-4 ring-primary-500/25' :
                           'bg-white/8 text-slate-500'
            }`}>
              {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block whitespace-nowrap ${
              i === step ? 'text-white' : i < step ? 'text-success-400' : 'text-slate-600'
            }`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 min-w-[12px] transition-all ${i < step ? 'bg-success-500' : 'bg-white/10'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   STEP 0 — Specialty
   ════════════════════════════════════════ */
function Step0Specialty({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Choose a Specialty</h2>
      <p className="text-sm text-slate-400 mb-6">Select the type of doctor you need to consult</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SPECIALTIES.map(({ id, icon: Icon, color, bg, border }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            id={`specialty-${id.toLowerCase().replace(/\s/g, '-')}`}
            className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all text-sm font-medium ${
              value === id
                ? `${border} ${bg} text-white ring-2 ring-primary-500/20`
                : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/5'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-center leading-tight">{id}</span>
            {value === id && <CheckCircle className="w-4 h-4 text-primary-400" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   STEP 1 — Doctor Selection
   ════════════════════════════════════════ */
function Step1Doctor({ specialty, value, onChange }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingId, setFetchingId] = useState(null); // doctor being fetched for full profile

  useEffect(() => {
    setLoading(true);
    doctorsApi.search({ specialization: specialty })
      .then(({ data }) => setDoctors(data.data?.doctors ?? data.doctors ?? []))
      .catch(() => toast.error('Failed to load doctors'))
      .finally(() => setLoading(false));
  }, [specialty]);

  /* When a doctor is selected, fetch their full profile to get consultationModes */
  const handleSelect = async (doc) => {
    if (value?._id === doc._id) return; // already selected
    setFetchingId(doc._id);
    try {
      const { data } = await doctorsApi.getById(doc._id);
      const fullDoc = data.data?.doctor ?? data.doctor ?? doc;
      onChange(fullDoc);
    } catch {
      /* Fallback to search result if full profile fetch fails */
      onChange(doc);
    } finally {
      setFetchingId(null);
    }
  };

  if (loading) return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Select a Doctor</h2>
      <p className="text-sm text-slate-400 mb-6">Loading available {specialty}s…</p>
      <CardSkeleton count={3} />
    </div>
  );

  if (doctors.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Select a Doctor</h2>
        <div className="glass-card p-10 flex flex-col items-center gap-3 text-center mt-6">
          <Stethoscope className="w-12 h-12 text-slate-600" />
          <p className="text-white font-medium">No {specialty}s found</p>
          <p className="text-sm text-slate-500">Check back later or try a different specialty.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Select a Doctor</h2>
      <p className="text-sm text-slate-400 mb-6">{doctors.length} {specialty}{doctors.length > 1 ? 's' : ''} available</p>
      <div className="space-y-3">
        {doctors.map((doc) => (
          <div key={doc._id} className="relative">
            {fetchingId === doc._id && (
              <div className="absolute inset-0 z-10 rounded-2xl bg-black/40 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
              </div>
            )}
            <DoctorCard
              doctor={doc}
              selected={value?._id === doc._id}
              onClick={() => handleSelect(doc)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════
   STEP 2 — Date, Time & Type
   ════════════════════════════════════════ */
function Step2Schedule({ doctor, value, onChange }) {
  const today = startOfToday();
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const [slots, setSlots] = useState(SLOTS.map((t) => ({ time: t, available: true })));
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotMeta, setSlotMeta] = useState(null); // { isWorkingDay, lunchBreak }

  const update = (field, val) => onChange({ ...value, [field]: val });

  /* Derive enabled consultation modes from doctor config */
  const doctorModes = (doctor?.doctorProfile?.consultationModes || []).filter((m) => m.enabled);

  /* Auto-select first enabled mode if none selected */
  useEffect(() => {
    if (doctorModes.length > 0 && !value.consultationType) {
      update('consultationType', doctorModes[0].mode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor]);

  /* Fetch live slot availability when date changes */
  useEffect(() => {
    if (!value.date || !doctor?._id) return;
    setLoadingSlots(true);
    appointmentsApi.getAvailableSlots(doctor._id, value.date)
      .then(({ data }) => {
        const resp = data.data;
        // New API returns { slots, isWorkingDay, lunchBreak }
        // Old API returns an array directly
        if (Array.isArray(resp?.slots)) {
          setSlots(resp.slots);
          setSlotMeta({ isWorkingDay: resp.isWorkingDay, lunchBreak: resp.lunchBreak });
        } else if (Array.isArray(resp)) {
          setSlots(resp);
        } else {
          setSlots(SLOTS.map((t) => ({ time: t, available: true })));
        }
      })
      .catch(() => setSlots(SLOTS.map((t) => ({ time: t, available: true }))))
      .finally(() => setLoadingSlots(false));
  }, [value.date, doctor?._id]);

  /* Selected mode config */
  const selectedMode = doctorModes.find((m) => m.mode === value.consultationType);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Choose Schedule</h2>
        <p className="text-sm text-slate-400">Pick your preferred date, time, and consultation type</p>
      </div>

      {/* Consultation type — dynamic from doctor config */}
      <div>
        <p className="text-sm font-semibold text-slate-300 mb-3">Consultation Type</p>
        {doctorModes.length === 0 ? (
          <div className="glass-card p-4 border border-amber-500/20">
            <p className="text-amber-400 text-xs">This doctor hasn't configured their consultation modes yet. Default clinic visit applies.</p>
          </div>
        ) : (
          <div className={`grid gap-3 ${doctorModes.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {doctorModes.map(({ mode, fee, duration }) => {
              const meta = MODE_META[mode] || MODE_META.clinic;
              const Icon = meta.icon;
              return (
                <button
                  key={mode}
                  onClick={() => update('consultationType', mode)}
                  id={`type-${mode}`}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border text-sm transition-all ${
                    value.consultationType === mode
                      ? 'border-primary-500 bg-primary-500/15 text-white'
                      : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-xs font-bold text-primary-400">₹{fee}</span>
                  <span className="text-2xs text-slate-500">{duration}min</span>
                </button>
              );
            })}
          </div>
        )}
        {selectedMode && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-success-400" />
            ₹{selectedMode.fee} · {selectedMode.duration} minutes · {selectedMode.description || ''}
          </p>
        )}
      </div>

      {/* Date picker */}
      <div>
        <p className="text-sm font-semibold text-slate-300 mb-3">Select Date</p>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {dates.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const sel = value.date === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ ...value, date: key, time: '' })}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl text-xs font-medium border transition-all min-w-[52px] ${
                  sel
                    ? 'border-primary-500 bg-primary-500/20 text-white'
                    : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-xs uppercase opacity-60">{format(d, 'EEE')}</span>
                <span className="text-lg font-bold leading-tight">{format(d, 'd')}</span>
                {isToday(d) && <span className="text-2xs text-primary-400 font-medium">Today</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Working day warning */}
      {value.date && slotMeta && !slotMeta.isWorkingDay && (
        <div className="glass-card p-3 border border-amber-500/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">This doctor is not available on this day. Please select a different date.</p>
        </div>
      )}

      {/* Lunch break notice */}
      {value.date && slotMeta?.lunchBreak && (
        <p className="text-xs text-slate-600 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Lunch break: {slotMeta.lunchBreak.start} – {slotMeta.lunchBreak.end}
        </p>
      )}

      {/* Time slots */}
      {value.date && (
        <div>
          <p className="text-sm font-semibold text-slate-300 mb-3">Select Time</p>
          {loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading slots…
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-2">
              {slots.map(({ time, available }) => (
                <button
                  key={time}
                  onClick={() => available && update('time', time)}
                  id={`slot-${time}`}
                  disabled={!available}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1 ${
                    !available
                      ? 'border-white/5 text-slate-700 cursor-not-allowed line-through'
                      : value.time === time
                      ? 'border-primary-500 bg-primary-500/20 text-white'
                      : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reason */}
      <div>
        <label className="form-label">Reason for Visit <span className="text-danger-400">*</span></label>
        <textarea
          id="appointment-reason"
          value={value.reason || ''}
          onChange={(e) => update('reason', e.target.value)}
          placeholder="Briefly describe the main reason for your appointment…"
          rows={3}
          className="input-field resize-none"
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   STEP 3 — Symptoms
   ════════════════════════════════════════ */
function Step3Symptoms({ symptomText, onSymptomTextChange, symptomTags, onTagsChange }) {
  return (
    <VoiceSymptomInput
      value={symptomText}
      onChange={onSymptomTextChange}
      symptomTags={symptomTags}
      onTagsChange={onTagsChange}
    />
  );
}

/* ════════════════════════════════════════
   STEP 4 — Reports
   ════════════════════════════════════════ */
function Step4Reports({ selectedIds, onToggle }) {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    recordsApi.getAll()
      .then(({ data }) => setRecords(data.data?.records ?? data.records ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Attach Health Reports</h2>
        <p className="text-sm text-slate-400">
          Select existing reports to share with the doctor. AI will use them in the consultation brief.
        </p>
      </div>

      {loading ? (
        <CardSkeleton count={3} />
      ) : records.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No health records found.</p>
          <p className="text-xs text-slate-600 mt-1">
            You can upload reports from the{' '}
            <a href="/records" className="text-primary-400 underline">Health Records</a> page.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const selected = selectedIds.includes(record._id);
            const severity = record.analysis?.severity;
            return (
              <button
                key={record._id}
                onClick={() => onToggle(record._id)}
                id={`report-${record._id}`}
                className={`w-full text-left p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                  selected
                    ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/20'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  selected ? 'bg-primary-500/20' : 'bg-white/8'
                }`}>
                  <Paperclip className={`w-5 h-5 ${selected ? 'text-primary-400' : 'text-slate-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{record.title || 'Health Record'}</p>
                  <p className="text-xs text-slate-500">{record.type} • {record.date ? format(new Date(record.date), 'MMM d, yyyy') : 'Unknown date'}</p>
                </div>
                {severity && severity !== 'normal' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${
                    severity === 'critical' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                    severity === 'high'     ? 'text-danger-400 border-danger-500/30 bg-danger-500/10' :
                    severity === 'moderate' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                    'text-slate-500 border-white/10'
                  }`}>
                    {severity}
                  </span>
                )}
                {selected && <CheckCircle className="w-5 h-5 text-primary-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-600 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        Reports are only shared with your selected doctor for this appointment.
      </p>
    </div>
  );
}

/* ════════════════════════════════════════
   STEP 5 — AI Brief
   ════════════════════════════════════════ */
function Step5AIBrief({ brief, isGenerating, error, onGenerate, symptomText, selectedReportCount }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">AI Pre-Consultation Brief</h2>
        <p className="text-sm text-slate-400">
          Our AI will prepare a clinical summary for your doctor — reducing wait time and improving care.
        </p>
      </div>

      {!brief && !isGenerating && !error && (
        <div className="glass-card p-8 flex flex-col items-center gap-5 text-center border border-primary-500/20">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-xl shadow-primary-500/25">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg mb-1">Generate AI Copilot Brief</p>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              AI will analyze your {symptomText ? 'symptoms' : 'information'}
              {selectedReportCount > 0 ? ` and ${selectedReportCount} attached report${selectedReportCount > 1 ? 's' : ''}` : ''}{' '}
              to prepare a structured clinical summary for your doctor.
            </p>
          </div>
          <button
            id="generate-brief-btn"
            onClick={onGenerate}
            className="btn-primary px-8 py-3 text-sm flex items-center gap-2"
          >
            <Brain className="w-4 h-4" />
            Generate AI Brief
          </button>
          <p className="text-xs text-slate-600">
            Takes about 5–10 seconds • You can skip this step
          </p>
        </div>
      )}

      {isGenerating && (
        <div className="glass-card p-10 flex flex-col items-center gap-5 text-center">
          {/* AI thinking animation */}
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-2 border-primary-500/30 border-t-primary-500"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="w-7 h-7 text-primary-400" />
            </div>
          </div>
          <div>
            <p className="text-white font-semibold mb-1">Analyzing your information…</p>
            <p className="text-sm text-slate-400">AI is preparing your consultation brief</p>
          </div>
          <div className="flex gap-1.5">
            {['Translating symptoms', 'Analyzing reports', 'Generating brief'].map((step, i) => (
              <motion.span
                key={step}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 1.5 }}
                className="text-xs px-2.5 py-1 rounded-full bg-primary-500/15 border border-primary-500/30 text-primary-400"
              >
                {step}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card p-6 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-amber-400 font-medium">AI Brief Unavailable</p>
          </div>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={onGenerate} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5" />
              Retry
            </button>
            <p className="text-xs text-slate-600">Your appointment will proceed without an AI brief</p>
          </div>
        </div>
      )}

      {brief && !isGenerating && (
        <div className="space-y-4">
          <AIConsultationBrief brief={brief} compact={false} />
          <button
            onClick={onGenerate}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Loader2 className="w-3.5 h-3.5" />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   STEP 6 — Confirm
   ════════════════════════════════════════ */
function Step6Confirm({ specialty, doctor, booking, symptomText, selectedReportCount, brief }) {
  const profile = doctor?.doctorProfile || {};

  /* Find fee from doctor's consultation modes */
  const modes = profile.consultationModes || [];
  const modeConfig = modes.find((m) => m.mode === booking.consultationType && m.enabled);
  const fee   = modeConfig?.fee ?? profile.consultationFee ?? 0;
  const total = fee;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Confirm Your Appointment</h2>
        <p className="text-sm text-slate-400">Review all details — payment comes next</p>
      </div>

      {/* Doctor card mini */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-4 pb-4 border-b border-white/8 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {doctor?.name?.[0]}
          </div>
          <div>
            <p className="font-bold text-white text-lg">Dr. {doctor?.name}</p>
            <p className="text-primary-400 text-sm">{specialty}</p>
            <p className="text-slate-500 text-xs">{profile.hospital || 'Private Practice'}</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Date',              value: booking.date ? format(new Date(booking.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy') : '—' },
            { label: 'Time',              value: booking.time || '—' },
            { label: 'Consultation Type', value: booking.consultationType || booking.type || '—' },
            { label: 'Duration',          value: modeConfig ? `${modeConfig.duration} minutes` : '30 minutes' },
            { label: 'Reason',            value: booking.reason || 'Not specified' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-start gap-4">
              <p className="text-slate-500 text-sm flex-shrink-0">{label}</p>
              <p className="text-white text-sm font-medium text-right capitalize">{value}</p>
            </div>
          ))}

          {symptomText && (
            <div className="pt-3 border-t border-white/8">
              <p className="text-slate-500 text-xs mb-1">Symptoms described</p>
              <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">{symptomText}</p>
            </div>
          )}

          {selectedReportCount > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-white/8">
              <Paperclip className="w-4 h-4 text-slate-500" />
              <p className="text-slate-400 text-sm">
                {selectedReportCount} health report{selectedReportCount > 1 ? 's' : ''} attached
              </p>
            </div>
          )}

          {brief && (
            <div className="flex items-center gap-2 pt-2 border-t border-white/8">
              <Brain className="w-4 h-4 text-primary-400" />
              <p className="text-primary-400 text-sm">AI Consultation Brief included</p>
            </div>
          )}
        </div>
      </div>

      {/* Fee Summary */}
      <div className="glass-card p-4 border border-primary-500/20">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Fee Summary</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Consultation Fee</span>
            <span className="text-white font-medium">₹{fee.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Platform Fee</span>
            <span className="text-slate-500">Included</span>
          </div>
          <div className="flex justify-between items-center border-t border-white/10 pt-2 mt-1">
            <span className="text-white font-bold">Total Payable</span>
            <span className="text-primary-400 font-bold text-xl">₹{total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 border border-amber-500/20">
        <p className="text-xs text-amber-400/80">
          By confirming, you agree to the cancellation policy. Payment is required to confirm the appointment.
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════ */
function BookAppointmentPage() {
  const navigate = useNavigate();

  const {
    specialty, setSpecialty,
    doctor, setDoctor,
    booking, setBooking,
    symptomText, setSymptomText,
    symptomTranscript, setSymptomTranscript,
    symptoms, setSymptoms,
    selectedReportIds, toggleReportSelection,
    aiConsultationBrief, setAIConsultationBrief,
    isGeneratingBrief, setGeneratingBrief,
    briefError, setBriefError,
    canProceedToStep,
    reset,
  } = useAppointmentStore();

  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState(null); // after booking, before payment

  /* Validate step before advancing */
  const canAdvance = () => {
    if (step === 0) return !!specialty;
    if (step === 1) return !!doctor;
    if (step === 2) return !!booking.date && !!booking.time && !!booking.reason?.trim();
    if (step === 3) return true;  // symptoms optional
    if (step === 4) return true;  // reports optional
    if (step === 5) return true;  // brief optional (can skip)
    if (step === 6) return true;  // confirm
    if (step === 7) return false; // payment step handles its own navigation
    return true;
  };

  /* Generate AI brief */
  const handleGenerateBrief = useCallback(async () => {
    setGeneratingBrief(true);
    setBriefError(null);
    try {
      const { data } = await aiApi.generateConsultationBrief({
        symptomText,
        symptomTranscript,
        reportIds: selectedReportIds,
      });
      /* brief may be null if AI failed gracefully — treat as no-brief, don't error */
      const brief = data.data?.brief ?? data.brief ?? null;
      if (brief) {
        setAIConsultationBrief(brief);
      } else {
        setBriefError('AI brief could not be generated right now. You can still book your appointment.');
      }
    } catch (err) {
      setBriefError(err.response?.data?.message || 'AI brief generation failed. You can still book your appointment.');
    }
  }, [symptomText, symptomTranscript, selectedReportIds, setGeneratingBrief, setBriefError, setAIConsultationBrief]);

  /* Auto-trigger brief when user lands on step 5 (only once, only if no brief yet) */
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (step === 5 && !aiConsultationBrief && !isGeneratingBrief && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      const timer = setTimeout(() => handleGenerateBrief(), 300);
      return () => clearTimeout(timer);
    }
    if (step !== 5) autoTriggeredRef.current = false; // reset if they go back
  }, [step, aiConsultationBrief, isGeneratingBrief, handleGenerateBrief]);

  /* Submit appointment — creates appointment in PENDING state, then moves to Payment step */
  const handleSubmit = async () => {
    if (!booking.reason?.trim()) {
      toast.error('Please provide a reason for the visit');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await appointmentsApi.book({
        doctorId:            doctor._id,
        date:                booking.date,
        time:                booking.time,
        consultationType:    booking.consultationType || booking.type,
        reason:              booking.reason,
        symptoms:            symptoms,
        symptomTranscript:   symptomText || symptomTranscript,
        uploadedReportIds:   selectedReportIds,
        aiConsultationBrief: aiConsultationBrief,
      });
      const appt = data.data?.appointment ?? data.appointment;

      /* ── Diagnostic logging ── */
      console.log('[BookAppointment] Appointment created:', {
        appointmentId:    appt?._id,
        consultationFee:  appt?.consultationFee,
        consultationType: appt?.consultationType,
        totalAmount:      appt?.totalAmount,
        paymentStatus:    appt?.paymentStatus,
      });

      if (!appt?._id) {
        toast.error('Appointment was created but ID is missing. Please try again.');
        return;
      }
      if (!appt?.consultationFee && !appt?.totalAmount) {
        console.warn('[BookAppointment] consultationFee is 0 — doctor may not have configured a fee for this consultation type.');
      }

      setBookedAppointment(appt);
      /* Advance to Payment step (step 7) */
      setStep(7);
      toast('Appointment created! Please complete payment to confirm.', { icon: '💳' });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  /* Payment success handler */
  const handlePaymentSuccess = (confirmedAppt) => {
    reset();
    setTimeout(() => navigate('/appointments'), 2500);
  };

  /* Payment failure handler */
  const handlePaymentFailure = () => {
    /* Stay on step 7 — retry is available */
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else { reset(); navigate('/appointments'); }
  };

  const goNext = () => {
    /* Step 6 = Confirm — must call handleSubmit() to create the appointment first */
    if (step === 6) return handleSubmit();
    /* Steps 0-5: advance to next step */
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="section-heading flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary-400" />
          Book an Appointment
        </h1>
        <p className="section-subheading mt-1">
          AI-powered booking with pre-consultation intelligence
        </p>
      </div>

      <StepIndicator step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="glass-card p-6 lg:p-8 mb-6"
        >
          {step === 0 && (
            <Step0Specialty value={specialty} onChange={setSpecialty} />
          )}
          {step === 1 && (
            <Step1Doctor specialty={specialty} value={doctor} onChange={setDoctor} />
          )}
          {step === 2 && (
            <Step2Schedule
              doctor={doctor}
              value={booking}
              onChange={setBooking}
            />
          )}
          {step === 3 && (
            <Step3Symptoms
              symptomText={symptomText}
              onSymptomTextChange={(text) => {
                setSymptomText(text);
                setSymptomTranscript(text);
              }}
              symptomTags={symptoms}
              onTagsChange={setSymptoms}
            />
          )}
          {step === 4 && (
            <Step4Reports
              selectedIds={selectedReportIds}
              onToggle={toggleReportSelection}
            />
          )}
          {step === 5 && (
            <Step5AIBrief
              brief={aiConsultationBrief}
              isGenerating={isGeneratingBrief}
              error={briefError}
              onGenerate={handleGenerateBrief}
              symptomText={symptomText}
              selectedReportCount={selectedReportIds.length}
            />
          )}
          {step === 6 && (
            <Step6Confirm
              specialty={specialty}
              doctor={doctor}
              booking={booking}
              symptomText={symptomText}
              selectedReportCount={selectedReportIds.length}
              brief={aiConsultationBrief}
            />
          )}
          {step === 7 && (
            <PaymentStep
              appointment={bookedAppointment}
              doctor={doctor}
              onSuccess={handlePaymentSuccess}
              onFailure={handlePaymentFailure}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={goBack}
          className="btn-ghost text-sm px-5 py-2.5 flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : step === 7 ? 'Back to Appointments' : 'Back'}
        </button>

        <div className="flex items-center gap-3">
          {/* Skip for optional steps */}
          {(step === 3 || step === 4 || step === 5) && (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors px-3 py-2.5"
            >
              Skip
            </button>
          )}

          {/* Hide Next/Confirm button on Payment step (PaymentStep handles that) */}
          {step !== 7 && (
            <button
              id={step === 6 ? 'confirm-booking' : 'booking-next'}
              onClick={goNext}
              disabled={!canAdvance() || submitting}
              className="btn-primary text-sm px-6 py-2.5 flex items-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</>
              ) : step === 6 ? (
                <><CreditCard className="w-4 h-4" /> Proceed to Payment</>
              ) : (
                <>Next <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookAppointmentPage;
