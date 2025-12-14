import { api } from './axios';

export interface AuditLog {
  id: number;
  type: string;
  level: string;
  level_display?: string;
  created_at: string;
  user_email?: string | null;
  message: string;
}

type DRFList<T> = { results: T[] };

export const auditLogsAPI = {
  list: async (params?: { type?: string; level?: string; ordering?: string }): Promise<AuditLog[]> => {
    const res = await api.get<AuditLog[] | DRFList<AuditLog>>('/audit-logs/', { params });
    const payload = res.data as any;
    return Array.isArray(payload) ? payload : (payload?.results ?? []);
  },
};
