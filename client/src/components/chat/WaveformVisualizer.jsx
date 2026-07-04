/**
 * components/chat/WaveformVisualizer.jsx
 * Animated waveform bars shown while the microphone is actively listening.
 *
 * Uses Framer Motion for smooth bar animations with staggered delays
 * and randomized heights to simulate a real audio waveform.
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';

const BAR_COUNT = 5;

/**
 * @param {object}  props
 * @param {boolean} props.active  - Whether the waveform should animate
 * @param {string}  [props.color] - Tailwind color class for bars (default: primary-400)
 * @param {'sm'|'md'|'lg'} [props.size] - Size preset
 */
function WaveformVisualizer({ active = false, color = 'bg-primary-400', size = 'sm' }) {
  const sizeConfig = {
    sm: { barWidth: 'w-[3px]', height: 16, gap: 'gap-[3px]' },
    md: { barWidth: 'w-[4px]', height: 24, gap: 'gap-1' },
    lg: { barWidth: 'w-[5px]', height: 32, gap: 'gap-1' },
  };

  const { barWidth, height, gap } = sizeConfig[size] || sizeConfig.sm;

  return (
    <div
      className={`flex items-center ${gap}`}
      style={{ height }}
      role="img"
      aria-label={active ? 'Listening to your voice' : 'Microphone idle'}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <motion.div
          key={i}
          className={`${barWidth} rounded-full ${color}`}
          animate={
            active
              ? {
                  height: [4, height * 0.4, height * 0.85, height * 0.5, 4],
                  opacity: [0.5, 0.9, 1, 0.8, 0.5],
                }
              : { height: 4, opacity: 0.3 }
          }
          transition={
            active
              ? {
                  duration: 0.8 + Math.random() * 0.4,
                  repeat: Infinity,
                  repeatType: 'loop',
                  delay: i * 0.08,
                  ease: 'easeInOut',
                }
              : { duration: 0.3 }
          }
          style={{ minHeight: 3 }}
        />
      ))}
    </div>
  );
}

export default memo(WaveformVisualizer);
