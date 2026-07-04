/**
 * pages/auth/LoginPage.jsx
 * Patient/Doctor login form
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (data) => {
    try {
      const user = await login(data);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);

      const isDoctor = user.role === 'doctor';
      const defaultDest = isDoctor ? '/doctor/dashboard' : '/dashboard';
      const from = location.state?.from;

      /* Only use location.state.from if it matches the user's role namespace.
         Prevents a patient being redirected to a /doctor/* path they bookmarked
         before logging out, or vice versa. */
      const safeDest =
        from && (
          (isDoctor  && from.startsWith('/doctor')) ||
          (!isDoctor && !from.startsWith('/doctor') && from !== '/')
        )
          ? from
          : defaultDest;

      navigate(safeDest, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white mb-1.5">Welcome back</h1>
        <p className="text-slate-400 text-sm">Sign in to your ArogyaAI account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="form-label">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className={clsx('input-field pl-10', errors.email && 'input-error')}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email address' },
              })}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-danger-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="form-label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              className={clsx('input-field pl-10 pr-11', errors.password && 'input-error')}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-danger-400">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <motion.button
          id="login-submit"
          type="submit"
          className="btn-primary w-full py-3.5"
          disabled={isSubmitting}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Signing in...
            </span>
          ) : (
            'Sign In'
          )}
        </motion.button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary-400 font-medium hover:text-primary-300 transition-colors">
          Create account
        </Link>
      </p>
    </div>
  );
}

export default LoginPage;
