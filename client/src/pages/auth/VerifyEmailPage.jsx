/**
 * pages/auth/VerifyEmailPage.jsx
 * Email OTP verification page
 *
 * Features:
 *  - 6 animated individual digit inputs
 *  - Auto-advance on digit entry
 *  - Paste handling for full OTP
 *  - Resend button with 60-second countdown timer
 *  - Attempt tracking with error display
 *  - Success state with confetti-style animation + auto-redirect
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RotateCcw, CheckCircle2, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { authApi } from '@api/auth.api';
import { useAuthStore } from '@store/authStore';
import toast from 'react-hot-toast';

const OTP_LENGTH         = 6;
const RESEND_COOLDOWN    = 60; // seconds
const AUTO_SEND_ON_MOUNT = true;

/* ── Single digit box ── */
function OtpBox({ idx, value, onChange, onKeyDown, onPaste, inputRef, hasError, isSuccess }) {
  return (
    <motion.input
      ref={(el) => { if (inputRef) inputRef.current[idx] = el; }}
      id={`otp-digit-${idx}`}
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={(e) => onChange(idx, e.target.value)}
      onKeyDown={(e) => onKeyDown(idx, e)}
      onPaste={idx === 0 ? onPaste : undefined}
      className={`w-12 h-14 text-center text-2xl font-bold font-mono rounded-2xl border-2 outline-none transition-all duration-200 bg-dark-800
        ${isSuccess
          ? 'border-success-500 text-success-400 bg-success-500/10'
          : hasError
          ? 'border-danger-500 text-danger-400 bg-danger-500/10'
          : value
          ? 'border-primary-500 text-white bg-primary-500/10'
          : 'border-white/10 text-white focus:border-primary-400 focus:bg-primary-500/5'}
      `}
      animate={hasError ? { x: [-4, 4, -4, 4, 0] } : {}}
      transition={{ duration: 0.3 }}
    />
  );
}

