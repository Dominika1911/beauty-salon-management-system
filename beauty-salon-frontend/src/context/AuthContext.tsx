import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { login as apiLogin, logout as apiLogout, checkAuthStatus } from '../api/auth';
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

  const refreshUser = useCallback(async () => {
    try {
      const response = await checkAuthStatus();
      setUser(response.isAuthenticated && response.user ? response.user : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await refreshUser();
      } catch (error) {
        console.error('Inicjalizacja auth nieudana:', error);
      } finally {
        setLoading(false);
      }
    };
    void initAuth();
  }, [refreshUser]);

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      const response = await apiLogin(credentials);
      setUser(response.user);
      return response.user;
    } catch (error: any) {
      console.error('Błąd logowania:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN',
      isEmployee: user?.role === 'EMPLOYEE',
      isClient: user?.role === 'CLIENT',
    }),
    [user, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth musi być używany wewnątrz AuthProvider');
  return context;
};
