import axiosInstance from './axios';
import type { Service } from '../types';

/**
 * API dla usług salonu
 */

// Pobierz wszystkie usługi
export const getServices = async (): Promise<Service[]> => {
  const response = await axiosInstance.get('/services/');
  return response.data.results || response.data;
};

// Pobierz aktywne usługi
export const getActiveServices = async (): Promise<Service[]> => {
  const response = await axiosInstance.get('/services/?is_active=true');
  return response.data.results || response.data;
};

// Pobierz usługę po ID
export const getService = async (id: number): Promise<Service> => {
  const response = await axiosInstance.get<Service>(`/services/${id}/`);
  return response.data;
};

// Utwórz usługę
export const createService = async (data: Partial<Service>): Promise<Service> => {
  const response = await axiosInstance.post<Service>('/services/', data);
  return response.data;
};

// Zaktualizuj usługę
export const updateService = async (id: number, data: Partial<Service>): Promise<Service> => {
  const response = await axiosInstance.patch<Service>(`/services/${id}/`, data);
  return response.data;
};

// Usuń usługę
export const deleteService = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/services/${id}/`);
};