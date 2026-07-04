/**
 * pages/doctor/DoctorSettingsPage.jsx
 * Doctor consultation management — consultation modes, availability, cancellation policy,
 * and notification preferences.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Shield, Trash2, Stethoscope, Video, Phone, MapPin, Home,
  Clock, Calendar, DollarSign, Save, Loader2, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Settings, Mic,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@api/auth.api';
import { doctorsApi } from '@api/doctors.api';
import { useAuthStore } from '@store/authStore';

/* ── Toggle Switch ── */
function ToggleSwitch({ id, checked, onChange }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary-500' : 'bg-white/15'}`}
    >
      <motion.span
        layout
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 700, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
      />
    </button>
  );
}

/* ── Consultation Mode Config ── */
const MODE_META = {
  video:  { label: 'Video Consultation', icon: Video,  color: 'from-blue-500 to-blue-700',    bg: 'bg-blue-500/10',   border: 'border-blue-500/30'   },
  voice:  { label: 'Voice Consultation', icon: Phone,  color: 'from-green-500 to-green-700',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
  clinic: { label: 'Clinic Visit',       icon: MapPin, color: 'from-violet-500 to-violet-700', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  home:   { label: 'Home Visit',         icon: Home,   color: 'from-amber-500 to-amber-700',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30'  },
};

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90];
const DEFAULT_MODES = [
  { mode: 'video',  fee: 0, duration: 30, enabled: false, description: '' },
  { mode: 'voice',  fee: 0, duration: 20, enabled: false, description: '' },
  { mode: 'clinic', fee: 0, duration: 30, enabled: false, description: '' },
  { mode: 'home',   fee: 0, duration: 60, enabled: false, description: '' },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS   = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' };

function SectionCard({ icon: Icon, title, color = 'text-primary-400', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${color}`} />
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-0 border-t border-white/8">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DoctorSettingsPage() {
  const { user, logout } = useAuthStore();
  const [isDeleting, setIsDeleting]       = useState(false);
  const [savingModes, setSavingModes]     = useState(false);
  const [savingAvail, setSavingAvail]     = useState(false);
  const [savingPolicy, setSavingPolicy]   = useState(false);

  /* Consultation Modes */
  const [modes, setModes] = useState(DEFAULT_MODES);

  /* Availability */
  const [availability, setAvailability] = useState({
    days:         ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    startTime:    '09:00',
    endTime:      '17:00',
    slotDuration: 30,
    lunchBreak:   { enabled: false, start: '13:00', end: '14:00' },
  });

  /* Cancellation policy */
  const [policy, setPolicy] = useState({
    moreThan24h:     100,
    between12and24h: 50,
    lessThan12h:     0,
  });

  /* Notification prefs */
  const [prefs, setPrefs] = useState({
    emailNotifications: true, pushNotifications: true,
    appointmentReminders: true, patientMessages: true,
    profileVisible: true, onlineBooking: true,
    aiSummaries: true, recordSharing: true,
  });

  /* Load doctor profile on mount */
  useEffect(() => {
    doctorsApi.getOwnProfile().then(({ data }) => {
      const dp = data.data?.doctor?.doctorProfile || {};

      /* Merge saved modes with defaults (keep all 4 modes present) */
      if (Array.isArray(dp.consultationModes) && dp.consultationModes.length > 0) {
        const merged = DEFAULT_MODES.map((def) => {
          const saved = dp.consultationModes.find((m) => m.mode === def.mode);
          return saved ? { ...def, ...saved } : def;
        });
        setModes(merged);
      }

      if (dp.availability) {
        setAvailability((prev) => ({ ...prev, ...dp.availability }));
      }

      if (dp.cancellationPolicy) {
        setPolicy(dp.cancellationPolicy);
      }
    }).catch(() => {});
  }, []);

  /* ── Mode Helpers ── */
  const updateMode = (mode, field, value) => {
    setModes((prev) => prev.map((m) => m.mode === mode ? { ...m, [field]: value } : m));
  };

  /* ── Save Consultation Modes ── */
  const handleSaveModes = async () => {
    setSavingModes(true);
    try {
      await doctorsApi.updateConsultationModes(modes);
      toast.success('Consultation modes saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save modes');
    } finally {
      setSavingModes(false);
    }
  };

  /* ── Save Availability ── */
  const handleSaveAvailability = async () => {
    setSavingAvail(true);
    try {
      await doctorsApi.updateAvailability(availability);
      toast.success('Availability saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save availability');
    } finally {
      setSavingAvail(false);
    }
  };

  /* ── Save Cancellation Policy ── */
  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      await doctorsApi.updateCancellationPolicy(policy);
      toast.success('Cancellation policy saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  /* ── Delete Account ── */
  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure? This will permanently delete your doctor profile, all your schedules, and appointment history. This action cannot be undone.')) return;
    try {
      setIsDeleting(true);
      await authApi.deleteAccount();
      logout();
      toast.success('Doctor account deleted successfully');
    } catch (err) {
      setIsDeleting(false);
      toast.error(err.response?.data?.message || 'Failed to delete account');
    }
  };

  const toggleDay = (day) => {
    setAvailability((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="section-heading">Practice Settings</h1>
        <p className="section-subheading mt-1">Configure your consultation services, availability, and policies</p>
      </div>

      {/* ── Consultation Modes ── */}
      <SectionCard icon={Stethoscope} title="Consultation Modes" color="text-primary-400">
        <div className="space-y-4 mt-4">
          {modes.map((m) => {
            const meta = MODE_META[m.mode];
            const Icon = meta.icon;
            return (
              <motion.div
                key={m.mode}
                layout
                className={`rounded-2xl border p-4 transition-all ${
                  m.enabled
                    ? `${meta.border} ${meta.bg}`
                    : 'border-white/10 opacity-70'
                }`}
              >
                {/* Mode header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{meta.label}</p>
                      <p className="text-xs text-slate-500">{m.enabled ? 'Active' : 'Disabled'}</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    id={`mode-${m.mode}-toggle`}
                    checked={m.enabled}
                    onChange={(v) => updateMode(m.mode, 'enabled', v)}
                  />
                </div>

                <AnimatePresence>
                  {m.enabled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {/* Fee */}
                        <div>
                          <label className="form-label text-xs">Consultation Fee (₹)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                            <input
                              id={`mode-${m.mode}-fee`}
                              type="number"
                              min="0"
                              step="50"
                              value={m.fee}
                              onChange={(e) => updateMode(m.mode, 'fee', Number(e.target.value))}
                              className="input-field pl-7 text-sm"
                            />
                          </div>
                        </div>

                        {/* Duration */}
                        <div>
                          <label className="form-label text-xs">Duration (minutes)</label>
                          <select
                            id={`mode-${m.mode}-duration`}
                            value={m.duration}
                            onChange={(e) => updateMode(m.mode, 'duration', Number(e.target.value))}
                            className="input-field text-sm"
                          >
                            {DURATION_OPTIONS.map((d) => (
                              <option key={d} value={d}>{d} min</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mt-3">
                        <label className="form-label text-xs">Description (optional)</label>
                        <input
                          id={`mode-${m.mode}-desc`}
                          type="text"
                          value={m.description || ''}
                          onChange={(e) => updateMode(m.mode, 'description', e.target.value)}
                          placeholder={`e.g. "HD video call via ArogyaAI platform"`}
                          maxLength={200}
                          className="input-field text-sm"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Fee summary */}
        {modes.some((m) => m.enabled) && (
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Active Mode Summary</p>
            <div className="space-y-1">
              {modes.filter((m) => m.enabled).map((m) => (
                <div key={m.mode} className="flex justify-between text-xs">
                  <span className="text-slate-400">{MODE_META[m.mode].label}</span>
                  <span className="text-white font-medium">₹{m.fee} · {m.duration}min</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          id="save-consultation-modes"
          onClick={handleSaveModes}
          disabled={savingModes}
          className="btn-primary w-full mt-5 text-sm flex items-center justify-center gap-2"
        >
          {savingModes ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Consultation Modes</>}
        </button>
      </SectionCard>

      {/* ── Availability ── */}
      <SectionCard icon={Calendar} title="Availability" color="text-accent-400">
        <div className="space-y-5 mt-4">
          {/* Working Days */}
          <div>
            <p className="form-label text-xs mb-3">Working Days</p>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  id={`day-${day}`}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    availability.days.includes(day)
                      ? 'bg-accent-500/20 border-accent-500/50 text-accent-400'
                      : 'border-white/10 text-slate-500 hover:text-white hover:border-white/20'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          {/* Working Hours */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label text-xs">Start Time</label>
              <input
                id="avail-start-time"
                type="time"
                value={availability.startTime}
                onChange={(e) => setAvailability((p) => ({ ...p, startTime: e.target.value }))}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="form-label text-xs">End Time</label>
              <input
                id="avail-end-time"
                type="time"
                value={availability.endTime}
                onChange={(e) => setAvailability((p) => ({ ...p, endTime: e.target.value }))}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="form-label text-xs">Slot Duration</label>
              <select
                id="avail-slot-duration"
                value={availability.slotDuration}
                onChange={(e) => setAvailability((p) => ({ ...p, slotDuration: Number(e.target.value) }))}
                className="input-field text-sm"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lunch Break */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-medium text-white">Lunch Break</p>
              </div>
              <ToggleSwitch
                id="lunch-break-toggle"
                checked={availability.lunchBreak?.enabled || false}
                onChange={(v) => setAvailability((p) => ({ ...p, lunchBreak: { ...p.lunchBreak, enabled: v } }))}
              />
            </div>
            <AnimatePresence>
              {availability.lunchBreak?.enabled && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="grid grid-cols-2 gap-3 overflow-hidden"
                >
                  <div>
                    <label className="form-label text-xs">Start</label>
                    <input
                      id="lunch-start"
                      type="time"
                      value={availability.lunchBreak?.start || '13:00'}
                      onChange={(e) => setAvailability((p) => ({ ...p, lunchBreak: { ...p.lunchBreak, start: e.target.value } }))}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs">End</label>
                    <input
                      id="lunch-end"
                      type="time"
                      value={availability.lunchBreak?.end || '14:00'}
                      onChange={(e) => setAvailability((p) => ({ ...p, lunchBreak: { ...p.lunchBreak, end: e.target.value } }))}
                      className="input-field text-sm"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <button
          id="save-availability"
          onClick={handleSaveAvailability}
          disabled={savingAvail}
          className="btn-primary w-full mt-5 text-sm flex items-center justify-center gap-2"
        >
          {savingAvail ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Availability</>}
        </button>
      </SectionCard>

      {/* ── Cancellation Policy ── */}
      <SectionCard icon={AlertCircle} title="Cancellation Policy" color="text-warning-400" defaultOpen={false}>
        <div className="space-y-4 mt-4">
          <p className="text-xs text-slate-500">Configure refund percentages based on how far in advance patients cancel.</p>
          {[
            { label: 'More than 24 hours before', key: 'moreThan24h',     color: 'text-success-400' },
            { label: '12 – 24 hours before',      key: 'between12and24h', color: 'text-warning-400' },
            { label: 'Less than 12 hours before', key: 'lessThan12h',     color: 'text-danger-400'  },
          ].map(({ label, key, color }) => (
            <div key={key} className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-white">{label}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`policy-${key}`}
                  type="number"
                  min="0"
                  max="100"
                  step="10"
                  value={policy[key]}
                  onChange={(e) => setPolicy((p) => ({ ...p, [key]: Number(e.target.value) }))}
                  className="input-field w-20 text-sm text-right"
                />
                <span className={`text-sm font-bold ${color}`}>%</span>
              </div>
            </div>
          ))}
        </div>

        <button
          id="save-cancellation-policy"
          onClick={handleSavePolicy}
          disabled={savingPolicy}
          className="btn-primary w-full mt-5 text-sm flex items-center justify-center gap-2"
        >
          {savingPolicy ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Policy</>}
        </button>
      </SectionCard>

      {/* ── Notification Preferences ── */}
      <SectionCard icon={Bell} title="Notifications" color="text-primary-400" defaultOpen={false}>
        <div className="space-y-5 mt-4">
          {[
            { key: 'emailNotifications',   label: 'Email notifications',      sub: 'Receive appointment requests via email' },
            { key: 'pushNotifications',    label: 'Push notifications',       sub: 'In-browser push alerts for new bookings' },
            { key: 'appointmentReminders', label: 'Appointment reminders',    sub: '1h before each scheduled appointment' },
            { key: 'patientMessages',      label: 'Patient messages',         sub: 'Notifications for new patient messages' },
            { key: 'aiSummaries',          label: 'Auto AI Summaries',        sub: 'Generate AI summaries after each consultation' },
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
              </div>
              <ToggleSwitch
                id={`doctor-setting-${s.key}`}
                checked={prefs[s.key]}
                onChange={(v) => { setPrefs((p) => ({ ...p, [s.key]: v })); toast.success('Setting updated'); }}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Danger Zone ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6 border border-danger-500/20"
      >
        <div className="flex items-center gap-2 mb-5">
          <Trash2 className="w-5 h-5 text-danger-400" />
          <h2 className="text-base font-semibold text-white">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Delete Account</p>
            <p className="text-xs text-slate-500 mt-0.5">Permanently delete your doctor account and all associated data</p>
          </div>
          <button
            id="doctor-delete-account-btn"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="btn-danger text-sm px-4 py-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DoctorSettingsPage;
