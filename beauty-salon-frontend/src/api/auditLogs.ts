// src/api/auditLogs.ts
import axiosInstance from '@/api/axios';
import type { DRFPaginated, SystemLog } from '@/types';

/**
 * Backend:
 * AuditLogViewSet (ReadOnlyModelViewSet)
 * - filterset_fields = ["action", "performed_by", "target_user"]
 * - ordering_fields = ["timestamp"]
 */
export type AuditLogListParams = {
    action?: string;
    performed_by?: number;
    target_user?: number;
    ordering?: 'timestamp' | '-timestamp' | string;
    page?: number;
};

export const auditLogsApi = {
    /**
     * Tylko ADMIN
     * GET /api/audit-logs/
     * DRF PageNumberPagination -> DRFPaginated<SystemLog>
     */
    list: async (params?: AuditLogListParams): Promise<DRFPaginated<SystemLog>> => {
        const response = await axiosInstance.get<DRFPaginated<SystemLog>>('/audit-logs/', {
            params,
        });
        return response.data;
    },
};
