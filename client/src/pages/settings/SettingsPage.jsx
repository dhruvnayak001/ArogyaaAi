/**
 * pages/settings/SettingsPage.jsx
 * App settings: notifications, theme, privacy
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Shield, Trash2, Moon, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

import { authApi } from '@api/auth.api';
import { useAuthStore } from '@store/authStore';

function ToggleSwitch({ id, checked, onChange }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary-500' : 'bg-white/15'}`}
    >
      <motion.span
        layout
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 700, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
      />
    </button>
  );
}

const SETTINGS_GROUPS = [
  {
    icon:     Bell,
    title:    'Notifications',
    color:    'text-primary-400',
    settings: [
      { key: 'emailNotifications',      label: 'Email notifications',        sub: 'Receive appointment reminders via email' },
      { key: 'pushNotifications',       label: 'Push notifications',         sub: 'In-browser push alerts' },
      { key: 'emergencyAlerts',         label: 'Emergency alerts',           sub: 'Critical health alerts — recommended ON' },
      { key: 'appointmentReminders',    label: 'Appointment reminders',      sub: '24h and 1h before appointments' },
    ],
  },
  {
    icon:     Shield,
    title:    'Privacy & Security',
    color:    'text-accent-400',
    settings: [
      { key: 'shareWithDoctors',     label: 'Share records with doctors',   sub: 'Allow assigned doctors to view your records' },
      { key: 'anonymousData',        label: 'Anonymous analytics',          sub: 'Help improve ArogyaAI (no personal data)' },
    ],
  },
];

function SettingsPage() {
  const { logout } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [prefs, setPrefs] = useState({
    emailNotifications:   true,
    pushNotifications:    false,
    emergencyAlerts:      true,
    appointmentReminders: true,
    shareWithDoctors:     true,
    anonymousData:        false,
  });

  const toggle = (key) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    toast.success('Setting updated');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure? This will permanently delete your account, appointments, and all health records. This action cannot be undone.')) {
      return;
    }
    try {
      setIsDeleting(true);
      await authApi.deleteAccount();
      logout(); // clear local state and redirect to login
      toast.success('Account deleted successfully');
    } catch (err) {
      setIsDeleting(false);
      toast.error(err.response?.data?.message || 'Failed to delete account');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="section-heading">Settings</h1>
        <p className="section-subheading mt-1">Manage your notification and privacy preferences</p>
      </div>

      {SETTINGS_GROUPS.map((group) => (
        <motion.div
          key={group.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <group.icon className={`w-5 h-5 ${group.color}`} />
            <h2 className="text-base font-semibold text-white">{group.title}</h2>
          </div>
          <div className="space-y-5">
            {group.settings.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">{s.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
                </div>
                <ToggleSwitch
                  id={`setting-${s.key}`}
                  checked={prefs[s.key]}
                  onChange={() => toggle(s.key)}
                />
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6 border border-danger-500/20"
      >
        <div className="flex items-center gap-2 mb-5">
          <Trash2 className="w-5 h-5 text-danger-400" />
          <h2 className="text-base font-semibold text-white">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Delete Account</p>
            <p className="text-xs text-slate-500 mt-0.5">Permanently delete your account and all associated data</p>
          </div>
          <button
            id="delete-account-btn"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="btn-danger text-sm px-4 py-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default SettingsPage;
