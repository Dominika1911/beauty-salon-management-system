import { api } from './axios';
//  Poprawiony import: używamy ClientCreateUpdateData
import type { Client, PaginatedResponse, ClientCreateUpdateData } from '../types';
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
  create: (data: ClientCreateUpdateData) => Promise<AxiosResponse<Client>>;
  update: (id: number, data: Partial<ClientCreateUpdateData>) => Promise<AxiosResponse<Client>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  // ✅ NOWE: soft delete przez akcję (detail=False)
  softDelete: (clientId: number) => Promise<AxiosResponse<void>>;
}

// Endpointy API
const ENDPOINTS = {
  base: '/clients/',
  detail: (id: number) => `/clients/${id}/`,
  softDelete: '/clients/soft_delete/',
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
  create: (data: ClientCreateUpdateData): Promise<AxiosResponse<Client>> => {
    return api.post<Client>(ENDPOINTS.base, data);
  },

  /**
   * Aktualizuj klienta (PATCH)
   */
  update: (id: number, data: Partial<ClientCreateUpdateData>): Promise<AxiosResponse<Client>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid client ID'));
    }
    return api.patch<Client>(ENDPOINTS.detail(id), data);
  },

  /**
   * (Zostawiamy) Standardowe DELETE na detail endpoint
   * Uwaga: u Ciebie GDPR soft delete jest przez /soft_delete/, więc w UI używaj softDelete().
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid client ID'));
    }
    return api.delete<void>(ENDPOINTS.detail(id));
  },

  /**
   * ✅ Soft Delete klienta (GDPR) — backend action: POST /api/clients/soft_delete/
   * Serializer oczekuje pola: { client: <id> }
   */
  softDelete: (clientId: number): Promise<AxiosResponse<void>> => {
    if (!clientId || clientId <= 0) {
      return Promise.reject(new Error('Invalid client ID'));
    }
    return api.post<void>(ENDPOINTS.softDelete, { client: clientId });
  },
};
