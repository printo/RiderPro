// client/src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import AuthService from '../services/AuthService';

export const useAuth = () => {
  const [authState, setAuthState] = useState(AuthService.getInstance().getState());

  useEffect(() => {
    const unsubscribe = AuthService.getInstance().subscribe(setAuthState);
    return unsubscribe;
  }, []);

  const authService = AuthService.getInstance();

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    loginWithExternalAPI: authService.loginWithExternalAPI.bind(authService),
    loginWithLocalDB: authService.loginWithLocalDB.bind(authService),
    registerUser: authService.registerUser.bind(authService),
    logout: async () => {
      await authService.logout();
    },
    authenticatedFetch: authService.authenticatedFetch.bind(authService),
    getAuthHeaders: authService.getAuthHeaders.bind(authService),
  };
};
