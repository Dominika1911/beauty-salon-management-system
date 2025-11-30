import { api } from './axios';
import type { Appointment, AppointmentCreateData, AppointmentStatusUpdateData } from '../types';
import type { AxiosResponse } from 'axios';

interface AppointmentsApi {
  list: (params?: { date_from?: string; date_to?: string; status?: string }) => Promise<AxiosResponse<Appointment[]>>;
  myAppointments: () => Promise<AxiosResponse<Appointment[]>>;
  today: () => Promise<AxiosResponse<Appointment[]>>;
  upcoming: () => Promise<AxiosResponse<Appointment[]>>;
  detail: (id: number) => Promise<AxiosResponse<Appointment>>;
  create: (data: AppointmentCreateData) => Promise<AxiosResponse<Appointment>>;
  changeStatus: (id: number, data: AppointmentStatusUpdateData) => Promise<AxiosResponse<Appointment>>;
  update: (id: number, data: Partial<Appointment>) => Promise<AxiosResponse<Appointment>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

/**
 * API do zarządzania wizytami
 */
export const appointmentsAPI: AppointmentsApi = {
  /**
   * Lista wszystkich wizyt (filtrowana po roli)
   */
  list: (params?: { date_from?: string; date_to?: string; status?: string }): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/', { params });
  },

  /**
   * Moje wizyty (dla klienta/pracownika)
   */
  myAppointments: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/my_appointments/');
  },

  /**
   * Wizyty dzisiaj
   */
  today: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/today/');
  },

  /**
   * Przyszłe wizyty
   */
  upcoming: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/upcoming/');
  },

  /**
   * Szczegóły wizyty
   */
  detail: (id: number): Promise<AxiosResponse<Appointment>> => {
    return api.get<Appointment>(`/appointments/${id}/`);
  },

  /**
   * Utwórz wizytę
   */
  create: (data: AppointmentCreateData): Promise<AxiosResponse<Appointment>> => {
    return api.post<Appointment>('/appointments/', data);
  },

  /**
   * Zmiana statusu wizyty
   */
  changeStatus: (id: number, data: AppointmentStatusUpdateData): Promise<AxiosResponse<Appointment>> => {
    return api.post<Appointment>(`/appointments/${id}/change_status/`, data);
  },

  /**
   * Aktualizuj wizytę
   */
  update: (id: number, data: Partial<Appointment>): Promise<AxiosResponse<Appointment>> => {
    return api.patch<Appointment>(`/appointments/${id}/`, data);
  },

  /**
   * Usuń wizytę
   */
  delete: (id: number): Promise<AxiosResponse<void>> => {
    return api.delete<void>(`/appointments/${id}/`);
  },
};
