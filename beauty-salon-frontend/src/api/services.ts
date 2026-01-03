import axiosInstance from '@/api/axios';
import type { DRFPaginated, Service } from '@/types';

type ServiceListParams = {
    is_active?: boolean;
    category?: string;
    search?: string;
    ordering?: string;
    page?: number;
};

type ServiceCreatePayload = {
    name: string;
    category?: string;
    description?: string;
    price: number | string;
    duration_minutes: number;
    is_active?: boolean;
};

type ServiceUpdatePayload = Partial<ServiceCreatePayload>;

export const servicesApi = {
    list: async (params?: ServiceListParams): Promise<DRFPaginated<Service>> => {
        const response = await axiosInstance.get<DRFPaginated<Service>>('/services/', { params });
        return response.data;
    },

    get: async (id: number): Promise<Service> => {
        const response = await axiosInstance.get<Service>(`/services/${id}/`);
        return response.data;
    },

    create: async (data: ServiceCreatePayload): Promise<Service> => {
        const response = await axiosInstance.post<Service>('/services/', data);
        return response.data;
    },

    update: async (id: number, data: ServiceUpdatePayload): Promise<Service> => {
        const response = await axiosInstance.patch<Service>(`/services/${id}/`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await axiosInstance.delete(`/services/${id}/`);
    },

    disable: async (id: number): Promise<{ detail: string }> => {
        const response = await axiosInstance.post<{ detail: string }>(`/services/${id}/disable/`);
        return response.data;
    },

    enable: async (id: number): Promise<{ detail: string }> => {
        const response = await axiosInstance.post<{ detail: string }>(`/services/${id}/enable/`);
        return response.data;
    },
};
