import axiosInstance from '@/api/axios';
import type { DRFPaginated, SystemLog } from '@/types';


export type AuditLogListParams = {
    action?: string;
    performed_by?: number;
    target_user?: number;
    ordering?: 'timestamp' | '-timestamp' | string;
    page?: number;
};

export const auditLogsApi = {
    list: async (params?: AuditLogListParams): Promise<DRFPaginated<SystemLog>> => {
        const response = await axiosInstance.get<DRFPaginated<SystemLog>>('/audit-logs/', {
            params,
        });
        return response.data;
    },
};
