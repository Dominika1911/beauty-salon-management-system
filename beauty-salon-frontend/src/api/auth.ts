import { api } from './axios';
import type { User, LoginCredentials } from '../types';
import type { AxiosResponse } from 'axios';

// Typy odpowiedzi API
interface LoginResponse {
  message: string;
  user: User;
}

interface LogoutResponse {
  message: string;
}

interface StatusResponse {
  authenticated: boolean;
  user: User | null;
}

interface AuthApi {
  login: (credentials: LoginCredentials) => Promise<AxiosResponse<LoginResponse>>;
  logout: () => Promise<AxiosResponse<LogoutResponse>>;
  status: () => Promise<AxiosResponse<StatusResponse>>;
}

// Endpointy API
const ENDPOINTS = {
  login: '/auth/login/',
  logout: '/auth/logout/',
  status: '/auth/status/',
} as const;

/**
 * API do zarządzania autentykacją użytkowników
 */
export const authAPI: AuthApi = {
  /**
   * Loguje użytkownika do systemu
   */
  login: (credentials: LoginCredentials): Promise<AxiosResponse<LoginResponse>> => {
    return api.post<LoginResponse>(ENDPOINTS.login, credentials);
  },

  /**
   * Wylogowuje użytkownika
   */
  logout: (): Promise<AxiosResponse<LogoutResponse>> => {
    return api.post<LogoutResponse>(ENDPOINTS.logout);
  },

  /**
   * Sprawdza status autentykacji
   */
  status: (): Promise<AxiosResponse<StatusResponse>> => {
    return api.get<StatusResponse>(ENDPOINTS.status);
  },
};