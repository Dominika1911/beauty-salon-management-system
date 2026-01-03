import axiosInstance from '@/api/axios';
import type { AuthStatusResponse, LoginResponse } from '@/types';

export const authApi = {
    getCsrf: async (): Promise<{ detail: string }> => {
        const response = await axiosInstance.get<{ detail: string }>('/auth/csrf/');
        return response.data;
    },

    login: async (username: string, password: string): Promise<LoginResponse> => {
        const response = await axiosInstance.post<LoginResponse>('/auth/login/', {
            username,
            password,
        });
        return response.data;
    },

    logout: async (): Promise<{ detail: string }> => {
        const response = await axiosInstance.post<{ detail: string }>('/auth/logout/');
        return response.data;
    },

    getStatus: async (): Promise<AuthStatusResponse> => {
        const response = await axiosInstance.get<AuthStatusResponse>('/auth/status/');
        return response.data;
    },

    changePassword: async (data: {
        old_password: string;
        new_password: string;
        new_password2: string;
    }): Promise<{ detail: string }> => {
        const response = await axiosInstance.post<{ detail: string }>(
            '/auth/change-password/',
            data,
        );
        return response.data;
    },
};
