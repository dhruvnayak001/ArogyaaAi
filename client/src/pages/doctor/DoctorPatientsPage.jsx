/**
 * pages/doctor/DoctorPatientsPage.jsx
 * Doctor's patient list with record access
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Search, Brain, Droplets, Clock } from 'lucide-react';
import { doctorsApi } from '@api/doctors.api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function DoctorPatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await doctorsApi.getPatients();
        /* Backend envelope: { success, data: { patients } } */
        setPatients(data.data?.patients ?? data.patients ?? []);
      } catch { toast.error('Failed to load patients'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const filtered = patients.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name = '') =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-heading">My Patients</h1>
          <p className="section-subheading mt-1">View and manage your patient records</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          id="patient-search"
          type="text"
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10 text-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center text-center gap-4">
          <Users className="w-12 h-12 text-slate-600" />
          <p className="text-slate-400">{search ? 'No patients match your search' : 'No patients yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((patient) => (
            <motion.div
              key={patient._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card-hover p-4 flex items-center gap-4"
            >
              <div className="avatar-md flex-shrink-0">{getInitials(patient.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{patient.name}</p>
                <p className="text-xs text-slate-500">{patient.email}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {patient.bloodGroup && (
                    <span className="flex items-center gap-1 text-xs text-danger-400">
                      <Droplets className="w-3 h-3" />{patient.bloodGroup}
                    </span>
                  )}
                  {patient.lastLogin && (
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <Clock className="w-3 h-3" />
                      Last seen {formatDistanceToNow(new Date(patient.lastLogin), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
              <button
                id={`view360-${patient._id}`}
                onClick={() => navigate(`/doctor/patients/${patient._id}/360`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 transition-all flex-shrink-0"
              >
                <Brain className="w-3.5 h-3.5" /> 360 View
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DoctorPatientsPage;
