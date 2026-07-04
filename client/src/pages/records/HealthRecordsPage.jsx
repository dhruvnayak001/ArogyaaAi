/**
 * pages/records/HealthRecordsPage.jsx
 * Health records management — upload, view, filter, AI summary, delete
 * + per-record medical analysis display with re-analyze support
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Upload, Sparkles, Download, Trash2, Plus,
  Search, ChevronDown, ChevronUp, AlertTriangle, Loader2,
  CheckCircle2, Edit3, Stethoscope,
} from 'lucide-react';
import { recordsApi }       from '@api/records.api';
import UploadRecordModal    from '@components/records/UploadRecordModal';
import RecordAnalysisCard   from '@components/records/RecordAnalysisCard';
import StatusBadge          from '@components/ui/StatusBadge';
import EmptyState           from '@components/ui/EmptyState';
import { CardSkeleton }     from '@components/ui/LoadingSkeleton';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CATEGORIES = ['All', 'lab_report', 'prescription', 'scan', 'discharge_summary', 'vaccination', 'other'];
const CAT_LABELS = {
  All: 'All', lab_report: 'Lab Reports', prescription: 'Prescriptions',
  scan: 'Scans', discharge_summary: 'Discharge', vaccination: 'Vaccination', other: 'Other',
};

const SEVERITY_DOT = {
  critical: 'bg-red-400',
  high:     'bg-orange-400',
  moderate: 'bg-yellow-400',
  low:      'bg-blue-400',
  normal:   'bg-success-400',
};

/* Stats helper */
const countConfirmed = (records) => records.filter((r) => r.confirmationStatus === 'confirmed').length;

