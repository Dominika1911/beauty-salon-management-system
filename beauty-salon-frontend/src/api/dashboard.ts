// src/api/dashboard.ts

import { api } from './axios';

export interface DashboardData {
  role: 'client' | 'employee' | 'manager';
  client?: any;
  employee?: any;
  today?: {
    date: string;
    total_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    new_clients: number;
    revenue: string;
  };
  upcoming_appointments?: any[];
  today_appointments?: any[];
  today_appointments_count?: number;
  upcoming_appointments_count?: number;
  last_visits?: any[];
  total_spent?: string;
  pending_time_off_requests?: any[];
  latest_stats_snapshot?: any;
}

export const dashboardAPI = {
  // Dashboard (różny dla każdej roli)
  get: () => {
    return api.get<DashboardData>('/dashboard/');
  },
};