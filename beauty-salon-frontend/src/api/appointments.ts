// src/api/appointments.ts

import { api } from './axios';
import type { Appointment } from '../types';

export const appointmentsAPI = {
  // Lista wszystkich wizyt (filtrowana po roli)
  list: (params?: { date_from?: string; date_to?: string; status?: string }) => {
    return api.get<Appointment[]>('/appointments/', { params });
  },

  // Moje wizyty (dla klienta/pracownika)
  myAppointments: () => {
    return api.get<Appointment[]>('/appointments/my_appointments/');
  },

  // Wizyty dzisiaj
  today: () => {
    return api.get<Appointment[]>('/appointments/today/');
  },

  // Przyszłe wizyty
  upcoming: () => {
    return api.get<Appointment[]>('/appointments/upcoming/');
  },

  // Szczegóły wizyty
  detail: (id: number) => {
    return api.get<Appointment>(`/appointments/${id}/`);
  },

  // Utwórz wizytę
  create: (data: {
    client: string;
    employee: string;
    service: string;
    start: string;
    end?: string;
    booking_channel?: string;
    client_notes?: string;
    internal_notes?: string;
  }) => {
    return api.post<Appointment>('/appointments/', data);
  },

  // Zmiana statusu wizyty
  changeStatus: (id: number, data: { status: string; cancellation_reason?: string }) => {
    return api.post<Appointment>(`/appointments/${id}/change_status/`, data);
  },

  // Aktualizuj wizytę
  update: (id: number, data: Partial<Appointment>) => {
    return api.patch<Appointment>(`/appointments/${id}/`, data);
  },

  // Usuń wizytę
  delete: (id: number) => {
    return api.delete(`/appointments/${id}/`);
  },
};