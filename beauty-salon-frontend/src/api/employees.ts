// src/api/employees.ts

import { api } from './axios';
import type { Employee } from '../types';

export const employeesAPI = {
  // Lista wszystkich pracowników
  list: (params?: { is_active?: boolean; search?: string }) => {
    return api.get<Employee[]>('/employees/', { params });
  },

  // Tylko aktywni pracownicy
  active: () => {
    return api.get<Employee[]>('/employees/active/');
  },

  // Profil zalogowanego pracownika
  me: () => {
    return api.get<Employee>('/employees/me/');
  },

  // Szczegóły pracownika
  detail: (id: number) => {
    return api.get<Employee>(`/employees/${id}/`);
  },

  // Usługi pracownika
  services: (id: number) => {
    return api.get(`/employees/${id}/services/`);
  },

  // Nadchodzące wizyty pracownika
  upcomingAppointments: (id: number) => {
    return api.get(`/employees/${id}/upcoming_appointments/`);
  },

  // Utwórz pracownika (tylko manager)
  create: (data: {
    user: number;
    first_name: string;
    last_name: string;
    phone?: string;
    hired_at?: string;
    is_active?: boolean;
    skill_ids?: number[];
  }) => {
    return api.post<Employee>('/employees/', data);
  },

  // Aktualizuj pracownika
  update: (id: number, data: Partial<Employee>) => {
    return api.patch<Employee>(`/employees/${id}/`, data);
  },

  // Usuń pracownika
  delete: (id: number) => {
    return api.delete(`/employees/${id}/`);
  },
};