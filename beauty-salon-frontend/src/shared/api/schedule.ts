import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type {
  PaginatedResponse,
  ScheduleDetail,
  ScheduleUpdateData,
  TimeOff,
  TimeOffApproveData,
  TimeOffCreateUpdateData,
} from '@/shared/types';

import { employeeScheduleAPI } from './employeeSchedule';
import { timeOffsAPI } from './timeOffs';

interface ScheduleListParams {
  employee?: number;
  status?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface TimeOffListParams {
  employee?: number;
  status?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface ExtendedScheduleApi {
  // schedules (ogólne)
  list: (params?: ScheduleListParams) => Promise<AxiosResponse<PaginatedResponse<ScheduleDetail>>>;
  detail: (id: number) => Promise<AxiosResponse<ScheduleDetail>>;
  create: (data: ScheduleUpdateData & { employee: number }) => Promise<AxiosResponse<ScheduleDetail>>;
  update: (id: number, data: ScheduleUpdateData) => Promise<AxiosResponse<ScheduleDetail>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  // schedule pracownika (endpoint pracowniczy)
  getEmployeeSchedule: (employeeId: number) => Promise<AxiosResponse<ScheduleDetail>>;
  updateEmployeeSchedule: (employeeId: number, data: ScheduleUpdateData) => Promise<AxiosResponse<ScheduleDetail>>;

  // time-offs
  listTimeOff: (params?: TimeOffListParams) => Promise<AxiosResponse<PaginatedResponse<TimeOff>>>;
  createTimeOff: (data: TimeOffCreateUpdateData) => Promise<AxiosResponse<TimeOff>>;
  updateTimeOff: (id: number, data: Partial<TimeOffCreateUpdateData>) => Promise<AxiosResponse<TimeOff>>;
  deleteTimeOff: (id: number) => Promise<AxiosResponse<void>>;
  approveTimeOff: (data: TimeOffApproveData) => Promise<AxiosResponse<TimeOff>>;
}

const ENDPOINTS = {
  base: '/schedules/',
  detail: (id: number) => `/schedules/${id}/`,
} as const;

export const schedulesAPI = {
  list: (params?: ScheduleListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  create: (data: ScheduleUpdateData & { employee: number }) => api.post(ENDPOINTS.base, data),
  update: (id: number, data: ScheduleUpdateData) => api.patch(ENDPOINTS.detail(id), data),
  delete: (id: number) => api.delete(ENDPOINTS.detail(id)),
};

/**
 * ✅ scheduleAPI to "stary" import w komponentach (ScheduleEditor / ScheduleManagementPage / TimeOffForm).
 * W Twoim projekcie harmonogram i nieobecności są obsługiwane przez osobne endpointy:
 * - /employees/{id}/schedule/
 * - /time-offs/
 * To jest tylko warstwa kompatybilności, żeby nie przepisywać całego UI.
 */
export const scheduleAPI: ExtendedScheduleApi = {
  ...schedulesAPI,

  // employee schedule
  getEmployeeSchedule: (employeeId) => employeeScheduleAPI.get(employeeId),
  updateEmployeeSchedule: (employeeId, data) => employeeScheduleAPI.patch(employeeId, data),

  // time-offs
  listTimeOff: (params?: TimeOffListParams) => timeOffsAPI.list(params),
  createTimeOff: (data) => timeOffsAPI.create(data),
  updateTimeOff: (id, data) => timeOffsAPI.update(id, data),
  deleteTimeOff: (id) => timeOffsAPI.delete(id),
  approveTimeOff: (data) => timeOffsAPI.approve(data),
};
