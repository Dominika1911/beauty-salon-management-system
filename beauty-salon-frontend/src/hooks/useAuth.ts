import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext.ts';
import type { AuthContextType } from '@/types';

/**
 * Hook do używania AuthContext w komponentach
 * @throws Error jeśli używany poza AuthProvider
 * @returns AuthContext z danymi użytkownika i metodami auth
 */
export const useAuth: () => AuthContextType = (): AuthContextType => {
  const context: AuthContextType | undefined = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};