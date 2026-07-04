import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Save, Camera, CheckCircle2, XCircle } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import apiClient from '@api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function ProfilePage() {
  const user       = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate   = useNavigate();

  const {
    register, handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      name:        user?.name        || '',
      email:       user?.email       || '',
      phone:       user?.phone       || '',
      address:     user?.address     || '',
      dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
      bloodGroup:  user?.bloodGroup  || '',
    },
  });

  const onSubmit = async (data) => {
    try {
      const { data: res } = await apiClient.patch('/auth/me', data);
      /* Merge updated user into store via updateUser (goes through persist middleware) */
      const updatedUser = res.data?.user ?? res.user ?? data;
      updateUser(updatedUser);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Update failed');
    }
  };


  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="section-heading">My Profile</h1>
        <p className="section-subheading mt-1">Manage your personal information and health data</p>
      </div>

      {/* Avatar section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 flex items-center gap-6"
      >
        <div className="relative">
          <div className="avatar-xl text-2xl">{initials}</div>
          <button
            id="change-avatar-btn"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center hover:bg-primary-400 transition-colors shadow-lg"
            title="Change avatar"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>
        <div>
          <p className="font-display font-bold text-white text-lg">{user?.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-sm">{user?.email}</p>
            {user?.isEmailVerified ? (
              <span className="flex items-center gap-1 text-xs text-success-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <button
                onClick={() => navigate('/verify-email')}
                className="flex items-center gap-1 text-xs text-warning-400 hover:text-warning-300 font-medium transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Verify email
              </button>
            )}
          </div>
          <span className="badge badge-primary mt-2 capitalize">{user?.role || 'patient'}</span>
        </div>
      </motion.div>

      {/* Profile form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit(onSubmit)}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="text-base font-semibold text-white">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Full name */}
          <div>
            <label htmlFor="profile-name" className="form-label">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="profile-name"
                type="text"
                className={clsx('input-field pl-10', errors.name && 'input-error')}
                {...register('name', { required: 'Name is required' })}
              />
            </div>
            {errors.name && <p className="mt-1 text-xs text-danger-400">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="profile-email" className="form-label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="profile-email"
                type="email"
                className="input-field pl-10 opacity-60 cursor-not-allowed"
                readOnly
                {...register('email')}
              />
            </div>
            <p className="mt-1 text-2xs text-slate-600">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="profile-phone" className="form-label">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="profile-phone"
                type="tel"
                placeholder="+91 9876543210"
                className="input-field pl-10"
                {...register('phone')}
              />
            </div>
          </div>

          {/* Blood group */}
          <div>
            <label htmlFor="profile-blood-group" className="form-label">Blood Group</label>
            <select id="profile-blood-group" className="input-field" {...register('bloodGroup')}>
              <option value="">Select blood group</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="profile-address" className="form-label">Address</label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            <textarea
              id="profile-address"
              rows={2}
              placeholder="Your address"
              className="input-field pl-10 resize-none"
              {...register('address')}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <motion.button
            id="save-profile-btn"
            type="submit"
            className="btn-primary px-6 py-2.5 text-sm"
            disabled={isSubmitting || !isDirty}
            whileTap={{ scale: 0.97 }}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}

export default ProfilePage;
