import axiosInstance from './axios';
import type {
  AdminDashboard,
  EmployeeDashboard,
  ClientDashboard,
  RevenueReport,
  EmployeePerformance,
  PopularService,
} from '../types';

/**
 * API dla dashboardu i raportów
 */

// Dashboard (zróżnicowany dla każdej roli)
export const getDashboard = async (): Promise<
  AdminDashboard | EmployeeDashboard | ClientDashboard
> => {
  const response = await axiosInstance.get('/dashboard/');
  return response.data;
};

// Raport przychodów
export const getRevenueReport = async (params?: {
  date_from?: string;
  date_to?: string;
  group_by?: 'day' | 'month';
}): Promise<RevenueReport> => {
  const response = await axiosInstance.get<RevenueReport>('/reports/revenue/', { params });
  return response.data;
};

// Raport wydajności pracowników
export const getEmployeePerformance = async (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<EmployeePerformance[]> => {
  const response = await axiosInstance.get<EmployeePerformance[]>('/reports/employee-performance/', {
    params,
  });
  return response.data;
};

// Raport popularnych usług
export const getPopularServices = async (params?: {
  limit?: number;
}): Promise<PopularService[]> => {
  const response = await axiosInstance.get<PopularService[]>('/reports/popular-services/', {
    params,
  });
  return response.data;
};
