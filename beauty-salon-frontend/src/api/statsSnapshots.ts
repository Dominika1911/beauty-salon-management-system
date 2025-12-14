import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { PaginatedResponse, StatsSnapshot } from '../types';

interface StatsSnapshotListParams {
  period?: string;
  date_from?: string;
  date_to?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface StatsSnapshotsApi {
  list: (params?: StatsSnapshotListParams) => Promise<AxiosResponse<PaginatedResponse<StatsSnapshot>>>;
  detail: (id: number) => Promise<AxiosResponse<StatsSnapshot>>;
}

const ENDPOINTS = {
  base: '/stats-snapshots/',
  detail: (id: number) => `/stats-snapshots/${id}/`,
} as const;

export const statsSnapshotsAPI: StatsSnapshotsApi = {
  list: (params?: StatsSnapshotListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
};
