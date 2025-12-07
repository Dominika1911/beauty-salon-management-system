import { api } from './axios';
import type { Appointment, AppointmentCreateData, AppointmentStatusUpdateData, PaginatedResponse } from '../types';
import type { AxiosResponse } from 'axios';

// Parametry filtrowania i paginacji
interface AppointmentListParams {
  date_from?: string;
  date_to?: string;
  status?: string;
  employee_id?: number;
  page?: number;
  page_size?: number;
}

interface AppointmentsApi {
  list: (params?: AppointmentListParams) => Promise<AxiosResponse<PaginatedResponse<Appointment>>>;
  myAppointments: () => Promise<AxiosResponse<Appointment[]>>;
  today: () => Promise<AxiosResponse<Appointment[]>>;
  upcoming: () => Promise<AxiosResponse<Appointment[]>>;
  detail: (id: number) => Promise<AxiosResponse<Appointment>>;
  create: (data: AppointmentCreateData) => Promise<AxiosResponse<Appointment>>;
  changeStatus: (id: number, data: AppointmentStatusUpdateData) => Promise<AxiosResponse<Appointment>>;
  update: (id: number, data: Partial<Appointment>) => Promise<AxiosResponse<Appointment>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

// Endpointy API
const ENDPOINTS = {
  base: '/appointments/',
  myAppointments: '/appointments/my_appointments/',
  today: '/appointments/today/',
  upcoming: '/appointments/upcoming/',
  detail: (id: number) => `/appointments/${id}/`,
  changeStatus: (id: number) => `/appointments/${id}/change_status/`,
} as const;

/**
 * API do zarządzania wizytami
 */
export const appointmentsAPI: AppointmentsApi = {
  /**
   * Lista wszystkich wizyt (filtrowana po roli i obsługująca paginację)
   */
  list: (params?: AppointmentListParams): Promise<AxiosResponse<PaginatedResponse<Appointment>>> => {
    return api.get<PaginatedResponse<Appointment>>(ENDPOINTS.base, { params });
  },

  /**
   * Moje wizyty (dla klienta/pracownika)
   */
  myAppointments: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>(ENDPOINTS.myAppointments);
  },

  /**
   * Wizyty dzisiaj
   */
  today: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>(ENDPOINTS.today);
  },

  /**
   * Przyszłe wizyty
   */
  upcoming: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>(ENDPOINTS.upcoming);
  },

  /**
   * Szczegóły wizyty
   */
  detail: (id: number): Promise<AxiosResponse<Appointment>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid appointment ID'));
    }
    return api.get<Appointment>(ENDPOINTS.detail(id));
  },

  /**
   * Utwórz wizytę
   */
  create: (data: AppointmentCreateData): Promise<AxiosResponse<Appointment>> => {
    return api.post<Appointment>(ENDPOINTS.base, data);
  },

  /**
   * Zmiana statusu wizyty
   */
  changeStatus: (id: number, data: AppointmentStatusUpdateData): Promise<AxiosResponse<Appointment>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid appointment ID'));
    }
    return api.post<Appointment>(ENDPOINTS.changeStatus(id), data);
  },

  /**
   * Aktualizuj wizytę
   */
  update: (id: number, data: Partial<Appointment>): Promise<AxiosResponse<Appointment>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid appointment ID'));
    }
    return api.patch<Appointment>(ENDPOINTS.detail(id), data);
  },

  /**
   * Usuń wizytę
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    if (!id || id <= 0) {
      return Promise.reject(new Error('Invalid appointment ID'));
    }
    return api.delete<void>(ENDPOINTS.detail(id));
  },
};