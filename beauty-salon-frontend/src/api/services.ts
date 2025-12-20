import { api } from './axios.ts';
// 🚨 Zaktualizowany import: zakładamy, że w types.ts masz już ServiceCreateUpdateData
import type { Service, PaginatedResponse, ServiceCreateUpdateData } from '@/types';
import type { AxiosResponse } from 'axios';

// Parametry filtrowania i paginacji
interface ServiceListParams {
  category?: string;
  is_published?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

interface ServicesApi {
  list: (params?: ServiceListParams) => Promise<AxiosResponse<PaginatedResponse<Service>>>;
  published: () => Promise<AxiosResponse<Service[]>>;
  detail: (id: number) => Promise<AxiosResponse<Service>>;
  // 🚨 Użycie ServiceCreateUpdateData
  create: (data: ServiceCreateUpdateData) => Promise<AxiosResponse<Service>>;
  // 🚨 Użycie ServiceCreateUpdateData i Partial dla PATCH
  update: (id: number, data: Partial<ServiceCreateUpdateData>) => Promise<AxiosResponse<Service>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

// Endpointy API
const ENDPOINTS = {
  base: '/services/',
  published: '/services/published/',
  detail: (id: number) => `/services/${id}/`,
} as const;

/**
 * API do zarządzania usługami
 */
export const servicesAPI: ServicesApi = {
  /**
   * Lista wszystkich usług (obsługa paginacji)
   */
  list: (params?: ServiceListParams): Promise<AxiosResponse<PaginatedResponse<Service>>> => {
    return api.get<PaginatedResponse<Service>>(ENDPOINTS.base, { params });
  },

  /**
   * Tylko opublikowane usługi
   */
  published: (): Promise<AxiosResponse<Service[]>> => {
    return api.get<Service[]>(ENDPOINTS.published);
  },

  /**
   * Szczegóły usługi
   */
  detail: (id: number): Promise<AxiosResponse<Service>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid service ID'));
    }
    return api.get<Service>(ENDPOINTS.detail(id));
  },

  /**
   * Utwórz usługę
   */
  create: (data: ServiceCreateUpdateData): Promise<AxiosResponse<Service>> => {
    return api.post<Service>(ENDPOINTS.base, data);
  },

  /**
   * Aktualizuj usługę
   * Używamy PATCH do częściowej aktualizacji
   */
  update: (id: number, data: Partial<ServiceCreateUpdateData>): Promise<AxiosResponse<Service>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid service ID'));
    }
    return api.patch<Service>(ENDPOINTS.detail(id), data);
  },

  /**
   * Usuń usługę (Metoda DELETE)
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid service ID'));
    }
    return api.delete<void>(ENDPOINTS.detail(id));
  },
};