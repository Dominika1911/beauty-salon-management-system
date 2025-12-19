import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { DashboardResponse } from '@/shared/types';

interface DashboardApi {
  get: () => Promise<AxiosResponse<DashboardResponse>>;
}

const ENDPOINTS = {
  base: '/dashboard/',
} as const;

export const dashboardAPI: DashboardApi = {
  get: () => api.get(ENDPOINTS.base),
};
