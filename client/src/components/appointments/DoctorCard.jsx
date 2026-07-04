/**
 * components/appointments/DoctorCard.jsx
 *
 * Premium doctor selection card for the booking wizard.
 * Designed to feel like a high-end healthcare app.
 *
 * Shows:
 *  - Gradient avatar with initials
 *  - Name, specialization badge
 *  - Star rating, experience, consultation fee
 *  - Languages spoken chips
 *  - Hospital name
 *  - Next available slot badge
 *  - Selection state with ring animation
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Star, Clock, MapPin, Languages, CheckCircle2, IndianRupee } from 'lucide-react';

/* Gradient palette keyed by specialization */
const SPEC_GRADIENTS = {
  'General Physician': 'from-blue-500 to-blue-700',
  'Cardiologist':      'from-rose-500 to-red-700',
  'Neurologist':       'from-violet-500 to-purple-700',
  'Dermatologist':     'from-amber-500 to-orange-600',
  'Orthopedist':       'from-emerald-500 to-green-700',
  'Gynecologist':      'from-pink-500 to-rose-700',
  'Paediatrician':     'from-sky-400 to-blue-600',
  'Psychiatrist':      'from-indigo-500 to-purple-600',
};

function getGradient(spec) {
  return SPEC_GRADIENTS[spec] || 'from-primary-500 to-primary-700';
}

/* Format next available text from availability schedule */
function getNextAvailable(doctor) {
  const avail = doctor.doctorProfile?.availability;
  if (!avail?.days?.length) return 'Check availability';
  const days = avail.days;
  const now = new Date();
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = dayNames[now.getDay()];
  if (days.includes(today)) {
    const hour = now.getHours();
    const startH = parseInt(avail.startTime?.split(':')[0] || '9');
    const endH   = parseInt(avail.endTime?.split(':')[0] || '17');
    if (hour < endH) {
      return `Today • ${avail.startTime || '09:00'}`;
    }
  }
  return `${avail.startTime || '09:00'} – ${avail.endTime || '17:00'}`;
}

/**
 * @param {{
 *   doctor: object,
 *   selected: boolean,
 *   onClick: () => void,
 * }} props
 */
export function DoctorCard({ doctor, selected, onClick }) {
  const profile    = doctor.doctorProfile || {};
  const initials   = doctor.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';
  const gradient   = getGradient(profile.specialization);
  const rating     = profile.rating?.toFixed(1) ?? '4.5';
  const fee        = profile.consultationFee ?? 0;
  const experience = profile.experience ?? 0;
  const languages  = profile.languages?.slice(0, 3) ?? ['English'];
  const nextSlot   = getNextAvailable(doctor);

  return (
    <motion.button
      layout
      onClick={onClick}
      id={`doctor-card-${doctor._id}`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden ${
        selected
          ? 'border-primary-500 bg-primary-500/10 ring-2 ring-primary-500/30 shadow-lg shadow-primary-500/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      {/* Selected checkmark */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-4 right-4"
        >
          <CheckCircle2 className="w-5 h-5 text-primary-400" />
        </motion.div>
      )}

      {/* Top row — avatar + name */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg`}>
          {initials}
        </div>

        {/* Name & spec */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-bold text-white text-base leading-tight">Dr. {doctor.name}</p>
          <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r ${gradient} text-white`}>
            {profile.specialization}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex flex-col items-center py-2.5 rounded-xl bg-white/5">
          <div className="flex items-center gap-0.5 text-amber-400 mb-0.5">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span className="text-sm font-bold text-white">{rating}</span>
          </div>
          <span className="text-xs text-slate-500">Rating</span>
        </div>
        <div className="flex flex-col items-center py-2.5 rounded-xl bg-white/5">
          <span className="text-sm font-bold text-white mb-0.5">{experience}<span className="text-xs text-slate-400"> yr</span></span>
          <span className="text-xs text-slate-500">Experience</span>
        </div>
        <div className="flex flex-col items-center py-2.5 rounded-xl bg-white/5">
          <div className="flex items-center gap-0.5">
            <IndianRupee className="w-3 h-3 text-success-400" />
            <span className="text-sm font-bold text-white">{fee}</span>
          </div>
          <span className="text-xs text-slate-500">Fee</span>
        </div>
      </div>

      {/* Hospital */}
      {profile.hospital && (
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <p className="text-xs text-slate-400 truncate">{profile.hospital}</p>
        </div>
      )}

      {/* Next available */}
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-success-400 flex-shrink-0" />
        <p className="text-xs text-success-400 font-medium">{nextSlot}</p>
      </div>

      {/* Languages */}
      {languages.length > 0 && (
        <div className="flex items-center gap-2">
          <Languages className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            {languages.map((lang) => (
              <span
                key={lang}
                className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-slate-400 border border-white/10"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.button>
  );
}

export default DoctorCard;
