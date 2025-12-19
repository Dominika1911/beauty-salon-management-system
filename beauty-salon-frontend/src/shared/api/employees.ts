import { api } from './axios';
import type { Employee, EmployeeCreateData, Appointment, Service, PaginatedResponse } from '@/shared/types';
import type { AxiosResponse } from 'axios';

// Parametry filtrowania i paginacji
interface EmployeeListParams {
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

interface EmployeesApi {
  list: (params?: EmployeeListParams) => Promise<AxiosResponse<PaginatedResponse<Employee>>>;
  active: () => Promise<AxiosResponse<Employee[]>>;
  me: () => Promise<AxiosResponse<Employee>>;
  detail: (id: number) => Promise<AxiosResponse<Employee>>;
  services: (id: number) => Promise<AxiosResponse<Service[]>>;
  upcomingAppointments: (id: number) => Promise<AxiosResponse<Appointment[]>>;
  create: (data: EmployeeCreateData) => Promise<AxiosResponse<Employee>>;
  update: (id: number, data: Partial<Employee>) => Promise<AxiosResponse<Employee>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

// Endpointy API
const ENDPOINTS = {
  base: '/employees/',
  active: '/employees/active/',
  me: '/employees/me/',
  detail: (id: number) => `/employees/${id}/`,
  services: (id: number) => `/employees/${id}/services/`,
  upcomingAppointments: (id: number) => `/employees/${id}/upcoming_appointments/`,
} as const;

/**
 * API do zarządzania pracownikami
 */
export const employeesAPI: EmployeesApi = {
  /**
   * Lista wszystkich pracowników
   * Zwraca format paginacji DRF
   */
  list: (params?: EmployeeListParams): Promise<AxiosResponse<PaginatedResponse<Employee>>> => {
    return api.get<PaginatedResponse<Employee>>(ENDPOINTS.base, { params });
  },

  /**
   * Tylko aktywni pracownicy
   */
  active: (): Promise<AxiosResponse<Employee[]>> => {
    return api.get<Employee[]>(ENDPOINTS.active);
  },

  /**
   * Profil zalogowanego pracownika
   */
  me: (): Promise<AxiosResponse<Employee>> => {
    return api.get<Employee>(ENDPOINTS.me);
  },

  /**
   * Szczegóły pracownika
   */
  detail: (id: number): Promise<AxiosResponse<Employee>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid employee ID'));
    }
    return api.get<Employee>(ENDPOINTS.detail(id));
  },

  /**
   * Usługi pracownika
   */
  services: (id: number): Promise<AxiosResponse<Service[]>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid employee ID'));
    }
    return api.get<Service[]>(ENDPOINTS.services(id));
  },

  /**
   * Nadchodzące wizyty pracownika
   */
  upcomingAppointments: (id: number): Promise<AxiosResponse<Appointment[]>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid employee ID'));
    }
    return api.get<Appointment[]>(ENDPOINTS.upcomingAppointments(id));
  },

  /**
   * Utwórz pracownika
   */
  create: (data: EmployeeCreateData): Promise<AxiosResponse<Employee>> => {
    return api.post<Employee>(ENDPOINTS.base, data);
  },

  /**
   * Aktualizuj pracownika
   */
  update: (id: number, data: Partial<Employee>): Promise<AxiosResponse<Employee>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid employee ID'));
    }
    return api.patch<Employee>(ENDPOINTS.detail(id), data);
  },

  /**
   * Usuń pracownika
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid employee ID'));
    }
    return api.delete<void>(ENDPOINTS.detail(id));
  },
};