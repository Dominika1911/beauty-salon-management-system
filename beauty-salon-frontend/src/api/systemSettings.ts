import axiosInstance from '@/api/axios';
import type { SystemSettings } from '@/types';

type SystemSettingsUpdatePayload = {
    salon_name?: string;
    slot_minutes?: number;
    buffer_minutes?: number;
    opening_hours?: Record<string, Array<{ start: string; end: string }>>;
};

export const systemSettingsApi = {
    get: async (): Promise<SystemSettings> => {
        const response = await axiosInstance.get<SystemSettings>('/system-settings/');
        return response.data;
    },

    update: async (data: SystemSettingsUpdatePayload): Promise<SystemSettings> => {
        const response = await axiosInstance.patch<SystemSettings>('/system-settings/', data);
        return response.data;
    },
};
