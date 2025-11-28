// src/api/services.ts

import { api } from './axios';
import type { Service } from '../types';

export const servicesAPI = {
  // Lista wszystkich usług
  list: (params?: { category?: string; is_published?: boolean; search?: string }) => {
    return api.get<Service[]>('/services/', { params });
  },

  // Tylko opublikowane usługi
  published: () => {
    return api.get<Service[]>('/services/published/');
  },

  // Szczegóły usługi
  detail: (id: number) => {
    return api.get<Service>(`/services/${id}/`);
  },

  // Utwórz usługę (tylko manager/pracownik)
  create: (data: {
    name: string;
    category: string;
    description?: string;
    price: string;
    duration: string;
    image_url?: string;
    is_published?: boolean;
    promotion?: object;
  }) => {
    return api.post<Service>('/services/', data);
  },

  // Aktualizuj usługę
  update: (id: number, data: Partial<Service>) => {
    return api.patch<Service>(`/services/${id}/`, data);
  },

  // Usuń usługę
  delete: (id: number) => {
    return api.delete(`/services/${id}/`);
  },
};