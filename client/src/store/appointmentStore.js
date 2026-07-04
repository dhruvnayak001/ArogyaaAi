/**
 * store/appointmentStore.js
 *
 * Lightweight Zustand store for the 7-step appointment booking wizard.
 * Persists wizard state across step navigation, including the AI brief.
 *
 * State is reset when the user cancels or successfully books.
 */

import { create } from 'zustand';

const initialState = {
  /* Step data */
  specialty:          '',
  doctor:             null,
  booking:            { date: '', time: '', type: 'in-person' },
  symptoms:           [],           // parsed symptom tags
  symptomText:        '',           // final cleaned symptom textarea content
  symptomTranscript:  '',           // raw voice transcript
  selectedReportIds:  [],           // IDs of existing HealthRecord docs
  aiConsultationBrief: null,        // generated brief object

  /* Wizard meta */
  isGeneratingBrief:  false,
  briefError:         null,
};

export const useAppointmentStore = create((set, get) => ({
  ...initialState,

  /* ── Step 0: Specialty ── */
  setSpecialty: (specialty) => set({ specialty, doctor: null }),

  /* ── Step 1: Doctor ── */
  setDoctor: (doctor) => set({ doctor }),

  /* ── Step 2: Booking details (date/time/type) ── */
  setBooking: (booking) => set({ booking }),
  updateBooking: (field, value) =>
    set((s) => ({ booking: { ...s.booking, [field]: value } })),

  /* ── Step 3: Symptoms ── */
  setSymptoms: (symptoms) => set({ symptoms }),
  setSymptomText: (symptomText) => set({ symptomText }),
  setSymptomTranscript: (symptomTranscript) => set({ symptomTranscript }),

  /* ── Step 4: Reports ── */
  toggleReportSelection: (reportId) =>
    set((s) => {
      const alreadySelected = s.selectedReportIds.includes(reportId);
      return {
        selectedReportIds: alreadySelected
          ? s.selectedReportIds.filter((id) => id !== reportId)
          : [...s.selectedReportIds, reportId],
      };
    }),
  setSelectedReportIds: (ids) => set({ selectedReportIds: ids }),

  /* ── Step 5: AI Brief ── */
  setGeneratingBrief: (isGeneratingBrief) => set({ isGeneratingBrief }),
  setAIConsultationBrief: (brief) => set({ aiConsultationBrief: brief, isGeneratingBrief: false, briefError: null }),
  setBriefError: (error) => set({ briefError: error, isGeneratingBrief: false }),
  clearBrief: () => set({ aiConsultationBrief: null, briefError: null }),

  /* ── Selectors ── */
  canProceedToStep: (step) => {
    const s = get();
    switch (step) {
      case 1: return !!s.specialty;
      case 2: return !!s.doctor;
      case 3: return !!s.booking.date && !!s.booking.time;
      case 4: return true; // symptoms optional
      case 5: return true; // reports optional
      case 6: return true; // brief optional (can skip)
      default: return true;
    }
  },

  /* ── Reset ── */
  reset: () => set(initialState),
}));
