import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import RootLayout      from '@layouts/RootLayout';
import AuthLayout      from '@layouts/AuthLayout';
import DashboardLayout from '@layouts/DashboardLayout';
import DoctorLayout    from '@layouts/DoctorLayout';

// Guards
import PublicRoute    from '@components/guards/PublicRoute';
import ProtectedRoute from '@components/guards/ProtectedRoute';
import DoctorRoute    from '@components/guards/DoctorRoute';

// Loader
import PageLoader from '@components/ui/PageLoader';

// Public Pages
import LandingPage  from '@pages/LandingPage';
import NotFoundPage from '@pages/NotFoundPage';

// ── Lazy Auth Pages
const LoginPage          = lazy(() => import('@pages/auth/LoginPage'));
const RegisterPage       = lazy(() => import('@pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@pages/auth/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('@pages/auth/ResetPasswordPage'));
const VerifyEmailPage    = lazy(() => import('@pages/auth/VerifyEmailPage'));

// ── Lazy Patient Pages (all under /dashboard, /chat, etc.)
const DashboardPage       = lazy(() => import('@pages/dashboard/DashboardPage'));
const ChatPage            = lazy(() => import('@pages/chat/ChatPage'));
const AppointmentsPage    = lazy(() => import('@pages/appointments/AppointmentsPage'));
const BookAppointmentPage = lazy(() => import('@pages/appointments/BookAppointmentPage'));
const HealthRecordsPage   = lazy(() => import('@pages/records/HealthRecordsPage'));
const EmergencyPage       = lazy(() => import('@pages/emergency/EmergencyPage'));
const ProfilePage         = lazy(() => import('@pages/profile/ProfilePage'));
const SettingsPage        = lazy(() => import('@pages/settings/SettingsPage'));
const NotificationsPage   = lazy(() => import('@pages/notifications/NotificationsPage'));

// ── Lazy Doctor Pages (all under /doctor/*)
const DoctorDashboardPage    = lazy(() => import('@pages/doctor/DoctorDashboardPage'));
const DoctorAppointmentsPage = lazy(() => import('@pages/doctor/DoctorAppointmentsPage'));
const DoctorPatientsPage     = lazy(() => import('@pages/doctor/DoctorPatientsPage'));
const DoctorSummariesPage    = lazy(() => import('@pages/doctor/DoctorSummariesPage'));
const DoctorSettingsPage     = lazy(() => import('@pages/doctor/DoctorSettingsPage'));
const DoctorNotFoundPage     = lazy(() => import('@pages/doctor/DoctorNotFoundPage'));
const PatientView360Page     = lazy(() => import('@pages/doctor/PatientView360Page'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* ───────── PUBLIC ───────── */}
        <Route element={<RootLayout />}>
          <Route index element={<LandingPage />} />
        </Route>

        {/* ───────── AUTH ───────── */}
        <Route element={<PublicRoute><AuthLayout /></PublicRoute>}>
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
        </Route>

        {/* Verify email — accessible after login, before dashboard */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* ───────── PATIENT DASHBOARD ───────────────────────────────────────
            ProtectedRoute now also redirects doctors → /doctor/dashboard,
            so an authenticated doctor can never render DashboardLayout. */}
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard"              element={<DashboardPage />} />
          <Route path="/chat"                   element={<ChatPage />} />
          <Route path="/chat/:sessionId"        element={<ChatPage />} />
          <Route path="/appointments"           element={<AppointmentsPage />} />
          <Route path="/appointments/book"      element={<BookAppointmentPage />} />
          <Route path="/records"                element={<HealthRecordsPage />} />
          <Route path="/emergency"              element={<EmergencyPage />} />
          <Route path="/profile"                element={<ProfilePage />} />
          <Route path="/settings"               element={<SettingsPage />} />
          <Route path="/notifications"          element={<NotificationsPage />} />
        </Route>

        {/* ───────── DOCTOR DASHBOARD ────────────────────────────────────────
            Every doctor route is namespaced under /doctor/*.
            DoctorRoute checks: authenticated + role === 'doctor'.
            Unknown /doctor/* routes show DoctorNotFoundPage (inside
            DoctorLayout — so the doctor shell stays intact). */}
        <Route element={<DoctorRoute><DoctorLayout /></DoctorRoute>}>
          <Route path="/doctor/dashboard"                    element={<DoctorDashboardPage />} />
          <Route path="/doctor/appointments"                 element={<DoctorAppointmentsPage />} />
          <Route path="/doctor/patients"                     element={<DoctorPatientsPage />} />
          <Route path="/doctor/patients/:patientId/360"      element={<PatientView360Page />} />
          <Route path="/doctor/summaries"                    element={<DoctorSummariesPage />} />
          <Route path="/doctor/settings"                     element={<DoctorSettingsPage />} />
          <Route path="/doctor/profile"                      element={<ProfilePage />} />
          {/* Catch-all for unknown /doctor/* paths */}
          <Route path="/doctor/*"                            element={<DoctorNotFoundPage />} />
        </Route>

        {/* ───────── GLOBAL 404 ───────── */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*"    element={<Navigate to="/404" replace />} />

      </Routes>
    </Suspense>
  );
}

export default App;