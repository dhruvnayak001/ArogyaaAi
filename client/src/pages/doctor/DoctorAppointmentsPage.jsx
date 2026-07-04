/**
 * pages/doctor/DoctorAppointmentsPage.jsx
 * Doctor view: manage all patient appointments — AI Copilot enhanced
 */

import React, { useEffect, useState } from 'react';
import { Calendar, Brain, Filter } from 'lucide-react';
import { appointmentsApi } from '@api/appointments.api';
import { AIAppointmentCard } from '@components/doctor/AIAppointmentCard';
import { CardSkeleton } from '@components/ui/LoadingSkeleton';
import toast from 'react-hot-toast';

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];
const URGENCY_FILTERS = ['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function DoctorAppointmentsPage() {
  const [appointments,   setAppointments]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [urgencyFilter,  setUrgencyFilter]  = useState('all');

  useEffect(() => {
    appointmentsApi.getAll()
      .then(({ data }) => setAppointments(data.data?.appointments ?? data.appointments ?? []))
      .catch(() => toast.error('Failed to load appointments'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateStatus = async (id, status) => {
    try {
      await appointmentsApi.updateStatus(id, { status });
      setAppointments((prev) => prev.map((a) => a._id === id ? { ...a, status } : a));
      toast.success(`Appointment ${status}`);
    } catch {
      toast.error('Failed to update appointment');
    }
  };

  /* Filter appointments */
  const filtered = appointments.filter((a) => {
    const statusMatch  = statusFilter === 'all'  || a.status === statusFilter;
    const urgencyMatch = urgencyFilter === 'all' || a.aiConsultationBrief?.urgencyLevel === urgencyFilter;
    return statusMatch && urgencyMatch;
  });

  /* Stats */
  const withBrief = appointments.filter((a) => !!a.aiConsultationBrief?.summaryText).length;
  const highRisk  = appointments.filter((a) => ['HIGH','CRITICAL'].includes(a.aiConsultationBrief?.urgencyLevel)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="section-heading flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary-400" />
            AI Appointment Copilot
          </h1>
          <p className="section-subheading mt-1">
            {appointments.length} total • {withBrief} with AI briefs
            {highRisk > 0 && <span className="text-danger-400 ml-2">• {highRisk} high risk</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500">Status:</span>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                  statusFilter === s
                    ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                    : 'text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">AI Risk:</span>
          <div className="flex gap-1.5">
            {URGENCY_FILTERS.map((u) => (
              <button
                key={u}
                onClick={() => setUrgencyFilter(u)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  urgencyFilter === u
                    ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                    : 'text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20'
                }`}
              >
                {u === 'all' ? 'All' : u.charAt(0) + u.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <CardSkeleton count={5} />
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4">
          <Calendar className="w-12 h-12 text-slate-600" />
          <p className="text-slate-400">
            {appointments.length === 0 ? 'No appointments yet' : 'No appointments match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => (
            <AIAppointmentCard
              key={appt._id}
              appointment={appt}
              onStatusUpdate={handleUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DoctorAppointmentsPage;
