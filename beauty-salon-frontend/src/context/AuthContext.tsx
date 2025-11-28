// src/context/AuthContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../api';
import type { User, LoginCredentials, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sprawdź status auth przy starcie aplikacji
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
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

  const login = async (credentials: LoginCredentials) => {
    try {
      setError(null);

      // 1. Pobierz CSRF token
      await authAPI.getCSRF();

      // 2. Zaloguj
      const { data } = await authAPI.login(credentials);
      setUser(data.user);

      return { success: true };
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Błąd logowania';

      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
      setUser(null); // Wyloguj lokalnie nawet jeśli backend zwrócił błąd
    }
  };

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

// Hook do używania AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};