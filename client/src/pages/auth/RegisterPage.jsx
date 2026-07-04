/**
 * pages/auth/RegisterPage.jsx
 * New patient or doctor registration form
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Stethoscope } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate  = useNavigate();
  const register_ = useAuthStore((s) => s.register);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', email: '', password: '', role: 'patient' } });

  const selectedRole = watch('role');

  const onSubmit = async (data) => {
    try {
      const user = await register_(data);
      toast.success('Account created! Welcome to ArogyaAI.');
      navigate(user.role === 'doctor' ? '/doctor/dashboard' : '/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white mb-1.5">Create your account</h1>
        <p className="text-slate-400 text-sm">Join 50,000+ users on ArogyaAI</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Role selector */}
        <div>
          <p className="form-label">I am a...</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'patient', label: 'Patient',  Icon: User         },
              { value: 'doctor',  label: 'Doctor',   Icon: Stethoscope  },
            ].map(({ value, label, Icon }) => (
              <label
                key={value}
                htmlFor={`role-${value}`}
                className={clsx(
                  'flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200',
                  selectedRole === value
                    ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                )}
              >
                <input
                  id={`role-${value}`}
                  type="radio"
                  value={value}
                  className="sr-only"
                  {...register('role')}
                />
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Full name */}
        <div>
          <label htmlFor="name" className="form-label">Full name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="name"
              type="text"
              placeholder="Dr. Jane Smith"
              className={clsx('input-field pl-10', errors.name && 'input-error')}
              {...register('name', {
                required:  'Full name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
              })}
            />
          </div>
          {errors.name && <p className="mt-1.5 text-xs text-danger-400">{errors.name.message}</p>}
        </div>

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
                pattern:  { value: /^\S+@\S+\.\S+$/, message: 'Invalid email address' },
              })}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-danger-400">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="reg-password" className="form-label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimum 8 characters"
              className={clsx('input-field pl-10 pr-11', errors.password && 'input-error')}
              {...register('password', {
                required:  'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters required' },
                pattern: {
                  value:   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Must include uppercase, lowercase, and a number',
                },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="Toggle password"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-danger-400">{errors.password.message}</p>}
        </div>

        {/* Terms */}
        <p className="text-xs text-slate-500 leading-relaxed">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-primary-400 hover:underline">Terms of Service</a>{' '}
          and{' '}
          <a href="#" className="text-primary-400 hover:underline">Privacy Policy</a>.
        </p>

        <motion.button
          id="register-submit"
          type="submit"
          className="btn-primary w-full py-3.5"
          disabled={isSubmitting}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating account...
            </span>
          ) : (
            'Create Account'
          )}
        </motion.button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-400 font-medium hover:text-primary-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default RegisterPage;
