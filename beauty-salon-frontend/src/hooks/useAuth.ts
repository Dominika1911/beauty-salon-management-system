// src/hooks/useAuth.ts

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextType } from '../types';

// Poprawnie typowany hook useAuth, używający AuthContext (eksportera kontekstu)
export const useAuth: () => AuthContextType = (): AuthContextType => {
  // Jawne typowanie zmiennej context
  const context: AuthContextType | undefined = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};