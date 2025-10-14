// client/src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import SimpleAuthService from '../services/SimpleAuthService';
import { User } from '../types/User';

export const useAuth = () => {
  const [authState, setAuthState] = useState(SimpleAuthService.getInstance().getState());

  useEffect(() => {
    const unsubscribe = SimpleAuthService.getInstance().subscribe(setAuthState);
    return unsubscribe;
  }, []);

  const authService = SimpleAuthService.getInstance();

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    loginWithExternalAPI: authService.loginWithExternalAPI.bind(authService),
    loginWithLocalDB: authService.loginWithLocalDB.bind(authService),
    registerUser: authService.registerUser.bind(authService),
    logout: authService.logout.bind(authService),
    authenticatedFetch: authService.authenticatedFetch.bind(authService),
  };
};
