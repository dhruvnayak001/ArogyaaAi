/**
 * pages/emergency/EmergencyPage.jsx
 * Emergency detection and rapid response system
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Phone, MapPin, Activity, Shield, Zap } from 'lucide-react';
import { chatApi } from '@api/chat.api';
import toast from 'react-hot-toast';

const EMERGENCY_NUMBERS = [
  { label: 'Ambulance (India)',     number: '108' },
  { label: 'Police',                number: '100' },
  { label: 'National Emergency',    number: '112' },
  { label: 'Fire Brigade',          number: '101' },
];

function EmergencyPage() {
  const [symptoms,  setSymptoms]  = useState('');
  const [analysis,  setAnalysis]  = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!symptoms.trim()) { toast.error('Please describe your symptoms'); return; }
    setAnalyzing(true);
    try {
      const { data } = await chatApi.analyzeEmergency({ symptoms });
      setAnalysis(data.analysis);
    } catch (err) {
      toast.error('Analysis failed. If in immediate danger, call 112.');
    } finally {
      setAnalyzing(false);
    }
  };

  const isHighRisk = analysis?.severity === 'high' || analysis?.severity === 'critical';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-danger-600/15 flex items-center justify-center border border-danger-500/25">
          <AlertTriangle className="w-7 h-7 text-danger-400" />
        </div>
        <div>
          <h1 className="section-heading">Emergency Detection</h1>
          <p className="section-subheading mt-0.5">AI-powered triage for urgent health situations</p>
        </div>
      </div>

      {/* Emergency hotlines */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-4 h-4 text-danger-400" />
          <p className="font-semibold text-white text-sm">Emergency Numbers</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {EMERGENCY_NUMBERS.map((em) => (
            <a
              key={em.number}
              href={`tel:${em.number}`}
              id={`call-${em.number}`}
              className="flex items-center justify-between p-3 rounded-xl bg-danger-600/10 border border-danger-500/20 hover:bg-danger-600/20 transition-all group"
            >
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{em.label}</span>
              <span className="text-danger-400 font-bold font-mono">{em.number}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Symptom analyzer */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-warning-400" />
          <p className="font-semibold text-white text-sm">AI Emergency Triage</p>
          <span className="badge badge-warning ml-auto">Gemini Powered</span>
        </div>
        <p className="text-xs text-slate-500">
          Describe symptoms for AI triage. <strong className="text-warning-400">This does not replace calling emergency services.</strong>
        </p>
        <textarea
          id="emergency-symptoms-input"
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Describe the emergency: e.g. 'Patient is unconscious, breathing but pulse is weak, 67 years old, diabetic...'"
          rows={4}
          className="input-field resize-none"
        />
        <button
          id="analyze-emergency-btn"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="btn-danger w-full py-3"
        >
          {analyzing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            <><Activity className="w-4 h-4" /> Analyze Emergency</>
          )}
        </button>
      </div>

      {/* Analysis result */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`glass-card p-6 border ${isHighRisk ? 'border-danger-500/40 ring-glow-danger' : 'border-warning-500/30'}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isHighRisk ? 'bg-danger-500/20' : 'bg-warning-500/20'}`}>
                <Shield className={`w-5 h-5 ${isHighRisk ? 'text-danger-400' : 'text-warning-400'}`} />
              </div>
              <div>
                <p className="font-semibold text-white">AI Triage Result</p>
                <span className={`badge ${isHighRisk ? 'badge-danger' : 'badge-warning'}`}>
                  Severity: {analysis.severity?.toUpperCase()}
                </span>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">{analysis.recommendation}</p>
            {isHighRisk && (
              <a href="tel:112" className="btn-danger w-full py-3 flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> Call Emergency Now (112)
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EmergencyPage;
