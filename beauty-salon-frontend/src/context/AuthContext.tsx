// src/context/AuthContext.tsx

import React, { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { authAPI } from '../api/auth';
import type { User, LoginCredentials, AuthContextType } from '../types';
import type { AxiosError } from 'axios';
import { AuthContext } from './AuthContext';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provider autentykacji - opakowuje aplikację i zarządza stanem logowania
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }: AuthProviderProps): ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sprawdza status autentykacji przy starcie aplikacji
   */
  const checkAuthStatus: () => Promise<void> = async (): Promise<void> => {
    try {
      const { data } = await authAPI.status();
      setUser(data.authenticated ? data.user : null);
    } catch (err) {
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
  const login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }> = async (
    credentials: LoginCredentials,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setError(null);

      const { data } = await authAPI.login(credentials);
      setUser(data.user);

      return { success: true };
    } catch (err) {
      const axiosError: AxiosError<{ error?: string; detail?: string }> = err as AxiosError<{ error?: string; detail?: string }>;

      const errorMsg: string =
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
  const logout: () => Promise<void> = async (): Promise<void> => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      // Wyloguj lokalnie nawet przy błędzie API
      setUser(null);
    }
  };

  // Flagi na podstawie user.role
  const isAuthenticated: boolean = !!user;
  const isManager: boolean = user?.role === 'manager';
  const isEmployee: boolean = user?.role === 'employee';
  const isClient: boolean = user?.role === 'client';

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