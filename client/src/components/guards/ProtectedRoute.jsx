/**
 * components/guards/ProtectedRoute.jsx
 * Patient-only protected route.
 *
 * - Shows loader while auth is initializing.
 * - Unauthenticated → /login
 * - Authenticated as DOCTOR → /doctor/dashboard  (prevents doctor from
 *   accidentally landing inside the patient layout)
 * - Authenticated as PATIENT → renders children (patient layout)
 *
 * NOTE: initialize() is intentionally NOT called here.
 * It is called once in main.jsx (Root) to avoid race conditions.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import PageLoader from '@components/ui/PageLoader';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  /* Still verifying session — show loader, render nothing else */
  if (isLoading) {
    return <PageLoader />;
  }

  /* Not logged in → send to login, remembering where they wanted to go */
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  /* Doctor trying to access a patient route → kick to doctor dashboard */
  if (user?.role === 'doctor') {
    return <Navigate to="/doctor/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
