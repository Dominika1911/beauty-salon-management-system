import axiosInstance from '@/api/axios';
import type { DRFPaginated, TimeOff, TimeOffStatus } from '@/types';


type TimeOffListParams = {
    status?: TimeOffStatus;
    employee?: number;
    date_from?: string;
    date_to?: string;
    search?: string;
    ordering?: string;
    page?: number;
};

type TimeOffCreatePayload = {
    date_from: string;
    date_to: string;
    reason?: string;
};

export const timeOffApi = {
    list: async (params?: TimeOffListParams): Promise<DRFPaginated<TimeOff>> => {
        const response = await axiosInstance.get<DRFPaginated<TimeOff>>('/time-offs/', { params });
        return response.data;
    },

    get: async (id: number): Promise<TimeOff> => {
        const response = await axiosInstance.get<TimeOff>(`/time-offs/${id}/`);
        return response.data;
    },

    create: async (data: TimeOffCreatePayload): Promise<TimeOff> => {
        const response = await axiosInstance.post<TimeOff>('/time-offs/', data);
        return response.data;
    },

    approve: async (id: number): Promise<TimeOff> => {
        const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/approve/`);
        return response.data;
    },

    reject: async (id: number): Promise<TimeOff> => {
        const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/reject/`);
        return response.data;
    },

    cancel: async (id: number): Promise<TimeOff> => {
        const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/cancel/`);
        return response.data;
    },
};
