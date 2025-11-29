// src/api/appointments.ts (POPRAWIONY I KOMPLETNIE TYPOWANY)

import { api } from './axios';
import type { Appointment } from '../types';
import type { AxiosResponse } from 'axios'; // Wymagany do typowania odpowiedzi

// Definicja interfejsu dla całego obiektu API
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

// Interfejsy pomocnicze (powinny być w src/types, ale dla uproszczenia dodajemy tu)
interface AppointmentCreateData {
  client: number;
  employee: number;
  service: number;
  start: string;
  end?: string;
  booking_channel?: string;
  client_notes?: string;
  internal_notes?: string;
}

interface AppointmentStatusUpdateData {
  status: string;
  cancellation_reason?: string;
}

// ZASTOSOWANIE JAWNEGO TYPU DO EKSPORTOWANEJ ZMIENNEJ
export const appointmentsAPI: AppointmentsApi = {
  // Lista wszystkich wizyt
  list: (params?: { date_from?: string; date_to?: string; status?: string }): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/', { params });
  },

  // Moje wizyty
  myAppointments: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/my_appointments/');
  },

  // Wizyty dzisiaj
  today: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/today/');
  },

  // Przyszłe wizyty
  upcoming: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/appointments/upcoming/');
  },

  // Szczegóły wizyty
  detail: (id: number): Promise<AxiosResponse<Appointment>> => {
    return api.get<Appointment>(`/appointments/${id}/`);
  },

  // Utwórz wizytę
  create: (data: AppointmentCreateData): Promise<AxiosResponse<Appointment>> => {
    return api.post<Appointment>('/appointments/', data);
  },

  // Zmiana statusu wizyty
  changeStatus: (id: number, data: AppointmentStatusUpdateData): Promise<AxiosResponse<Appointment>> => {
    return api.post<Appointment>(`/appointments/${id}/change_status/`, data);
  },

  // Aktualizuj wizytę
  update: (id: number, data: Partial<Appointment>): Promise<AxiosResponse<Appointment>> => {
    return api.patch<Appointment>(`/appointments/${id}/`, data);
  },

  // Usuń wizytę
  delete: (id: number): Promise<AxiosResponse<void>> => {
    return api.delete<void>(`/appointments/${id}/`);
  },
};