import axiosInstance from '@/api/axios';
import type { Client, DRFPaginated } from '@/types';


type ClientListParams = {
    is_active?: boolean;
    client_number?: string;
    search?: string;
    ordering?: string;
    page?: number;
};


type ClientCreatePayload = {
    first_name: string;
    last_name: string;
    email: string | null;
    phone?: string;
    internal_notes?: string;
    password: string;
    is_active?: boolean;
};

type ClientUpdatePayload = Partial<Omit<ClientCreatePayload, 'password'>> & {
    password?: string;
};

export const clientsApi = {
    list: async (params?: ClientListParams): Promise<DRFPaginated<Client>> => {
        const response = await axiosInstance.get<DRFPaginated<Client>>('/clients/', {
            params,
        });
        return response.data;
    },
    get: async (id: number): Promise<Client> => {
        const response = await axiosInstance.get<Client>(`/clients/${id}/`);
        return response.data;
    },
    create: async (data: ClientCreatePayload): Promise<Client> => {
        const payload: ClientCreatePayload = {
            ...data,
            internal_notes: data.internal_notes ?? '',
        };

        const response = await axiosInstance.post<Client>('/clients/', payload);
        return response.data;
    },

    update: async (id: number, data: ClientUpdatePayload): Promise<Client> => {
        const payload: ClientUpdatePayload = {
            ...data,
            ...(data.internal_notes !== undefined
                ? { internal_notes: data.internal_notes ?? '' }
                : {}),
        };

        const response = await axiosInstance.patch<Client>(`/clients/${id}/`, payload);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await axiosInstance.delete(`/clients/${id}/`);
    },

    me: async (): Promise<Client> => {
        const response = await axiosInstance.get<Client>('/clients/me/');
        return response.data;
    },
};
