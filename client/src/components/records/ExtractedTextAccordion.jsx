/**
 * components/records/ExtractedTextAccordion.jsx
 * Collapsible accordion for raw OCR/PDF extracted text.
 *
 * Design rationale:
 *  - Collapsed by default (not the primary focus)
 *  - Monospace font for technical output
 *  - Shows extraction method, confidence, character count
 *  - Expandable for transparency / debugging
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, FileText, Copy, Check, ScanLine, FileCode } from 'lucide-react';

const EXTRACTION_LABELS = {
  'pdf-parse':         { label: 'PDF Parser',      color: 'text-blue-400',    icon: FileText  },
  'tesseract-ocr':     { label: 'Tesseract OCR',   color: 'text-purple-400',  icon: ScanLine  },
  'gemini-vision-ocr': { label: 'Gemini Vision',   color: 'text-primary-400', icon: ScanLine  },
  'pdf-parse-failed':  { label: 'PDF (partial)',   color: 'text-amber-400',   icon: FileText  },
  'ocr-failed':        { label: 'OCR failed',      color: 'text-danger-400',  icon: FileCode  },
  'default':           { label: 'Text extraction', color: 'text-slate-400',   icon: FileText  },
};

/**
 * ExtractedTextAccordion
 * @param {string} text              - Raw extracted text
 * @param {string} extractionMethod  - e.g. 'pdf-parse', 'tesseract-ocr'
 * @param {number} ocrConfidence     - 0-100
 * @param {number} pageCount         - Number of pages
 */
export default function ExtractedTextAccordion({
  text,
  extractionMethod,
  ocrConfidence,
  pageCount,
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const methodInfo = EXTRACTION_LABELS[extractionMethod] || EXTRACTION_LABELS.default;
  const MethodIcon = methodInfo.icon;

  if (!text) return null;

  const charCount   = text.length;
  const lineCount   = text.split('\n').length;
  const preview     = text.slice(0, 150).replace(/\n/g, ' ');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden">
      {/* Accordion toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-5 py-4 hover:bg-white/3 transition-colors text-left group"
        aria-expanded={expanded}
      >
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MethodIcon className={`w-4 h-4 ${methodInfo.color}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-white">Raw Extracted Text</p>
            <span className="text-xs text-slate-500">— for reference only</span>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg bg-white/5 border border-white/8 ${methodInfo.color}`}>
              <MethodIcon className="w-3 h-3" />
              {methodInfo.label}
            </span>
            {ocrConfidence !== null && ocrConfidence !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded-lg border ${
                ocrConfidence >= 80 ? 'bg-success-500/10 border-success-500/20 text-success-400'
                : ocrConfidence >= 60 ? 'bg-amber-400/10 border-amber-400/20 text-amber-400'
                : 'bg-danger-400/10 border-danger-400/20 text-danger-400'
              }`}>
                {ocrConfidence}% confidence
              </span>
            )}
            {pageCount > 0 && (
              <span className="text-xs text-slate-600">
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </span>
            )}
            <span className="text-xs text-slate-600">
              {charCount.toLocaleString()} chars · {lineCount.toLocaleString()} lines
            </span>
          </div>

          {/* Preview (collapsed) */}
          {!expanded && (
            <p className="text-xs text-slate-600 mt-2 font-mono truncate">
              {preview}…
            </p>
          )}
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 mt-1.5">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            : <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5">
              {/* Copy button */}
              <div className="flex items-center justify-between px-5 py-2 bg-black/20">
                <p className="text-xs text-slate-600">
                  Scroll to view full extracted text
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1 px-2.5 rounded-lg hover:bg-white/8"
                >
                  {copied
                    ? <><Check className="w-3 h-3 text-success-400" /> Copied!</>
                    : <><Copy className="w-3 h-3" /> Copy text</>}
                </button>
              </div>

              {/* Text content */}
              <div className="px-5 py-4 max-h-72 overflow-y-auto custom-scrollbar">
                <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {text}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
