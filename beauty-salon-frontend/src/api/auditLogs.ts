import { api } from "./axios.ts";
import type { AuditLog, PaginatedResponse } from "@/types";

export type { AuditLog } from "@/types";

function isPaginated<T>(x: unknown): x is PaginatedResponse<T> {
  return typeof x === "object" && x !== null && "results" in x;
}

interface AuditLogListParams {
  type?: string;
  level?: string;
  user?: number;
  created_at?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

const ENDPOINTS = {
  base: "/audit-logs/",
  detail: (id: number) => `/audit-logs/${id}/`,
} as const;

export const auditLogsAPI = {
  list: async (params?: AuditLogListParams): Promise<AuditLog[]> => {
    const res = await api.get<PaginatedResponse<AuditLog> | AuditLog[]>(ENDPOINTS.base, { params });
    const data = res.data;
    return isPaginated<AuditLog>(data) ? data.results : data;
  },

  detail: async (id: number): Promise<AuditLog> => {
    const res = await api.get<AuditLog>(ENDPOINTS.detail(id));
    return res.data;
  },
};
