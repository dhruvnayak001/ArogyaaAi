/**
 * components/guards/PublicRoute.jsx
 * Redirects already-authenticated users away from auth pages (login, register).
 *
 * Waits for isLoading to be false before redirecting so persisted state
 * has time to be verified against the backend. Without this guard, a stale
 * persisted isAuthenticated=true would redirect a user whose token has
 * actually expired.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import PageLoader from '@components/ui/PageLoader';

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading       = useAuthStore((state) => state.isLoading);
  const user            = useAuthStore((state) => state.user);

  /* Don't redirect until session verification is complete */
  if (isLoading) return <PageLoader />;

  if (isAuthenticated) {
    const destination =
      user?.role === 'doctor'
        ? '/doctor/dashboard'
        : '/dashboard';

    return <Navigate to={destination} replace />;
  }

  return children;
}

export default PublicRoute;