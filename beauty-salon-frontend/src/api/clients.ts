import axiosInstance from './axios';
import type { Client } from '../types';

// Pobierz wszystkich klientów
export const getClients = async (): Promise<Client[]> => {
  const response = await axiosInstance.get('/clients/');
  return response.data.results || response.data;
};

// Pobierz aktywnych klientów
export const getActiveClients = async (): Promise<Client[]> => {
  const response = await axiosInstance.get('/clients/?is_active=true');
  return response.data.results || response.data;
};

// Pobierz klienta po ID
export const getClient = async (id: number): Promise<Client> => {
  const response = await axiosInstance.get<Client>(`/clients/${id}/`);
  return response.data;
};

// Utwórz klienta
export const createClient = async (data: Partial<Client>): Promise<Client> => {
  const response = await axiosInstance.post<Client>('/clients/', data);
  return response.data;
};

// Zaktualizuj klienta
export const updateClient = async (id: number, data: Partial<Client>): Promise<Client> => {
  const response = await axiosInstance.patch<Client>(`/clients/${id}/`, data);
  return response.data;
};

// Usuń klienta
export const deleteClient = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/clients/${id}/`);
};