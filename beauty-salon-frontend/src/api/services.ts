import { api } from './axios';
import type { Service, ServiceCreateData } from '../types';
import type { AxiosResponse } from 'axios';

interface ServicesApi {
  list: (params?: { category?: string; is_published?: boolean; search?: string }) => Promise<AxiosResponse<Service[]>>;
  published: () => Promise<AxiosResponse<Service[]>>;
  detail: (id: number) => Promise<AxiosResponse<Service>>;
  create: (data: ServiceCreateData) => Promise<AxiosResponse<Service>>;
  update: (id: number, data: Partial<Service>) => Promise<AxiosResponse<Service>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

/**
 * API do zarządzania usługami
 */
export const servicesAPI: ServicesApi = {
  /**
   * Lista wszystkich usług
   */
  list: (params?: { category?: string; is_published?: boolean; search?: string }): Promise<AxiosResponse<Service[]>> => {
    return api.get<Service[]>('/services/', { params });
  },

  /**
   * Tylko opublikowane usługi
   */
  published: (): Promise<AxiosResponse<Service[]>> => {
    return api.get<Service[]>('/services/published/');
  },

  /**
   * Szczegóły usługi
   */
  detail: (id: number): Promise<AxiosResponse<Service>> => {
    return api.get<Service>(`/services/${id}/`);
  },

  /**
   * Utwórz usługę
   */
  create: (data: ServiceCreateData): Promise<AxiosResponse<Service>> => {
    return api.post<Service>('/services/', data);
  },

  /**
   * Aktualizuj usługę
   */
  update: (id: number, data: Partial<Service>): Promise<AxiosResponse<Service>> => {
    return api.patch<Service>(`/services/${id}/`, data);
  },

  /**
   * Usuń usługę
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    return api.delete<void>(`/services/${id}/`);
  },
};
