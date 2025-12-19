// src/context/AuthContext.ts

import { createContext } from 'react';
import type { AuthContextType } from '@/shared/types';

/**
 * Kontekst autentykacji - udostępnia stan użytkownika i metody logowania
 */
export const AuthContext: React.Context<AuthContextType | undefined> = createContext<AuthContextType | undefined>(undefined);