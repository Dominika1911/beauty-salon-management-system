import { api } from "./axios";

export type StatisticsResponse = {
  period: { days: number; from: string; to: string };
  summary: {
    total_clients: number;
    new_clients: number;
    total_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    no_show_appointments: number;
    total_revenue: string;
  };
  services: Array<{
    service: {
      id: number;
      name: string;
      duration_minutes?: number;
      price?: string;
    };
    total_appointments: number;
    total_revenue: string;
  }>;
  employees: Array<{
    employee: { id: number; number: string; full_name: string };
    total_appointments: number;
    occupancy_percent: string;
  }>;
};

export async function getStatistics(days = 30): Promise<StatisticsResponse> {
  const res = await api.get("/statistics/", { params: { days } });
  return res.data;
}
