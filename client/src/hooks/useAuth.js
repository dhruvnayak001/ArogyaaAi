/**
 * hooks/useAuth.js
 * Convenience hook that exposes auth state and actions
 * with a stable selector to avoid re-renders.
 */

import { useAuthStore } from '@store/authStore';

export function useAuth() {
  const user            = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const login           = useAuthStore((s) => s.login);
  const register        = useAuthStore((s) => s.register);
  const logout          = useAuthStore((s) => s.logout);
  const updateUser      = useAuthStore((s) => s.updateUser);
  const setAccessToken  = useAuthStore((s) => s.setAccessToken);

  const isDoctor  = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';

  return {
    user,
    isAuthenticated,
    isLoading,
    isDoctor,
    isPatient,
    login,
    register,
    logout,
    updateUser,
    setAccessToken,
  };
}
