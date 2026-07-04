/**
 * pages/doctor/DoctorNotFoundPage.jsx
 * Shown when a doctor navigates to an unknown /doctor/* route.
 * Renders inside DoctorLayout — keeps the doctor shell intact.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Stethoscope, ArrowLeft } from 'lucide-react';

function DoctorNotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent-600/20 to-primary-500/20 border border-white/10 flex items-center justify-center"
      >
        <Stethoscope className="w-10 h-10 text-accent-400" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-2"
      >
        <h1 className="text-5xl font-display font-bold text-white">404</h1>
        <p className="text-lg font-semibold text-slate-300">Page not found</p>
        <p className="text-sm text-slate-500 max-w-sm">
          This page doesn't exist in the Doctor Portal. Navigate back using the sidebar.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Link
          to="/doctor/dashboard"
          id="doctor-404-back-btn"
          className="inline-flex items-center gap-2 btn-primary px-6 py-2.5 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}

export default DoctorNotFoundPage;
