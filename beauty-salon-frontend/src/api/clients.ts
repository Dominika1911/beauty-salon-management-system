// src/api/clients.ts

import { api } from './axios';
import type { Client, Appointment } from '../types'; // Dodaj import Appointment

export const clientsAPI = {
  // Lista klientów (tylko dla personelu)
  list: (params?: { search?: string; marketing_consent?: boolean }) => {
    return api.get<Client[]>('/clients/', { params });
  },

  // Profil zalogowanego klienta
  me: () => {
    return api.get<Client>('/clients/me/');
  },

  // Szczegóły klienta
  detail: (id: number) => {
    return api.get<Client>(`/clients/${id}/`);
  },

  // Utwórz klienta
  create: (data: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    marketing_consent?: boolean;
    preferred_contact?: string;
    internal_notes?: string;
  }) => {
    return api.post<Client>('/clients/', data);
  },

  // Aktualizuj klienta
  update: (id: number, data: Partial<Client>) => {
    return api.patch<Client>(`/clients/${id}/`, data);
  },

  // Soft delete klienta
  softDelete: (clientId: number) => {
    return api.post('/clients/soft_delete/', { client: clientId });
  },

  // Wizyty klienta
  appointments: (id: number) => {
    return api.get<Appointment[]>(`/clients/${id}/appointments/`);
  },

  // Moje wizyty (dla zalogowanego klienta)
  myAppointments: () => {
    // Implementacja: Wywołuje endpoint z views.py
    return api.get<Appointment[]>('/clients/my_appointments/');
  }, // <--- Dodany nawias i przecinek
}; // <--- Dodane zamknięcie obiektu clientsAPI