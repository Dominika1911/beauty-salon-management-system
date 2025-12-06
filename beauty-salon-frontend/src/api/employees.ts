// src/api/employees.ts

import api from './axios';
// 🚨 UPEWNIJ SIĘ, ŻE IMPORTUJESZ PaginatedResponse Z TWOJEGO PLIKU TYPÓW!
import type { Employee, EmployeeCreateData, Appointment, Service, PaginatedResponse } from '../types'; 
import type { AxiosResponse } from 'axios';

interface EmployeesApi {
  // 🚨 ZMIANA 1: Metoda list musi zwracać PaginatedResponse<Employee>
  list: (params?: { is_active?: boolean; search?: string; page?: number; page_size?: number }) => Promise<AxiosResponse<PaginatedResponse<Employee>>>;
  
  active: () => Promise<AxiosResponse<Employee[]>>;
  me: () => Promise<AxiosResponse<Employee>>;
  detail: (id: number) => Promise<AxiosResponse<Employee>>;
  services: (id: number) => Promise<AxiosResponse<Service[]>>;
  upcomingAppointments: (id: number) => Promise<AxiosResponse<Appointment[]>>;
  create: (data: EmployeeCreateData) => Promise<AxiosResponse<Employee>>;
  update: (id: number, data: Partial<Employee>) => Promise<AxiosResponse<Employee>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

/**
 * API do zarządzania pracownikami
 */
export const employeesAPI: EmployeesApi = {
  /**
   * Lista wszystkich pracowników
   * Zwraca format paginacji DRF
   */
  // 🚨 ZMIANA 2: Używamy PaginatedResponse i uwzględniamy parametry paginacji
  list: (params?: { is_active?: boolean; search?: string; page?: number; page_size?: number }): Promise<AxiosResponse<PaginatedResponse<Employee>>> => {
    return api.get<PaginatedResponse<Employee>>('/employees/', { params });
  },

  /**
   * Tylko aktywni pracownicy (tutaj zakładamy, że to jest czysta lista, a nie paginacja)
   */
  active: (): Promise<AxiosResponse<Employee[]>> => {
    return api.get<Employee[]>('/employees/active/');
  },

  /**
   * Profil zalogowanego pracownika
   */
  me: (): Promise<AxiosResponse<Employee>> => {
    return api.get<Employee>('/employees/me/');
  },

  /**
   * Szczegóły pracownika
   */
  detail: (id: number): Promise<AxiosResponse<Employee>> => {
    return api.get<Employee>(`/employees/${id}/`);
  },

  /**
   * Usługi pracownika
   */
  services: (id: number): Promise<AxiosResponse<Service[]>> => {
    return api.get<Service[]>(`/employees/${id}/services/`);
  },

  /**
   * Nadchodzące wizyty pracownika
   */
  upcomingAppointments: (id: number): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>(`/employees/${id}/upcoming_appointments/`);
  },

  /**
   * Utwórz pracownika
   */
  create: (data: EmployeeCreateData): Promise<AxiosResponse<Employee>> => {
    return api.post<Employee>('/employees/', data);
  },

  /**
   * Aktualizuj pracownika
   */
  update: (id: number, data: Partial<Employee>): Promise<AxiosResponse<Employee>> => {
    return api.patch<Employee>(`/employees/${id}/`, data);
  },

  /**
   * Usuń pracownika
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    return api.delete<void>(`/employees/${id}/`);
  },
};