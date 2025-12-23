import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, checkAuthStatus, getCsrfToken } from '../api/auth';
import type { User, LoginRequest } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // CSRF jest kluczowe dla bezpieczeństwa sesji
        await getCsrfToken();
        await refreshUser();
      } catch (error) {
        console.error('Inicjalizacja auth nieudana:', error);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const refreshUser = async () => {
    try {
      const response = await checkAuthStatus();
      if (response.isAuthenticated && response.user) {
        // Twoja ważna logika sprawdzania profilu klienta
        if (response.user.role === 'CLIENT' && !response.user.client_profile?.id) {
          console.error(' BŁĄD: Rola CLIENT bez client_profile!');
        }
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await apiLogin(credentials);
      setUser(response.user);
      return response.user; // Zwracamy usera, by strona logowania wiedziała gdzie przekierować
    } catch (error: any) {
      console.error('Błąd logowania:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isEmployee: user?.role === 'EMPLOYEE',
    isClient: user?.role === 'CLIENT',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
};