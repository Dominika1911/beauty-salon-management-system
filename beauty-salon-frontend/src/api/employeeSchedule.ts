import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { ScheduleDetail, ScheduleUpdateData } from '../types';

interface EmployeeScheduleApi {
  get: (employeeId: number) => Promise<AxiosResponse<ScheduleDetail>>;
  patch: (employeeId: number, data: ScheduleUpdateData) => Promise<AxiosResponse<ScheduleDetail>>;
}

const ENDPOINTS = {
  base: (employeeId: number) => `/employees/${employeeId}/schedule/`,
} as const;

export const employeeScheduleAPI: EmployeeScheduleApi = {
  get: (employeeId: number) => api.get(ENDPOINTS.base(employeeId)),
  patch: (employeeId: number, data: ScheduleUpdateData) => api.patch(ENDPOINTS.base(employeeId), data),
};
