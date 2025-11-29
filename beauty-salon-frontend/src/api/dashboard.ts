// src/api/dashboard.ts (POPRAWIONY I KOMPLETNIE TYPOWANY)

import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { Appointment, Client, Employee } from '../types'; // Używamy typów z pliku types/index.ts

// Interfejs dla sekcji 'today' (tylko dla Managera)
interface DashboardTodayData {
  date: string;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  new_clients: number;
  revenue: string;
}

// Główny interfejs DashboardData (usunięto wszystkie 'any')
export interface DashboardData {
  role: 'client' | 'employee' | 'manager';

  // Dane specyficzne dla ról
  client?: Client;
  employee?: Employee;

  // Dane dla Managera
  today?: DashboardTodayData;
  latest_stats_snapshot?: unknown; // Używamy unknown, bo to złożony typ

  // Dane wspólne
  upcoming_appointments?: Appointment[];
  today_appointments?: Appointment[];
  last_visits?: Appointment[];

  // Proste statystyki
  today_appointments_count?: number;
  upcoming_appointments_count?: number;
  total_spent?: string;
  pending_time_off_requests?: unknown[]; // TimeOff to złożony typ, używamy unknown[]
}

// Definicja interfejsu dla całego obiektu API
interface DashboardApi {
  get: () => Promise<AxiosResponse<DashboardData>>;
}

// ZASTOSOWANIE JAWNEGO TYPU I TYPU ZWRACANEGO FUNKCJI
export const dashboardAPI: DashboardApi = {
  // Dashboard (różny dla każdej roli)
  get: (): Promise<AxiosResponse<DashboardData>> => { // <-- Naprawiono błędy typedef i return-type
    return api.get<DashboardData>('/dashboard/');
  },
};