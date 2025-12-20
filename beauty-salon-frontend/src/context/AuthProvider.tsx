import React, { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { authAPI } from '@/api/auth.ts';
import type { User, LoginCredentials, AuthContextType } from '@/types';
import type { AxiosError } from 'axios';
import { AuthContext } from './AuthContext.ts';

interface AuthProviderProps {
  children: React.ReactNode;
}


// Provider autentykacji - opakowuje aplikację i zarządza stanem logowania
export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const isClient = user?.role === 'client';


  //Sprawdza, czy użytkownik jest zalogowany
  const checkAuthStatus: () => Promise<void> = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data } = await authAPI.status();

      const authed = Boolean(data.authenticated && data.user);
      setIsAuthenticated(authed);
      setUser(authed ? data.user : null);
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Sprawdza auth przy montowaniu komponentu (najpierw ustaw CSRF cookie)
  useEffect(() => {
    (async () => {
      try {
        await authAPI.csrf();
      } catch {
      }
      await checkAuthStatus();
    })();
  }, []);

  //Loguje użytkownika do systemu
  const login: AuthContextType['login'] = async (
    credentials: LoginCredentials,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setError(null);

      const { data } = await authAPI.login(credentials);

      setUser(data.user);
      setIsAuthenticated(true);

      return { success: true };
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string; detail?: string; message?: string }>;

      const msg =
        axiosErr.response?.data?.error ??
        axiosErr.response?.data?.detail ??
        axiosErr.response?.data?.message ??
        (axiosErr.response?.status ? `Login failed (${axiosErr.response.status})` : 'Login failed');


      setError(msg);
      setUser(null);
      setIsAuthenticated(false);

      return { success: false, error: msg };
    }
  };

   // Wylogowuje użytkownika
  const logout: () => Promise<void> = async (): Promise<void> => {
    try {
      setError(null);
      await authAPI.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    loading: isLoading,
    error,
    isManager,
    isEmployee,
    isClient,
    login,
    logout,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
