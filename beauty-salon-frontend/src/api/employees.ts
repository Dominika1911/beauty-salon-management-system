import { api } from './axios';
import type { Employee, EmployeeCreateData, Appointment, Service } from '../types';
import type { AxiosResponse } from 'axios';

interface EmployeesApi {
  list: (params?: { is_active?: boolean; search?: string }) => Promise<AxiosResponse<Employee[]>>;
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
   */
  list: (params?: { is_active?: boolean; search?: string }): Promise<AxiosResponse<Employee[]>> => {
    return api.get<Employee[]>('/employees/', { params });
  },

  /**
   * Tylko aktywni pracownicy
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
