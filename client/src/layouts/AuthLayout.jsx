/**
 * layouts/AuthLayout.jsx
 * Centered split-screen layout for login / register / reset pages.
 * Left: branding panel | Right: auth form
 */

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

const panelVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left branding panel (hidden on mobile) ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #047481 0%, #0f172a 50%, #4c1d95 100%)',
        }}
      >
        {/* Decorative mesh */}
        <div className="absolute inset-0 bg-noise opacity-40 pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent-600/20 rounded-full blur-3xl" />

        <div className="relative z-10 text-center max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <Activity className="w-8 h-8 text-primary-300" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-display font-bold text-white">ArogyaAI</p>
              <p className="text-xs text-primary-300 font-medium tracking-widest uppercase">Healthcare Platform</p>
            </div>
          </div>

          <h2 className="text-3xl font-display font-bold text-white mb-4 text-balance">
            Your Intelligent Health Companion
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-10">
            AI-powered healthcare support, emergency detection, and personalized medical insights — all in one platform.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['AI Chatbot', 'Emergency Detection', 'Voice Assistant', 'Appointment Booking', 'Health Records', 'Doctor Dashboard'].map((feat) => (
              <span
                key={feat}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/15"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-dark-950">
        {/* Mobile logo */}
        <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
          <Activity className="w-7 h-7 text-primary-400" />
          <span className="text-xl font-display font-bold text-white">ArogyaAI</span>
        </Link>

        <motion.div
          className="w-full max-w-md"
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}

export default AuthLayout;
