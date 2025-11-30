import { api } from './axios';
import type { DashboardData } from '../types';
import type { AxiosResponse } from 'axios';

interface DashboardApi {
  get: () => Promise<AxiosResponse<DashboardData>>;
}

/**
 * API do pobierania danych dashboardu
 */
export const dashboardAPI: DashboardApi = {
  /**
   * Dashboard (różny dla każdej roli)
   */
  get: (): Promise<AxiosResponse<DashboardData>> => {
    return api.get<DashboardData>('/dashboard/');
  },
};