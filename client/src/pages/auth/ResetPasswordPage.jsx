/**
 * pages/auth/ResetPasswordPage.jsx
 * Reset password using token from email link
 */

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@api/auth.api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();
  const token            = searchParams.get('token');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = async ({ password }) => {
    if (!token) {
      toast.error('Invalid or expired reset link');
      return;
    }
    try {
      await authApi.resetPassword({ token, password });
      toast.success('Password reset successfully!');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Reset failed. Link may have expired.');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white mb-1.5">Set new password</h1>
        <p className="text-slate-400 text-sm">Choose a strong password for your account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label htmlFor="new-password" className="form-label">New password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimum 8 characters"
              className={clsx('input-field pl-10 pr-11', errors.password && 'input-error')}
              {...register('password', {
                required:  'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
                pattern:   { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Must contain uppercase, lowercase, and number' },
              })}
            />
            <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-danger-400">{errors.password.message}</p>}
        </div>

        <div>
          <label htmlFor="confirm-password" className="form-label">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat new password"
              className={clsx('input-field pl-10', errors.confirmPassword && 'input-error')}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate:  (val) => val === watch('password') || 'Passwords do not match',
              })}
            />
          </div>
          {errors.confirmPassword && <p className="mt-1.5 text-xs text-danger-400">{errors.confirmPassword.message}</p>}
        </div>

        <motion.button
          id="reset-password-submit"
          type="submit"
          className="btn-primary w-full py-3.5"
          disabled={isSubmitting || !token}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Resetting...
            </span>
          ) : 'Reset Password'}
        </motion.button>
      </form>

      <Link
        to="/login"
        className="mt-6 flex items-center justify-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Back to Sign In
      </Link>
    </div>
  );
}

export default ResetPasswordPage;
