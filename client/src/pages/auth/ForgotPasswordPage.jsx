/**
 * pages/auth/ForgotPasswordPage.jsx
 * Request password reset email form
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authApi } from '@api/auth.api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm({ defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    try {
      await authApi.forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email');
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-success-500/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-success-400" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-3">Check your inbox</h2>
        <p className="text-slate-400 text-sm mb-8">
          We've sent a password reset link to{' '}
          <span className="text-white font-medium">{getValues('email')}</span>.
        </p>
        <Link to="/login" className="btn-primary w-full">Back to Sign In</Link>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white mb-1.5">Reset your password</h1>
        <p className="text-slate-400 text-sm">Enter your email to receive a reset link</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label htmlFor="forgot-email" className="form-label">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="forgot-email"
              type="email"
              placeholder="you@example.com"
              className={clsx('input-field pl-10', errors.email && 'input-error')}
              {...register('email', {
                required: 'Email is required',
                pattern:  { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
              })}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-danger-400">{errors.email.message}</p>}
        </div>

        <motion.button
          id="forgot-submit"
          type="submit"
          className="btn-primary w-full py-3.5"
          disabled={isSubmitting}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </span>
          ) : 'Send Reset Link'}
        </motion.button>
      </form>

      <Link
        to="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Sign In
      </Link>
    </div>
  );
}

export default ForgotPasswordPage;