function HealthRecordsPage() {
  const [records,        setRecords]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [aiSummary,      setAiSummary]      = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showUpload,     setShowUpload]     = useState(false);
  const [search,         setSearch]         = useState('');
  const [category,       setCategory]       = useState('All');
  const [expandedId,     setExpandedId]     = useState(null);
  const [reanalyzing,    setReanalyzing]    = useState({});  // { [recordId]: bool }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await recordsApi.getAll();
      setRecords(data.data?.records ?? data.records ?? []);
    } catch { toast.error('Failed to load records'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGetAiSummary = async () => {
    if (records.length === 0) { toast.error('No records to summarize'); return; }
    setLoadingSummary(true);
    try {
      const { data } = await recordsApi.getAiSummary();
      setAiSummary(data.data?.summary ?? data.summary);
    } catch { toast.error('Failed to generate AI summary'); }
    finally   { setLoadingSummary(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record permanently?')) return;
    try {
      await recordsApi.delete(id);
      setRecords((prev) => prev.filter((r) => r._id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success('Record deleted');
    } catch { toast.error('Failed to delete record'); }
  };

  const handleReanalyze = async (recordId) => {
    setReanalyzing((p) => ({ ...p, [recordId]: true }));
    try {
      const { data } = await recordsApi.reanalyze(recordId);
      const updated  = data.data?.record ?? data.record;
      setRecords((prev) => prev.map((r) => r._id === recordId ? updated : r));
      toast.success(`Analysis updated — ${updated.analysis?.severity || 'complete'}`);
    } catch (err) {
      toast.error(err.message || 'Re-analysis failed');
    } finally {
      setReanalyzing((p) => ({ ...p, [recordId]: false }));
    }
  };

  const handleUploadSuccess = (newRecord) => {
    setRecords((prev) => [newRecord, ...prev]);
    /* Auto-expand to show analysis immediately */
    if (newRecord?._id) setExpandedId(newRecord._id);
  };

  const filtered = records.filter((r) => {
    const matchCat = category === 'All' || r.type === category;
    const matchQ   = r.title?.toLowerCase().includes(search.toLowerCase()) ||
                     r.type?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-heading">Health Records</h1>
          <p className="section-subheading mt-1">AI-powered document analysis with medical value extraction</p>
        </div>
        <div className="flex gap-3">
          <button
            id="ai-summary-btn"
            onClick={handleGetAiSummary}
            disabled={loadingSummary || records.length === 0}
            className="btn-accent text-sm px-4 py-2.5"
          >
            <Sparkles className="w-4 h-4" />
            {loadingSummary ? 'Generating...' : 'AI Summary'}
          </button>
          <button
            id="upload-record-btn"
            onClick={() => setShowUpload(true)}
            className="btn-primary text-sm px-4 py-2.5"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records',    value: records.length,                                                  color: 'text-primary-400' },
          { label: 'Lab Reports',      value: records.filter((r) => r.type === 'lab_report').length,           color: 'text-success-400' },
          { label: 'Confirmed',        value: countConfirmed(records),                                         color: 'text-accent-400'  },
          { label: 'AI Analyzed',      value: records.filter((r) => r.analysis?.severity).length,              color: 'text-warning-400' },
        ].map((s) => (
          <div key={s.label} className="stat-card py-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI Summary panel */}
      <AnimatePresence>
        {aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-6 border border-accent-500/25"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-accent-400" />
              <p className="font-semibold text-white">AI Health Summary</p>
              <span className="badge badge-accent ml-auto">Gemini AI</span>
              <button onClick={() => setAiSummary(null)} className="p-1 text-slate-500 hover:text-white">✕</button>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{aiSummary}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="records-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                category === cat
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {CAT_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Records list */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || category !== 'All' ? 'No matching records' : 'No health records yet'}
          description={search || category !== 'All' ? 'Try adjusting your search or filter.' : 'Upload lab reports, prescriptions, or any medical document — AI will analyze it automatically.'}
          action={!search && category === 'All' ? (
            <button onClick={() => setShowUpload(true)} className="btn-primary text-sm px-5 py-2.5">
              <Plus className="w-4 h-4" /> Upload First Record
            </button>
          ) : null}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((rec) => {
              const isExpanded = expandedId === rec._id;
              const sev        = rec.analysis?.severity;
              const sevDot     = sev ? SEVERITY_DOT[sev] : null;

              return (
                <motion.div
                  key={rec._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="glass-card overflow-hidden"
                >
                  {/* ── Record row ── */}
                  <div className="p-4 flex items-center gap-4">
                    {/* File icon */}
                    <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white text-sm truncate">{rec.title || 'Untitled Record'}</p>
                        {sevDot && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sevDot}`} title={`${sev} severity`} />
                        )}
                        {sev === 'critical' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        )}
                        {/* Confirmation status */}
                        {rec.confirmationStatus === 'confirmed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success-400 flex-shrink-0" title="Patient confirmed" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Awaiting confirmation" />
                        )}
                        {/* Doctor summary available */}
                        {rec.doctorSummary?.generatedAt && (
                          <Stethoscope className="w-3.5 h-3.5 text-accent-400 flex-shrink-0" title="Doctor summary available" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={rec.type} />
                        <span className="text-xs text-slate-500">
                          {rec.date ? format(new Date(rec.date), 'MMM d, yyyy') : '—'}
                        </span>
                        {rec.extractionMethod && (
                          <span className="text-xs text-slate-600">
                            · {rec.extractionMethod === 'pdf-parse' ? 'PDF' : 'OCR'}
                          </span>
                        )}
                        {rec.analysis?.abnormalFindings?.length > 0 && (
                          <span className="text-xs text-warning-400 font-medium">
                            · {rec.analysis.abnormalFindings.length} abnormal
                          </span>
                        )}
                        {rec.userCorrections?.length > 0 && (
                          <span className="text-xs text-accent-400 flex items-center gap-0.5">
                            · <Edit3 className="w-2.5 h-2.5" /> {rec.userCorrections.length} corrected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Expand toggle */}
                      {(rec.analysis || rec.extractedText || rec.fileUrl) && (
                        <button
                          id={`expand-${rec._id}`}
                          onClick={() => setExpandedId(isExpanded ? null : rec._id)}
                          className="p-2 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                          title={isExpanded ? 'Collapse' : 'View Analysis'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rec._id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-danger-400 hover:bg-danger-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* ── Expanded analysis panel ── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden border-t border-white/5"
                      >
                        <div className="p-4 pt-3 space-y-3">
                          <RecordAnalysisCard
                            record={rec}
                            onReanalyze={() => handleReanalyze(rec._id)}
                            reanalyzing={!!reanalyzing[rec._id]}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <UploadRecordModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}

export default HealthRecordsPage;
