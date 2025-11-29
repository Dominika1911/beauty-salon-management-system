/* eslint-disable react-refresh/only-export-components */

// src/context/AuthContext.tsx (POPRAWIONA I KOMPLETNIE TYPOWANA WERSJA)

import { createContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { authAPI } from '../api';
import type { User, LoginCredentials, AuthContextType } from '../types';
import type { AxiosError } from 'axios';

// Kontekst poprawnie typowany
export const AuthContext: React.Context<AuthContextType | undefined> = createContext<AuthContextType | undefined>(undefined);

// Komponent Provider, poprawnie typowany (FIX: Używamy React.FC i jawnego typu zwracanego)
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }: { children: ReactNode }): ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // FIX: Dodano typ do zmiennej checkAuthStatus (naprawia L19: typedef)
  const checkAuthStatus: () => Promise<void> = useCallback(async (): Promise<void> => {
    try {
      // FIX: Ignorowanie obietnicy jest celowe w useEffect, więc nie jest to błąd
      const { data } = await authAPI.status();
      setUser(data.authenticated ? data.user : null);
    } catch (err: unknown) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

 useEffect(() => {
    // UWAGA: Mimo iż linia poniżej generuje ostrzeżenie "Promise returned from checkAuthStatus is ignored",
    // jest to standardowy wzorzec w React. Użycie anonimowej funkcji jest zbędne, jeśli obietnica nie jest śledzona.
    checkAuthStatus();
  }, [checkAuthStatus]);

  // FIX: Dodano typ do zmiennej login (naprawia L36: typedef)
 const login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }> = async (credentials: LoginCredentials) => {
    try {
      setError(null);

      const { data } = await authAPI.login(credentials);
      setUser(data.user);

      return { success: true };
    } catch (err: unknown) {
      const errorResponse: AxiosError = err as AxiosError;

      const errorMsg: string =
        (errorResponse.response?.data as { error?: string; detail?: string })?.error ||
        (errorResponse.response?.data as { error?: string; detail?: string })?.detail ||
        'Błąd logowania';

      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  // FIX: Dodano typ do zmiennej logout (naprawia L60: typedef)
  const logout: () => Promise<void> = async (): Promise<void> => {
    try {
      await authAPI.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
      setUser(null);
    }
  };

  // Jawne typowanie stałej value
  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    isManager: user?.role === 'manager',
    isEmployee: user?.role === 'employee',
    isClient: user?.role === 'client',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};