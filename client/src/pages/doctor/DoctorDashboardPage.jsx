/**
 * pages/doctor/DoctorDashboardPage.jsx
 * Doctor analytics dashboard — AI-powered appointments with Copilot cards
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, Users, CheckCircle, Clock, Stethoscope, Star, Brain,
  TrendingUp, IndianRupee, AlertTriangle, CreditCard, Settings,
} from 'lucide-react';
import { appointmentsApi } from '@api/appointments.api';
import { doctorsApi }      from '@api/doctors.api';
import apiClient           from '@api/axios';
import { AIAppointmentCard } from '@components/doctor/AIAppointmentCard';
import { CardSkeleton }    from '@components/ui/LoadingSkeleton';
import { useAuthStore }    from '@store/authStore';
import toast from 'react-hot-toast';
import { format, isToday } from 'date-fns';

const cardV = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

function DoctorDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [appointments, setAppointments] = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [earnings,     setEarnings]     = useState(null);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [loadingPats,  setLoadingPats]  = useState(true);

  useEffect(() => {
    appointmentsApi.getAll()
      .then(({ data }) => setAppointments(data.data?.appointments ?? data.appointments ?? []))
      .catch(() => toast.error('Failed to load appointments'))
      .finally(() => setLoadingAppts(false));
    doctorsApi.getPatients()
      .then(({ data }) => setPatients(data.data?.patients ?? data.patients ?? []))
      .catch(() => {})
      .finally(() => setLoadingPats(false));
    /* Fetch earnings */
    apiClient.get('/payments/earnings')
      .then(({ data }) => setEarnings(data.data?.earnings))
      .catch(() => {});
  }, []);

  const todayAppts     = appointments.filter((a) => isToday(new Date(a.date)));
  const pendingAppts   = appointments.filter((a) => a.status === 'pending');
  const completedAppts = appointments.filter((a) => a.status === 'completed');
  const paidAppts      = appointments.filter((a) => a.paymentStatus === 'paid');

  /* Count appointments with AI briefs */
  const withBrief = appointments.filter((a) => !!a.aiConsultationBrief?.summaryText).length;
  /* Count HIGH/CRITICAL urgency */
  const highRisk = appointments.filter((a) =>
    ['HIGH', 'CRITICAL'].includes(a.aiConsultationBrief?.urgencyLevel)
  ).length;

  const handleStatusUpdate = async (id, status) => {
    try {
      await appointmentsApi.updateStatus(id, { status });
      setAppointments((prev) => prev.map((a) => a._id === id ? { ...a, status } : a));
      toast.success(`Appointment ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'DR';

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="avatar-lg">{initials}</div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Dr. {user?.name}</h1>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              {user?.doctorProfile?.specialization ?? 'Specialist'} •{' '}
              {user?.doctorProfile?.hospital ?? 'Private Practice'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {highRisk > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-danger-500/15 border border-danger-500/30">
              <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
              <span className="text-danger-400 text-xs font-semibold">{highRisk} High Risk</span>
            </div>
          )}
          <div className="flex items-center gap-2 glass-card px-4 py-2.5">
            <Star className="w-4 h-4 text-warning-400" />
            <span className="text-white font-semibold">{user?.doctorProfile?.rating?.toFixed(1) ?? '4.5'}</span>
            <span className="text-slate-500 text-sm">({user?.doctorProfile?.reviewCount ?? 0} reviews)</span>
          </div>
        </div>
      </motion.div>

      {/* ── Settings prompt if no consultation modes configured ── */}
      {!user?.doctorProfile?.consultationModes?.some?.((m) => m.enabled) && (
        <motion.div
          variants={cardV} initial="initial" animate="animate"
          className="glass-card p-4 border border-amber-500/30 flex items-center justify-between gap-4 flex-wrap"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Settings className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Configure Consultation Settings</p>
              <p className="text-xs text-slate-400">Set your fees and enable consultation modes so patients can book appointments.</p>
            </div>
          </div>
          <Link
            id="dashboard-settings-link"
            to="/doctor/settings"
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 flex-shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
            Practice Settings
          </Link>
        </motion.div>
      )}

      {/* ── Earnings Cards ── */}
      {earnings && (
        <motion.div
          variants={cardV} initial="initial" animate="animate" transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { label: "Today's Earnings",    amount: earnings.today?.amount  || 0, count: earnings.today?.count  || 0, color: 'text-success-400',  bg: 'bg-success-500/10',  icon: IndianRupee },
            { label: 'Week Earnings',        amount: earnings.week?.amount   || 0, count: earnings.week?.count   || 0, color: 'text-primary-400',  bg: 'bg-primary-500/10',  icon: TrendingUp  },
            { label: 'Month Earnings',       amount: earnings.month?.amount  || 0, count: earnings.month?.count  || 0, color: 'text-accent-400',   bg: 'bg-accent-500/10',   icon: CreditCard  },
          ].map(({ label, amount, count, color, bg, icon: Icon }) => (
            <div key={label} className="stat-card relative overflow-hidden">
              <div className={`absolute top-3 right-3 w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xs text-slate-500 mb-2">{label}</p>
              <p className={`text-2xl font-display font-bold ${color}`}>
                ₹{amount.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-600 mt-1">{count} paid consultation{count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Appts",  value: todayAppts.length,     color: 'text-primary-400', icon: Calendar   },
          { label: 'Pending',        value: pendingAppts.length,   color: 'text-warning-400', icon: Clock      },
          { label: 'AI Briefs',      value: withBrief,             color: 'text-violet-400',  icon: Brain      },
          { label: 'Completed',      value: completedAppts.length, color: 'text-success-400', icon: CheckCircle },
        ].map((stat, i) => (
          <motion.div key={stat.label} variants={cardV} initial="initial" animate="animate"
            transition={{ delay: i * 0.07 }} className="stat-card"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className={`text-3xl font-display font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Today's AI-powered schedule */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-heading text-xl flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-400" />
              Today's Schedule
            </h2>
            <span className="text-sm text-slate-500">{format(new Date(), 'MMM d')}</span>
          </div>
          {loadingAppts ? <CardSkeleton count={3} /> :
           todayAppts.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No appointments today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppts.map((appt) => (
                <AIAppointmentCard
                  key={appt._id}
                  appointment={appt}
                  onStatusUpdate={handleStatusUpdate}
                />
              ))}
            </div>
          )}
        </section>

        {/* Pending approvals — AI-powered */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-heading text-xl">Pending Approvals</h2>
            <span className="badge badge-warning">{pendingAppts.length}</span>
          </div>
          {loadingAppts ? <CardSkeleton count={3} /> :
           pendingAppts.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <CheckCircle className="w-8 h-8 text-success-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAppts.slice(0, 5).map((appt) => (
                <AIAppointmentCard
                  key={appt._id}
                  appointment={appt}
                  onStatusUpdate={handleStatusUpdate}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Patient list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-heading">My Patients</h2>
          <span className="text-slate-400 text-sm">{patients.length} total</span>
        </div>
        {loadingPats ? <CardSkeleton count={3} /> :
         patients.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No patients yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => (
              <motion.div key={patient._id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="glass-card-hover p-4 flex items-center gap-3">
                <div className="avatar-md flex-shrink-0">{patient.name?.[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{patient.name}</p>
                  <p className="text-xs text-slate-500 truncate">{patient.email}</p>
                  {patient.bloodGroup && <span className="text-xs text-danger-400">Blood: {patient.bloodGroup}</span>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default DoctorDashboardPage;
