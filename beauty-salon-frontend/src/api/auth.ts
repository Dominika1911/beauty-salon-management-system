import api from './axios';
import type { User, LoginCredentials } from '../types';
import type { AxiosResponse } from 'axios';

interface AuthApi {
  login: (credentials: LoginCredentials) => Promise<AxiosResponse<{ message: string; user: User }>>;
  logout: () => Promise<AxiosResponse<{ message: string }>>;
  status: () => Promise<AxiosResponse<{ authenticated: boolean; user: User | null }>>;
}

/**
 * API do zarządzania autentykacją użytkowników
 */
export const authAPI: AuthApi = {

  /**
   * Loguje użytkownika do systemu
   */
  login: (credentials: LoginCredentials): Promise<AxiosResponse<{ message: string; user: User }>> => {
    return api.post<{ message: string; user: User }>('/auth/login/', credentials);
  },

  /**
   * Wylogowuje użytkownika
   */
  logout: (): Promise<AxiosResponse<{ message: string }>> => {
    return api.post<{ message: string }>('/auth/logout/');
  },

  /**
   * Sprawdza status autentykacji
   */
  status: (): Promise<AxiosResponse<{ authenticated: boolean; user: User | null }>> => {
    return api.get<{ authenticated: boolean; user: User | null }>('/auth/status/');
  },
};
