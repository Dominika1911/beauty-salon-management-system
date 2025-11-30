// src/context/AuthContext.tsx

import React, { useState, useEffect } from 'react';
import { authAPI } from '../api';
import type { User, LoginCredentials, AuthContextType } from '../types';
import type { AxiosError } from 'axios';
import { AuthContext } from './AuthContext.ts';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provider autentykacji - opakowuje aplikację i zarządza stanem logowania
 */
export const AuthProvider = ({ children }: AuthProviderProps): React.ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sprawdza status autentykacji przy starcie aplikacji
   */
  const checkAuthStatus = async (): Promise<void> => {
    try {
      const { data } = await authAPI.status();
      setUser(data.authenticated ? data.user : null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Sprawdź auth przy montowaniu komponentu
  useEffect(() => {
    void checkAuthStatus();
  }, []);

  /**
   * Loguje użytkownika do systemu
   */
  const login = async (
    credentials: LoginCredentials,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setError(null);

      const { data } = await authAPI.login(credentials);
      setUser(data.user);

      return { success: true };
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string; detail?: string }>;

      const errorMsg =
        axiosError.response?.data?.error ||
        axiosError.response?.data?.detail ||
        'Błąd logowania';

      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  /**
   * Wylogowuje użytkownika z systemu
   */
  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Logout failed:', err);
    } finally {
      // Wyloguj lokalnie nawet przy błędzie API
      setUser(null);
    }
  };

  // 🔹 DODANE – flagi na podstawie user.role
  const isAuthenticated = !!user;
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const isClient = user?.role === 'client';

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    checkAuthStatus,
    isAuthenticated,
    isManager,
    isEmployee,
    isClient,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
