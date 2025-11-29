// src/api/services.ts (POPRAWIONY I KOMPLETNIE TYPOWANY)

import { api } from './axios';
import type { Service } from '../types';
import type { AxiosResponse } from 'axios';

// Interfejsy pomocnicze dla czystości kodu
interface ServiceCreateData {
    name: string;
    category: string;
    description?: string;
    price: string;
    duration: string;
    image_url?: string;
    is_published?: boolean;
    promotion?: object;
}

// Definicja interfejsu dla całego obiektu API
interface ServicesApi {
    list: (params?: { category?: string; is_published?: boolean; search?: string }) => Promise<AxiosResponse<Service[]>>;
    published: () => Promise<AxiosResponse<Service[]>>;
    detail: (id: number) => Promise<AxiosResponse<Service>>;
    create: (data: ServiceCreateData) => Promise<AxiosResponse<Service>>;
    update: (id: number, data: Partial<Service>) => Promise<AxiosResponse<Service>>;
    delete: (id: number) => Promise<AxiosResponse<void>>;
}

// ZASTOSOWANIE JAWNEGO TYPU DO EKSPORTOWANEJ ZMIENNEJ
export const servicesAPI: ServicesApi = {
  // Lista wszystkich usług
  list: (params?: { category?: string; is_published?: boolean; search?: string }): Promise<AxiosResponse<Service[]>> => {
    return api.get<Service[]>('/services/', { params });
  },

  // Tylko opublikowane usługi
  published: (): Promise<AxiosResponse<Service[]>> => {
    return api.get<Service[]>('/services/published/');
  },

  // Szczegóły usługi
  detail: (id: number): Promise<AxiosResponse<Service>> => {
    return api.get<Service>(`/services/${id}/`);
  },

  // Utwórz usługę (tylko manager/pracownik)
  create: (data: ServiceCreateData): Promise<AxiosResponse<Service>> => {
    return api.post<Service>('/services/', data);
  },

  // Aktualizuj usługę
  update: (id: number, data: Partial<Service>): Promise<AxiosResponse<Service>> => {
    return api.patch<Service>(`/services/${id}/`, data);
  },

  // Usuń usługę
  delete: (id: number): Promise<AxiosResponse<void>> => {
    return api.delete<void>(`/services/${id}/`);
  },
};