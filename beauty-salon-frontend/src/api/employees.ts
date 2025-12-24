import axiosInstance from './axios';
import type { Employee } from '../types';

/**
 * API dla pracowników
 */

// Pobierz wszystkich pracowników
export const getEmployees = async (): Promise<Employee[]> => {
  const response = await axiosInstance.get('/employees/');
  return response.data.results || response.data;
};

// Pobierz aktywnych pracowników
export const getActiveEmployees = async (): Promise<Employee[]> => {
  const response = await axiosInstance.get('/employees/?is_active=true');
  return response.data.results || response.data;
};

// Pobierz pracownika po ID
export const getEmployee = async (id: number): Promise<Employee> => {
  const response = await axiosInstance.get<Employee>(`/employees/${id}/`);
  return response.data;
};

// Utwórz pracownika
export const createEmployee = async (data: Partial<Employee>): Promise<Employee> => {
  const response = await axiosInstance.post<Employee>('/employees/', data);
  return response.data;
};

// Zaktualizuj pracownika
export const updateEmployee = async (id: number, data: Partial<Employee>): Promise<Employee> => {
  const response = await axiosInstance.patch<Employee>(`/employees/${id}/`, data);
  return response.data;
};

// Usuń pracownika
export const deleteEmployee = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/employees/${id}/`);
};

// =============================================================================
// Schedule API (GET/PATCH /employees/{id}/schedule/)
// =============================================================================

export type WeeklyHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  Array<{ start: string; end: string }>
>;

export interface EmployeeSchedule {
  id: number;
  employee: number;
  weekly_hours: Partial<WeeklyHours>;
  created_at: string;
  updated_at: string;
};

export const getEmployeeSchedule = async (employeeId: number): Promise<EmployeeSchedule> => {
  const response = await axiosInstance.get<EmployeeSchedule>(`/employees/${employeeId}/schedule/`);
  return response.data;
};

export const updateEmployeeSchedule = async (
  employeeId: number,
  weekly_hours: Partial<WeeklyHours>
): Promise<EmployeeSchedule> => {
  const response = await axiosInstance.patch<EmployeeSchedule>(
    `/employees/${employeeId}/schedule/`,
    { weekly_hours }
  );
  return response.data;
};
