import { api } from './axios';
import type { User, LoginCredentials } from '../types';
import type { AxiosResponse } from 'axios';

// Typy odpowiedzi API
interface CsrfResponse {
  detail?: string;
}

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
  csrf: () => Promise<AxiosResponse<CsrfResponse>>;
  login: (credentials: LoginCredentials) => Promise<AxiosResponse<LoginResponse>>;
  logout: () => Promise<AxiosResponse<LogoutResponse>>;
  status: () => Promise<AxiosResponse<StatusResponse>>;
}

// Endpointy API
const ENDPOINTS = {
  csrf: '/auth/csrf/',
  login: '/auth/login/',
  logout: '/auth/logout/',
  status: '/auth/status/',
} as const;

/**
 * API do zarządzania autentykacją użytkowników
 */
export const authAPI: AuthApi = {
  /**
   * Ustawia cookie CSRF (csrftoken)
   */
  csrf: (): Promise<AxiosResponse<CsrfResponse>> => {
    return api.get<CsrfResponse>(ENDPOINTS.csrf);
  },

  /**
   * Loguje użytkownika do systemu
   */
  login: async (credentials: LoginCredentials): Promise<AxiosResponse<LoginResponse>> => {
    await authAPI.csrf(); // ustawia/odświeża csrftoken tuż przed POST
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
