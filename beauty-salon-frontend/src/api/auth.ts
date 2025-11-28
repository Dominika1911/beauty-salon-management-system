// src/api/auth.ts

import { api } from './axios';
import type { User, LoginCredentials } from '../types';

export const authAPI = {
  // Pobierz CSRF token (wywołaj PRZED logowaniem)
  getCSRF: () => {
    return api.get('/auth/csrf/');
  },

  // Logowanie
  login: (credentials: LoginCredentials) => {
    return api.post<{ message: string; user: User }>('/auth/login/', credentials);
  },

  // Wylogowanie
  logout: () => {
    return api.post('/auth/logout/');
  },

  // Status auth (sprawdź czy zalogowany)
  status: () => {
    return api.get<{ authenticated: boolean; user: User | null }>('/auth/status/');
  },
};