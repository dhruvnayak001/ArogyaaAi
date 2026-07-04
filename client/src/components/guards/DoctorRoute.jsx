/**
 * components/guards/DoctorRoute.jsx
 * Doctor-only protected route.
 *
 * - Calls initialize() so direct navigation to /doctor/* works correctly
 *   even on hard refresh (the store's _initialized flag makes it idempotent).
 * - Shows loader while auth is initializing.
 * - Unauthenticated → /login
 * - Authenticated but NOT doctor → /dashboard
 * - Authenticated as doctor → renders children (doctor layout)
 */

import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import PageLoader from '@components/ui/PageLoader';

function DoctorRoute({ children }) {
  const { isAuthenticated, isLoading, user, initialize } = useAuthStore();

  /* Trigger session verification on direct navigation to a doctor route.
     The _initialized flag in authStore makes this safe — it's a no-op
     if main.jsx already called it first. */
  useEffect(() => {
    initialize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'doctor') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default DoctorRoute;
