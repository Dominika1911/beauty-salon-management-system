// src/context/AuthContext.ts

import { createContext } from 'react';
import { AuthContextType } from '../types';

/**
 * Kontekst autentykacji - udostępnia stan użytkownika i metody logowania
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);