import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { PaginatedResponse, TimeOff, TimeOffApproveData, TimeOffCreateUpdateData } from '@/shared/types';

interface TimeOffListParams {
  employee?: number;
  status?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface TimeOffsApi {
  list: (params?: TimeOffListParams) => Promise<AxiosResponse<PaginatedResponse<TimeOff>>>;
  detail: (id: number) => Promise<AxiosResponse<TimeOff>>;
  create: (data: TimeOffCreateUpdateData) => Promise<AxiosResponse<TimeOff>>;
  update: (id: number, data: Partial<TimeOffCreateUpdateData>) => Promise<AxiosResponse<TimeOff>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  approve: (data: TimeOffApproveData) => Promise<AxiosResponse<TimeOff>>;
}

const ENDPOINTS = {
  base: '/time-offs/',
  detail: (id: number) => `/time-offs/${id}/`,
  approve: '/time-offs/approve/',
} as const;

export const timeOffsAPI: TimeOffsApi = {
  list: (params?: TimeOffListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  create: (data: TimeOffCreateUpdateData) => api.post(ENDPOINTS.base, data),
  update: (id: number, data: Partial<TimeOffCreateUpdateData>) => api.patch(ENDPOINTS.detail(id), data),
  delete: (id: number) => api.delete(ENDPOINTS.detail(id)),

  approve: (data: TimeOffApproveData) => api.post(ENDPOINTS.approve, data),
};
