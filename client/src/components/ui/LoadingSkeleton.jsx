/**
 * components/ui/LoadingSkeleton.jsx
 * Reusable animated skeleton loader
 */

import React from 'react';
import { clsx } from 'clsx';

function LoadingSkeleton({ className, lines = 1, height = 'h-4', rounded = 'rounded-lg' }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx('skeleton', height, rounded, className)}
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 rounded w-2/3" />
              <div className="skeleton h-3 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-card p-3 flex items-center gap-4 animate-pulse">
          <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3.5 rounded w-1/3" />
            <div className="skeleton h-3 rounded w-1/4" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;
