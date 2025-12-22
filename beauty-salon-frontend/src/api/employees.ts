import axiosInstance from './axios';
import type { Employee } from '../types';

/**
 * API dla pracowników
 */

// Pobierz wszystkich pracowników
export const getEmployees = async (): Promise<Employee[]> => {
  const response = await axiosInstance.get('/employees/');
  return response.data.results || response.data;
};

// Pobierz aktywnych pracowników
export const getActiveEmployees = async (): Promise<Employee[]> => {
  const response = await axiosInstance.get('/employees/?is_active=true');
  return response.data.results || response.data;
};

// Pobierz pracownika po ID
export const getEmployee = async (id: number): Promise<Employee> => {
  const response = await axiosInstance.get<Employee>(`/employees/${id}/`);
  return response.data;
};

// Utwórz pracownika
export const createEmployee = async (data: Partial<Employee>): Promise<Employee> => {
  const response = await axiosInstance.post<Employee>('/employees/', data);
  return response.data;
};

// Zaktualizuj pracownika
export const updateEmployee = async (id: number, data: Partial<Employee>): Promise<Employee> => {
  const response = await axiosInstance.patch<Employee>(`/employees/${id}/`, data);
  return response.data;
};

// Usuń pracownika
export const deleteEmployee = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/employees/${id}/`);
};