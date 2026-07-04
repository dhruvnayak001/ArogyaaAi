/**
 * components/ui/PageLoader.jsx
 * Full-screen animated loading state shown during route transitions
 * and initial auth check.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-950">
      {/* Animated logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6"
      >
        {/* Logo icon with pulse ring */}
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-2xl bg-primary-500/30"
          />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-glow-primary">
            <Activity className="w-9 h-9 text-white" />
          </div>
        </div>

        {/* Brand name */}
        <div className="text-center">
          <p className="text-xl font-display font-bold gradient-text">ArogyaAI</p>
          <p className="text-xs text-slate-500 mt-1 tracking-widest uppercase">Loading...</p>
        </div>

        {/* Animated progress dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-primary-400"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{
                duration:  0.9,
                repeat:    Infinity,
                delay:     i * 0.2,
                ease:      'easeInOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default PageLoader;
