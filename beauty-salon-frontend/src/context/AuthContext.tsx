import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, logout as apiLogout, checkAuthStatus } from '../api/auth';
import type { User, LoginRequest } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Sprawdź status autoryzacji przy montowaniu
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔍 Checking authentication status...');
      const response = await checkAuthStatus();

      console.log('Auth response:', response);

      if (response.isAuthenticated && response.user) {
        console.log('✓ User authenticated:', response.user);
        console.log('User role:', response.user.role);
        console.log('Client profile:', response.user.client_profile);

        //WAŻNE: Sprawdź czy client_profile nie jest pustym obiektem
        if (response.user.role === 'CLIENT') {
          if (!response.user.client_profile || !response.user.client_profile.id) {
            console.error('❌ ERROR: User has CLIENT role but NO client_profile!');
            console.error('This will cause booking to fail!');
            console.error('User data:', response.user);
          } else {
            console.log('✓ Client profile OK:', response.user.client_profile);
          }
        }

        setUser(response.user);
      } else {
        console.log('❌ User not authenticated');
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Błąd sprawdzania autoryzacji:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await apiLogin(credentials);
      setUser(response.user);

      // Przekieruj na dashboard odpowiedni dla roli
      switch (response.user.role) {
        case 'ADMIN':
          navigate('/admin/dashboard');
          break;
        case 'EMPLOYEE':
          navigate('/employee/dashboard');
          break;
        case 'CLIENT':
          navigate('/client/dashboard');
          break;
        default:
          navigate('/');
      }
    } catch (error: any) {
      console.error('Błąd logowania:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Błąd wylogowania:', error);
      // Wyloguj lokalnie nawet jeśli API zwróci błąd
      setUser(null);
      navigate('/login');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isEmployee: user?.role === 'EMPLOYEE',
    isClient: user?.role === 'CLIENT',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook do używania kontekstu
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};