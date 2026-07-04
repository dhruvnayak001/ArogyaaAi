/**
 * components/ui/EmptyState.jsx
 * Consistent empty state component for lists and data sections
 */

import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'glass-card p-12 flex flex-col items-center justify-center text-center gap-4',
        className
      )}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <Icon className="w-8 h-8 text-slate-600" />
        </div>
      )}
      <div>
        <p className="text-white font-semibold text-base">{title}</p>
        {description && (
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export default EmptyState;
