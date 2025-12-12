// src/api/schedule.ts
import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { TimeOff, TimeOffCreateUpdateData, PaginatedResponse } from '../types';

// ====== Schedule (availability) payload types ======
export interface AvailabilityPeriodPayload {
  weekday: string;
  start_time: string; // "09:00:00"
  end_time: string;   // "17:00:00"
}

export interface ScheduleUpdatePayload {
  status: 'active' | 'inactive' | string;
  breaks: any[];
  availability_periods: AvailabilityPeriodPayload[];
}

export interface EmployeeScheduleResponse {
  id?: number;
  status?: string;
  breaks?: any[];
  availability_periods?: AvailabilityPeriodPayload[];
}

interface ScheduleApi {
  // --- time off ---
  listTimeOff: (employeeId?: number) => Promise<AxiosResponse<PaginatedResponse<TimeOff>>>;
  createTimeOff: (data: TimeOffCreateUpdateData) => Promise<AxiosResponse<TimeOff>>;
  updateTimeOff: (
    id: number,
    data: Partial<TimeOffCreateUpdateData & { is_approved?: boolean; status?: any }>
  ) => Promise<AxiosResponse<TimeOff>>;
  deleteTimeOff: (id: number) => Promise<AxiosResponse<void>>;

  // --- employee schedule ---
  getEmployeeSchedule: (employeeId: number) => Promise<AxiosResponse<EmployeeScheduleResponse>>;
  updateEmployeeSchedule: (employeeId: number, data: ScheduleUpdatePayload) => Promise<AxiosResponse<EmployeeScheduleResponse>>;
}

const ENDPOINTS = {
  timeOff: '/time-offs/',
  timeOffDetail: (id: number) => `/time-offs/${id}/`,
  employeeSchedule: (employeeId: number) => `/employees/${employeeId}/schedule/`,
} as const;

export const scheduleAPI: ScheduleApi = {
  // ====== TIME OFF ======
  listTimeOff: (employeeId) => {
    const params = employeeId ? { employee: employeeId } : {};
    return api.get<PaginatedResponse<TimeOff>>(ENDPOINTS.timeOff, { params });
  },

  createTimeOff: (data) => api.post<TimeOff>(ENDPOINTS.timeOff, data),

  updateTimeOff: (id, data) => api.patch<TimeOff>(ENDPOINTS.timeOffDetail(id), data),

  deleteTimeOff: (id) => api.delete<void>(ENDPOINTS.timeOffDetail(id)),

  // ====== EMPLOYEE SCHEDULE ======
  getEmployeeSchedule: (employeeId) => api.get<EmployeeScheduleResponse>(ENDPOINTS.employeeSchedule(employeeId)),

  updateEmployeeSchedule: (employeeId, data) =>
    api.patch<EmployeeScheduleResponse>(ENDPOINTS.employeeSchedule(employeeId), data),
};
