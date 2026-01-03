import axiosInstance from '@/api/axios';
import type { DashboardResponse } from '@/types';

export const dashboardApi = {

    get: async (): Promise<DashboardResponse> => {
        const response = await axiosInstance.get<DashboardResponse>('/dashboard/');
        return response.data;
    },
};
