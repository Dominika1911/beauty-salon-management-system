import { api } from './axios';
import type { Client, PaginatedResponse, ClientCreateData } from '../types';
import type { AxiosResponse } from 'axios';

// Parametry filtrowania i paginacji
interface ClientListParams {
  search?: string;
  phone?: string;
  page?: number;
  page_size?: number;
}

interface ClientsApi {
  list: (params?: ClientListParams) => Promise<AxiosResponse<PaginatedResponse<Client>>>;
  detail: (id: number) => Promise<AxiosResponse<Client>>;
  create: (data: ClientCreateData) => Promise<AxiosResponse<Client>>;
  update: (id: number, data: Partial<Client>) => Promise<AxiosResponse<Client>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

// Endpointy API
const ENDPOINTS = {
  base: '/clients/',
  detail: (id: number) => `/clients/${id}/`,
} as const;

/**
 * API do zarządzania klientami
 */
export const clientsAPI: ClientsApi = {
  /**
   * Lista wszystkich klientów (obsługa paginacji)
   */
  list: (params?: ClientListParams): Promise<AxiosResponse<PaginatedResponse<Client>>> => {
    return api.get<PaginatedResponse<Client>>(ENDPOINTS.base, { params });
  },

  /**
   * Szczegóły klienta
   */
  detail: (id: number): Promise<AxiosResponse<Client>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid client ID'));
    }
    return api.get<Client>(ENDPOINTS.detail(id));
  },

  /**
   * Utwórz klienta
   */
  create: (data: ClientCreateData): Promise<AxiosResponse<Client>> => {
    return api.post<Client>(ENDPOINTS.base, data);
  },

  /**
   * Aktualizuj klienta
   */
  update: (id: number, data: Partial<Client>): Promise<AxiosResponse<Client>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid client ID'));
    }
    return api.patch<Client>(ENDPOINTS.detail(id), data);
  },

  /**
   * Usuń klienta
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid client ID'));
    }
    return api.delete<void>(ENDPOINTS.detail(id));
  },
};