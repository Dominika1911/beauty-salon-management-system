import { api } from "./axios";
import type { AxiosResponse } from "axios";
import type { PaginatedResponse, ScheduleDetail, ScheduleUpdateData } from "../types";

interface ScheduleListParams {
  employee?: number;
  status?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface SchedulesApi {
  list: (params?: ScheduleListParams) => Promise<AxiosResponse<PaginatedResponse<ScheduleDetail>>>;
  detail: (id: number) => Promise<AxiosResponse<ScheduleDetail>>;
  create: (data: ScheduleUpdateData & { employee: number }) => Promise<AxiosResponse<ScheduleDetail>>;
  update: (id: number, data: ScheduleUpdateData) => Promise<AxiosResponse<ScheduleDetail>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

const ENDPOINTS = {
  base: "/schedules/",
  detail: (id: number) => `/schedules/${id}/`,
} as const;

export const schedulesAPI: SchedulesApi = {
  list: (params?: ScheduleListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  create: (data: ScheduleUpdateData & { employee: number }) => api.post(ENDPOINTS.base, data),
  update: (id: number, data: ScheduleUpdateData) => api.patch(ENDPOINTS.detail(id), data),
  delete: (id: number) => api.delete(ENDPOINTS.detail(id)),
};

// ✅ alias pod stare importy:
export const scheduleAPI = schedulesAPI;
