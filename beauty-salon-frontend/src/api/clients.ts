import { api } from './axios';
import type { Client, Appointment } from '../types';
import type { AxiosResponse } from 'axios';

// Definicje pomocnicze (dla czystości kodu)
interface ClientCreateData {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    marketing_consent?: boolean;
    preferred_contact?: string;
    internal_notes?: string;
}

// Definicja interfejsu dla całego obiektu API
interface ClientsApi {
    list: (params?: { search?: string; marketing_consent?: boolean }) => Promise<AxiosResponse<Client[]>>;
    me: () => Promise<AxiosResponse<Client>>;
    detail: (id: number) => Promise<AxiosResponse<Client>>;
    create: (data: ClientCreateData) => Promise<AxiosResponse<Client>>;
    update: (id: number, data: Partial<Client>) => Promise<AxiosResponse<Client>>;
    softDelete: (clientId: number) => Promise<AxiosResponse<void>>;
    appointments: (id: number) => Promise<AxiosResponse<Appointment[]>>;
    myAppointments: () => Promise<AxiosResponse<Appointment[]>>;
}


// ZASTOSOWANIE JAWNEGO TYPU DO EKSPORTOWANEJ ZMIENNEJ
export const clientsAPI: ClientsApi = {
  // Lista klientów
  list: (params?: { search?: string; marketing_consent?: boolean }): Promise<AxiosResponse<Client[]>> => {
    return api.get<Client[]>('/clients/', { params });
  },

  // Profil zalogowanego klienta
  me: (): Promise<AxiosResponse<Client>> => {
    return api.get<Client>('/clients/me/');
  },

  // Szczegóły klienta
  detail: (id: number): Promise<AxiosResponse<Client>> => {
    return api.get<Client>(`/clients/${id}/`);
  },

  // Utwórz klienta
  create: (data: ClientCreateData): Promise<AxiosResponse<Client>> => {
    return api.post<Client>('/clients/', data);
  },

  // Aktualizuj klienta
  update: (id: number, data: Partial<Client>): Promise<AxiosResponse<Client>> => {
    return api.patch<Client>(`/clients/${id}/`, data);
  },

  // Soft delete klienta
  softDelete: (clientId: number): Promise<AxiosResponse<void>> => {
    return api.post('/clients/soft_delete/', { client: clientId });
  },

  // Wizyty klienta
  appointments: (id: number): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>(`/clients/${id}/appointments/`);
  },

  // Moje wizyty (dla zalogowanego klienta)
  myAppointments: (): Promise<AxiosResponse<Appointment[]>> => {
    return api.get<Appointment[]>('/clients/my_appointments/');
  },
};