/* ════════════════════════════════════════
   Main Page
════════════════════════════════════════ */
export default function VerifyEmailPage() {
  const navigate   = useNavigate();
  const user       = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [digits,    setDigits]    = useState(Array(OTP_LENGTH).fill(''));
  const [loading,   setLoading]   = useState(false);
  const [hasError,  setHasError]  = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);   // seconds remaining
  const [otpSent,   setOtpSent]   = useState(false);

  const inputsRef = useRef([]);
  const timerRef  = useRef(null);

  /* Start countdown */
  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /* Send OTP on mount */
  useEffect(() => {
    if (AUTO_SEND_ON_MOUNT && !otpSent) {
      handleSendOtp();
    }
    return () => clearInterval(timerRef.current);
  }, []);

  /* Redirect if already verified */
  useEffect(() => {
    if (user?.isEmailVerified) {
      const dest = user?.role === 'doctor' ? '/doctor/dashboard' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [user, navigate]);

  /* Focus first input after OTP is sent */
  useEffect(() => {
    if (otpSent) {
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    }
  }, [otpSent]);

  const handleSendOtp = async () => {
    setResending(true);
    try {
      await authApi.sendOtp();
      toast.success('Code sent successfully');
      setOtpSent(true);
      startCountdown();
      setErrorMsg('');
      setDigits(Array(OTP_LENGTH).fill(''));
    } catch (err) {
      /* Axios interceptor normalizes errors — use err.message directly */
      const msg = err.message || 'Failed to send verification code';
      /* If cooldown active, still show OTP inputs so user can enter existing code */
      if (err.statusCode === 429) {
        setOtpSent(true);
        const waitMatch = msg.match(/(\d+) second/);
        if (waitMatch) {
          setCountdown(parseInt(waitMatch[1], 10));
          startCountdown();
        }
      }
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  /* ── Digit change ── */
  const handleChange = (idx, raw) => {
    const digit = raw.replace(/\D/, '').slice(-1);
    const next  = [...digits];
    next[idx]   = digit;
    setDigits(next);
    setHasError(false);
    setErrorMsg('');

    /* Auto-advance */
    if (digit && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }

    /* Auto-submit when all filled */
    if (digit && next.every(Boolean)) {
      handleVerify(next.join(''));
    }
  };

  /* ── Keyboard nav ── */
  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits];
        next[idx]  = '';
        setDigits(next);
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  /* ── Paste handling ── */
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...Array(OTP_LENGTH).fill('')];
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (pasted.length === OTP_LENGTH) handleVerify(pasted);
  };

  /* ── Verify ── */
  const handleVerify = async (otp = digits.join('')) => {
    if (otp.length !== OTP_LENGTH) {
      setHasError(true);
      setErrorMsg('Please enter all 6 digits.');
      return;
    }
    setLoading(true);
    setHasError(false);
    setErrorMsg('');
    try {
      await authApi.verifyOtp({ otp });
      setSuccess(true);
      updateUser({ isEmailVerified: true });
      toast.success('Email verified! Welcome to ArogyaAI 🎉');
      const dest = user?.role === 'doctor' ? '/doctor/dashboard' : '/dashboard';
      setTimeout(() => navigate(dest, { replace: true }), 2000);
    } catch (err) {
      /* Axios interceptor normalizes errors — use err.message */
      const msg = err.message ?? 'Invalid OTP';
      setHasError(true);
      setErrorMsg(msg);
      /* Shake + clear digits on wrong OTP */
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => { inputsRef.current[0]?.focus(); setHasError(false); }, 600);
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = user?.email
    ? user.email.replace(/^(.{2})(.+)(@.+)$/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : '...';

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="glass-card p-8 sm:p-10 text-center">

          {/* Icon */}
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="flex justify-center mb-6"
              >
                <div className="w-20 h-20 rounded-3xl bg-success-500/15 border border-success-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-success-400" />
                </div>
              </motion.div>
            ) : (
              <motion.div key="mail" className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-glow-primary">
                  <Mail className="w-10 h-10 text-white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Heading */}
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-display font-bold text-white mb-2">
                  Email Verified! 🎉
                </h1>
                <p className="text-slate-400 text-sm">Redirecting to your dashboard...</p>
              </motion.div>
            ) : (
              <motion.div key="verify-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-display font-bold text-white mb-2">
                  Verify Your Email
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <span className="text-white font-medium">{maskedEmail}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <>
              {/* OTP input grid */}
              <div className="flex justify-center gap-2 sm:gap-3 mt-8">
                {digits.map((d, i) => (
                  <OtpBox
                    key={i}
                    idx={i}
                    value={d}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    inputRef={inputsRef}
                    hasError={hasError}
                    isSuccess={success}
                  />
                ))}
              </div>

              {/* Error message */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm text-left"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Verify button */}
              <motion.button
                id="verify-otp-btn"
                onClick={() => handleVerify()}
                disabled={loading || digits.join('').length !== OTP_LENGTH}
                whileTap={{ scale: 0.97 }}
                className="btn-primary w-full mt-6 py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    <ShieldCheck className="w-4 h-4" /> Verify Email
                  </span>
                )}
              </motion.button>

              {/* Resend section */}
              <div className="mt-6 flex items-center justify-center gap-2 text-sm">
                <span className="text-slate-500">Didn't receive it?</span>
                {countdown > 0 ? (
                  <span className="text-slate-400 font-medium tabular-nums">
                    Resend in <span className="text-primary-400">{countdown}s</span>
                  </span>
                ) : (
                  <button
                    id="resend-otp-btn"
                    onClick={handleSendOtp}
                    disabled={resending}
                    className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300 font-medium transition-colors disabled:opacity-60"
                  >
                    {resending
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                      : <><RotateCcw className="w-3.5 h-3.5" /> Resend code</>
                    }
                  </button>
                )}
              </div>

              {/* Skip link */}
                <button
                  onClick={() => navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/dashboard')}
                  className="mt-4 text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Skip for now → I'll verify later
                </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
