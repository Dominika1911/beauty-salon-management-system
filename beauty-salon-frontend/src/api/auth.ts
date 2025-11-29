// src/api/auth.ts

import { api } from './axios';
import type { User, LoginCredentials } from '../types';
import type { AxiosResponse } from 'axios';

// Definicja interfejsu dla całego obiektu API
interface AuthApi {
  login: (credentials: LoginCredentials) => Promise<AxiosResponse<{ message: string; user: User }>>;
  logout: () => Promise<AxiosResponse>;
  status: () => Promise<AxiosResponse<{ authenticated: boolean; user: User | null }>>;
}

// ZASTOSOWANIE JAWNEGO TYPU DO EKSPORTOWANEJ ZMIENNEJ
export const authAPI: AuthApi = {
  // Logowanie
  login: (credentials: LoginCredentials): Promise<AxiosResponse<{ message: string; user: User }>> => {
    return api.post<{ message: string; user: User }>('/auth/login/', credentials);
  },

  // Wylogowanie
  logout: (): Promise<AxiosResponse> => {
    return api.post('/auth/logout/');
  },

  // Status auth
  status: (): Promise<AxiosResponse<{ authenticated: boolean; user: User | null }>> => {
    return api.get<{ authenticated: boolean; user: User | null }>('/auth/status/');
  },
};